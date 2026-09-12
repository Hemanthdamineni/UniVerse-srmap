"use strict";

/**
 * Server-side résumé text extraction.
 *
 * The "Proof" panel accepts PDF / DOCX / TXT / MD. Previously the frontend read
 * the file with `FileReader.readAsText` and posted the result — which for a PDF
 * is raw binary, so the keyword scorer graded noise. Extraction now happens here
 * from the uploaded bytes, and files we cannot turn into readable text are
 * rejected rather than stored with a fabricated score.
 */

const path = require("path");

const MAX_TEXT_CHARS = 200_000;
// A real résumé runs to hundreds of words; this only needs to be high enough to
// reject a font/metadata table scraped out of an image-only PDF, not to judge
// how thorough the résumé is.
const MIN_WORDS = 15;
const MIN_PRINTABLE_RATIO = 0.7;

function unreadable(message, hint) {
  const error = new Error(hint ? `${message} ${hint}` : message);
  error.status = 422;
  error.code = "RESUME_UNREADABLE";
  return error;
}

function looksLikeReadableText(text) {
  const words = (text.match(/[A-Za-z]{2,}/g) || []).length;
  if (words < MIN_WORDS) return false;
  const nonSpace = text.replace(/\s+/g, "");
  if (!nonSpace.length) return false;
  const printable = (nonSpace.match(/[\x20-\x7E]/g) || []).length;
  return printable / nonSpace.length >= MIN_PRINTABLE_RATIO;
}

function normalize(raw) {
  return String(raw || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function fromPdf(buffer) {
  const { extractText, extractLinks, getDocumentProxy } = await import("unpdf");
  // verbosity 0 = errors only; keeps pdfjs' "Indexing all PDF objects" chatter
  // out of the request logs for slightly non-standard résumé PDFs.
  const pdf = await getDocumentProxy(new Uint8Array(buffer), { verbosity: 0 });
  const { text } = await extractText(pdf, { mergePages: true });
  let body = Array.isArray(text) ? text.join("\n") : text;

  // Many résumés hyperlink the words "GitHub" / "LinkedIn" with no visible URL.
  // The PDF link annotations still carry the real targets — append them so the
  // profile-link parser can see them.
  try {
    const { links } = await extractLinks(pdf);
    const urls = (links || [])
      .filter((u) => /^https?:\/\//i.test(u))
      .filter((u, i, a) => a.indexOf(u) === i);
    if (urls.length) body += `\n\nLinks:\n${urls.join("\n")}`;
  } catch {
    /* annotations are a bonus, never a hard dependency */
  }
  return body;
}

async function fromDocx(buffer) {
  const mammoth = require("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/**
 * @param {Buffer} buffer raw uploaded file bytes
 * @param {{ mimeType?: string, fileName?: string }} meta
 * @returns {Promise<{ text: string, format: "pdf"|"docx"|"text" }>}
 * @throws a 422 `RESUME_UNREADABLE` error for unsupported or unparseable files
 */
async function extractResumeText(buffer, { mimeType = "", fileName = "" } = {}) {
  if (!buffer || !buffer.length) {
    throw unreadable("The uploaded résumé is empty.");
  }

  const ext = path.extname(String(fileName)).toLowerCase();
  const mime = String(mimeType).toLowerCase();
  const isPdf = ext === ".pdf" || mime === "application/pdf" || buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  const isDocx =
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isText = ext === ".txt" || ext === ".md" || mime.startsWith("text/");
  const isLegacyDoc = ext === ".doc" || mime === "application/msword";

  if (isLegacyDoc) {
    throw unreadable(
      "The old .doc format can't be read here.",
      "Save it as a PDF or .docx and upload again.",
    );
  }

  let text;
  let format;
  try {
    if (isPdf) {
      text = await fromPdf(buffer);
      format = "pdf";
    } else if (isDocx) {
      text = await fromDocx(buffer);
      format = "docx";
    } else if (isText) {
      text = buffer.toString("utf8");
      format = "text";
    } else {
      throw unreadable(
        `Unsupported résumé file type${ext ? ` (${ext})` : ""}.`,
        "Upload a PDF, DOCX, TXT or MD file.",
      );
    }
  } catch (error) {
    if (error.code === "RESUME_UNREADABLE") throw error;
    throw unreadable("We couldn't open this résumé file.", "Try re-exporting it as a PDF.");
  }

  const normalized = normalize(text);
  if (!looksLikeReadableText(normalized)) {
    throw unreadable(
      "We couldn't read readable text from this file.",
      "If it's a scanned or image-only PDF, upload a text-based export instead.",
    );
  }

  return { text: normalized, format };
}

module.exports = { extractResumeText, looksLikeReadableText };
