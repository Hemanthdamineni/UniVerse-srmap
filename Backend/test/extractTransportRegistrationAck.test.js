const test = require("node:test");
const assert = require("node:assert/strict");

const { extractTransportRegistrationAck } = require("../src/services/erp/extractors/extractTransportRegistrationAck");
const { adaptToLegacyPayload } = require("../src/services/erp/extractors/index");

test("extractTransportRegistrationAck parses structured fields from acknowledgment page", () => {
  const sampleHtml = `
    <html>
    <body>
      Registration Acknowledgment School of Engineering and Sciences Neerukonda, Mangalagiri Mandal, Guntur District, Mangalagiri Andhra Pradesh 522502. You are not registered to Transport Transport & FAQs External resource. Open URL in browser.
    </body>
    </html>
  `;

  const result = extractTransportRegistrationAck(sampleHtml);

  assert.equal(result.type, "transport-registration-ack");
  assert.equal(result.title, "Registration Acknowledgment");
  assert.ok(Array.isArray(result.fields));
  assert.ok(result.fields.length >= 3);

  // Check for expected field labels (Actions/FAQs link is now excluded)
  const labels = result.fields.map(f => f.label);
  assert.ok(labels.includes("Institute"));
  assert.ok(labels.includes("Address"));
  assert.ok(labels.includes("Transport Registration"));
  assert.ok(!labels.includes("Actions"));

  // Check structured text is present
  assert.ok(result.text && result.text.includes("Institute:"));
  assert.ok(result.text.includes("Address:"));
  assert.ok(result.text.includes("Transport Registration:"));
  assert.ok(!result.text.includes("Actions:"));
});

test("extractTransportRegistrationAck handles registered student case", () => {
  const sampleHtml = `
    <html>
    <body>
      Registration Acknowledgment School of Engineering and Sciences Neerukonda, Mangalagiri Mandal, Guntur District, Mangalagiri Andhra Pradesh 522502. You are registered to Transport Route 101 Transport & FAQs External resource. Open URL in browser.
    </body>
    </html>
  `;

  const result = extractTransportRegistrationAck(sampleHtml);

  assert.equal(result.type, "transport-registration-ack");
  const regField = result.fields.find(f => f.label === "Transport Registration");
  assert.ok(regField);
  assert.ok(regField.value.includes("registered to Transport"));
  // Should not have Actions field
  const actionsField = result.fields.find(f => f.label === "Actions");
  assert.equal(actionsField, undefined);
});

test("extractTransportRegistrationAck fallback when no patterns match", () => {
  const sampleHtml = `
    <html>
    <body>
      Some completely different content that does not match any patterns.
    </body>
    </html>
  `;

  const result = extractTransportRegistrationAck(sampleHtml);

  assert.equal(result.type, "transport-registration-ack");
  assert.ok(result.fields.length === 1);
  assert.equal(result.fields[0].label, "Details");
});

test("adaptToLegacyPayload wraps transport-registration-ack correctly", () => {
  const extracted = {
    type: "transport-registration-ack",
    title: "Registration Acknowledgment",
    fields: [
      { label: "Institute", value: "School of Engineering and Sciences" },
      { label: "Address", value: "Neerukonda, Mangalagiri" },
      { label: "Transport Registration", value: "You are not registered to Transport" },
    ],
    text: "Institute: School of Engineering and Sciences | Address: Neerukonda, Mangalagiri | Transport Registration: You are not registered to Transport",
    rawText: "raw text",
  };

  const adapted = adaptToLegacyPayload(extracted);

  assert.equal(adapted.title, "Registration Acknowledgment");
  assert.ok(adapted.text.includes("Institute:"));
  assert.equal(adapted.tables.length, 1);
  assert.equal(adapted.tables[0].length, 1);
  const row = adapted.tables[0][0];
  assert.equal(row.Institute, "School of Engineering and Sciences");
  assert.equal(row.Address, "Neerukonda, Mangalagiri");
  assert.equal(row["Transport Registration"], "You are not registered to Transport");
  assert.ok(!row.Actions);
  assert.ok(adapted._extracted);
  assert.equal(adapted.meta.extractorType, "transport-registration-ack");
  assert.equal(adapted.meta.usedTargetedExtractor, true);
});