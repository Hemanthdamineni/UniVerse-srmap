const test = require("node:test");
const assert = require("node:assert/strict");
const JSZip = require("jszip");

const { extractResumeText, looksLikeReadableText } = require("../src/services/career/resumeText");

const RESUME_LINES = [
  "Jane Doe - Software Engineer",
  "Email jane.doe@example.com  github.com/janedoe  linkedin.com/in/janedoe",
  "EXPERIENCE",
  "Software Engineering Intern, Acme Corp (Summer 2025)",
  "Built a React and TypeScript analytics dashboard used by 500 students.",
  "Automated deployment with Docker and AWS, cutting release time by 40 percent.",
  "PROJECTS",
  "Campus Planner - a Node.js and SQL scheduling tool for student clubs.",
  "SKILLS Python, JavaScript, TypeScript, React, Node.js, AWS, Docker, SQL, Git",
  "CERTIFICATIONS AWS Cloud Practitioner (Coursera)",
];

/** Minimal single-page PDF with the given lines as real, on-page text objects. */
function makePdf(lines) {
  const esc = (s) => s.replace(/([()\\])/g, "\\$1");
  let content = "BT /F1 12 Tf 40 750 Td 14 TL\n";
  lines.forEach((line, i) => {
    content += `(${esc(line)}) Tj ${i < lines.length - 1 ? "T*" : ""}\n`;
  });
  content += "ET";
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${Buffer.byteLength(content, "latin1")}>>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function makeDocx(paragraphs) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip
    .folder("_rels")
    .file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    );
  zip
    .folder("word")
    .file(
      "document.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
        .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
        .join("")}</w:body></w:document>`,
    );
  return zip.generateAsync({ type: "nodebuffer" });
}

test("extracts text from a real PDF", async () => {
  const { text, format } = await extractResumeText(makePdf(RESUME_LINES), {
    fileName: "resume.pdf",
    mimeType: "application/pdf",
  });
  assert.equal(format, "pdf");
  assert.match(text, /Software Engineering Intern/);
  assert.match(text, /React and TypeScript/);
  assert.match(text, /AWS Cloud Practitioner/);
});

test("extracts text from a real DOCX", async () => {
  const buf = await makeDocx([
    "Jane Doe - Software Engineer",
    "Skills: Python, TypeScript, React, Node.js, AWS, Docker, SQL, Git",
    "Built a React dashboard used by 500 students. Interned at Acme Corp.",
    "github.com/janedoe linkedin.com/in/janedoe",
  ]);
  const { text, format } = await extractResumeText(buf, {
    fileName: "resume.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  assert.equal(format, "docx");
  assert.match(text, /Software Engineer/);
  assert.match(text, /500 students/);
});

test("passes plain text through", async () => {
  const buf = Buffer.from(RESUME_LINES.join("\n"), "utf8");
  const { text, format } = await extractResumeText(buf, { fileName: "resume.txt" });
  assert.equal(format, "text");
  assert.match(text, /Campus Planner/);
});

test("rejects binary noise as unreadable", async () => {
  const noise = Buffer.alloc(4096);
  for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
  await assert.rejects(
    () => extractResumeText(noise, { fileName: "resume.pdf", mimeType: "application/pdf" }),
    (err) => err.status === 422 && err.code === "RESUME_UNREADABLE",
  );
});

test("rejects legacy .doc and unsupported types with a 422", async () => {
  await assert.rejects(
    () => extractResumeText(Buffer.from("anything"), { fileName: "resume.doc", mimeType: "application/msword" }),
    (err) => err.status === 422 && /\.doc/.test(err.message),
  );
  await assert.rejects(
    () => extractResumeText(Buffer.from("anything"), { fileName: "resume.rtf" }),
    (err) => err.status === 422,
  );
});

test("rejects an empty upload", async () => {
  await assert.rejects(
    () => extractResumeText(Buffer.alloc(0), { fileName: "resume.pdf" }),
    (err) => err.status === 422,
  );
});

test("looksLikeReadableText guards short and low-printable strings", () => {
  assert.equal(looksLikeReadableText("only a few words here"), false);
  assert.equal(looksLikeReadableText(RESUME_LINES.join(" ")), true);
  assert.equal(looksLikeReadableText("".repeat(200)), false);
});
