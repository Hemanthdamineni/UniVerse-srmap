/**
 * Targeted extractor for Transport Registration Acknowledgment
 *
 * Parses structured fields from the ERP acknowledgment page:
 * - Registration status
 * - School/Institute address
 * - Transport status
 *
 * @module erpExtractors/extractTransportRegistrationAck
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractTransportRegistrationAck(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h1, h2, h3, .table-title").first().text()) || "Registration Acknowledgment";

  // Collect structured fields
  const fields = [];

  // Look for structured content in the page
  const bodyText = cleanText($("body").text() || $("*").text());

  // The text typically looks like:
  // "Registration Acknowledgment School of Engineering and Sciences Neerukonda, Mangalagiri Mandal, Guntur District, Mangalagiri Andhra Pradesh 522502. You are not registered to Transport Transport & FAQs External resource. Open URL in browser."

  // First, try to split the concatenated text into logical parts
  // The pattern is: "Registration Acknowledgment <Institute> <Address>. <Registration Status> <FAQ/Link>"

  let institute = "";
  let address = "";
  let regStatus = "";

  // Extract institute name - look for "School of Engineering and Sciences"
  const instituteMatch = bodyText.match(/School of Engineering and Sciences/);
  if (instituteMatch) {
    institute = "School of Engineering and Sciences";
    fields.push({ label: "Institute", value: institute });
  }

  // Extract address - look for the address pattern after the institute name
  // Address starts after "School of Engineering and Sciences" and ends before registration status
  const addressMatch = bodyText.match(/School of Engineering and Sciences\s+(.+?)(?:\.\s*(?:You are (?:not )?registered to Transport))/i);
  if (addressMatch) {
    address = addressMatch[1].trim();
    // Clean up any remaining "Registration Acknowledgment" prefix
    address = address.replace(/^Registration Acknowledgment\s+/i, "").trim();
    if (address.length > 5) {
      fields.push({ label: "Address", value: address });
    }
  }

  // Extract registration status
  const regStatusMatch = bodyText.match(/(You are (?:not )?registered to Transport[^.]*)/i);
  if (regStatusMatch) {
    regStatus = regStatusMatch[1]
      .replace(/Transport & FAQs/gi, "")
      .replace(/External resource\.?\s*Open URL in browser/gi, "")
      .replace(/External resource/gi, "")
      .trim();
    fields.push({ label: "Transport Registration", value: regStatus });
  }

  // If we didn't get structured fields, fall back to segment-based parsing
  if (fields.length === 0) {
    const segments = bodyText
      .split(/[.|]/)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    const seen = new Set();

    for (const segment of segments) {
      // Check for institute name (just the name, not full concatenated)
      if (/School of Engineering and Sciences/i.test(segment) && !seen.has("institute")) {
        fields.push({ label: "Institute", value: "School of Engineering and Sciences" });
        seen.add("institute");
      }

      // Check for address (after removing institute name and prefix)
      if (/Neerukonda|Mangalagiri|Guntur|Andhra Pradesh|522502/i.test(segment) && !seen.has("address")) {
        const addr = segment
          .replace(/Registration Acknowledgment/gi, "")
          .replace(/School of Engineering and Sciences/gi, "")
          .replace(/You are not registered to Transport/gi, "")
          .replace(/You are registered to Transport/gi, "")
          .replace(/Transport & FAQs/gi, "")
          .replace(/External resource\. Open URL in browser/gi, "")
          .replace(/External resource/gi, "")
          .trim();
        if (addr.length > 10) {
          fields.push({ label: "Address", value: addr });
          seen.add("address");
        }
      }

      // Check for registration status
      if (/You are not registered to Transport|You are registered to Transport/i.test(segment) && !seen.has("regStatus")) {
        const status = segment
          .replace(/Transport & FAQs/gi, "")
          .replace(/External resource\. Open URL in browser/gi, "")
          .replace(/External resource/gi, "")
          .trim();
        fields.push({ label: "Transport Registration", value: status });
        seen.add("regStatus");
      }
      // Skip the Transport & FAQs / External resource segment entirely
    }
  }

  // If we still didn't get structured fields, fall back to raw text
  if (fields.length === 0) {
    return {
      type: "transport-registration-ack",
      title,
      fields: [{ label: "Details", value: bodyText }],
      text: bodyText,
      rawText: bodyText,
    };
  }

  // Also produce a colon-separated text representation for legacy frontend rendering
  const structuredText = fields.map(f => `${f.label}: ${f.value}`).join(" | ");

  return {
    type: "transport-registration-ack",
    title,
    fields,
    text: structuredText,
    rawText: bodyText,
  };
}

module.exports = { extractTransportRegistrationAck };