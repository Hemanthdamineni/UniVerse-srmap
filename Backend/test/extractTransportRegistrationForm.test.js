const test = require("node:test");
const assert = require("node:assert/strict");

const { extractTransportRegistrationForm } = require("../src/services/erp/extractors/extractTransportRegistrationForm");
const { adaptToLegacyPayload } = require("../src/services/erp/extractors/index");

const NOTICE_PAGE_HTML = `
  <html>
  <head>
    <style>
      hr { color: #000; }
      @page { size: A4; margin: 1cm; }
      table.myTable { border-collapse: collapse; font-family: verdana; }
    </style>
    <script>
      var url = "students/registrations/transportregistrationresources.jsp";
      function redirectTransportRegistration() { funLoadDetails(12); }
    </script>
  </head>
  <body>
    <h2>TRANSPORT REGISTRATION 2025</h2>
    <table>
      <tr><td>Please note that the Transport booking will be open soon</td></tr>
    </table>
    Note: Students will be allowed to register for one facility only.
    Transport & FAQs External resource. Open URL in browser.
  </body>
  </html>
`;

test("extractTransportRegistrationForm skips header-less notice table and keeps clean text", () => {
  const result = extractTransportRegistrationForm(NOTICE_PAGE_HTML);

  assert.equal(result.type, "generic-table");
  // The notice box is a borderless one-cell <table> — it must not be emitted
  // as a header-less table (that leaked array indices as "0" column headers).
  assert.equal(result.tables.length, 0);

  // Script/style content must be stripped from the body text.
  assert.ok(!result.text.includes("funLoadDetails"));
  assert.ok(!result.text.includes("border-collapse"));
  assert.ok(!result.text.includes("transportregistrationresources.jsp"));

  // The notice itself survives in the text channel.
  assert.ok(result.text.includes("Please note that the Transport booking will be open soon"));
  assert.ok(result.text.includes("Note: Students will be allowed to register for one facility only"));

  // The external-resource footer is removed.
  assert.ok(!result.text.includes("External resource"));
});

test("extractTransportRegistrationForm extracts headed data tables", () => {
  const html = `
    <html><body>
      <h2>TRANSPORT REGISTRATION 2025</h2>
      <table>
        <thead><tr><th>Route</th><th>Boarding Point</th></tr></thead>
        <tbody><tr><td>Route 101</td><td>Main Gate</td></tr></tbody>
      </table>
    </body></html>
  `;

  const result = extractTransportRegistrationForm(html);

  assert.equal(result.tables.length, 1);
  assert.deepEqual(result.tables[0].headers, ["Route", "Boarding Point"]);
  assert.deepEqual(result.tables[0].rows, [["Route 101", "Main Gate"]]);
});

test("extractTransportRegistrationForm reduces header-less form controls to fields", () => {
  const html = `
    <html><body>
      <h2>TRANSPORT REGISTRATION 2025</h2>
      <table>
        <tr><td>Route *</td><td><select><option selected>Gate 1</option><option>Gate 2</option></select></td></tr>
        <tr><td>Pass Type</td><td><input type="text" value="Semester" /></td></tr>
      </table>
    </body></html>
  `;

  const result = extractTransportRegistrationForm(html);

  assert.equal(result.tables.length, 1);
  assert.deepEqual(result.tables[0].headers, ["Route", "Pass Type"]);
  assert.deepEqual(result.tables[0].rows, [["Gate 1", "Semester"]]);
});

test("adaptToLegacyPayload zips generic-table array rows against headers", () => {
  const adapted = adaptToLegacyPayload({
    type: "generic-table",
    title: "TRANSPORT REGISTRATION",
    tables: [{ headers: ["Route", "Point"], rows: [["Route 101", "Main Gate"]] }],
    text: "",
  });

  assert.equal(adapted.tables.length, 1);
  assert.deepEqual(adapted.tables[0], [{ Route: "Route 101", Point: "Main Gate" }]);
  // No numeric column keys may leak into the legacy payload.
  const keys = Object.keys(adapted.tables[0][0]);
  assert.ok(keys.every((k) => !/^\d+$/.test(k)));
});

test("adaptToLegacyPayload drops header-less generic-table array rows", () => {
  const adapted = adaptToLegacyPayload({
    type: "generic-table",
    title: "TRANSPORT REGISTRATION",
    tables: [{ headers: [], rows: [["Please note that the Transport booking will be open soon"]] }],
    text: "Please note that the Transport booking will be open soon",
  });

  assert.equal(adapted.tables.length, 0);
  assert.ok(adapted.text.includes("Please note that the Transport booking will be open soon"));
});

test("adaptToLegacyPayload passes through object-row generic tables untouched", () => {
  const rows = [{ Route: "Route 101", Point: "Main Gate" }];
  const adapted = adaptToLegacyPayload({
    type: "generic-table",
    title: "TRANSPORT REGISTRATION",
    tables: [{ columns: ["Route", "Point"], rows }],
    text: "",
  });

  assert.equal(adapted.tables.length, 1);
  assert.equal(adapted.tables[0][0].Route, "Route 101");
  assert.equal(adapted.tables[0][0].Point, "Main Gate");
});
