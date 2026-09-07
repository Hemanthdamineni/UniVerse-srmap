const test = require("node:test");
const assert = require("node:assert/strict");

const { loadHtml, stripNonContent } = require("../src/services/erp/extractors/loadHtml");
const { extractGenericTable } = require("../src/services/erp/extractors/extractGenericTable");

// A realistic SRM ERP page: real table content, plus the inline <script> and
// <style> the ERP puts on every page. The script/style bodies contain words
// ("CGPA", "submitted") that a naive $.root().text() scrape would surface as
// body copy.
const PAGE_WITH_INLINE_CODE = `
<html>
  <head>
    <style>
      .cgpa-widget { float: right; font-size: 12px; }
      body { background: #fff; }
    </style>
    <script>
      function loadCgpa() { var x = jQuery('#cgpa'); $.ajax({ url: '/cgpa', success: function(r){ console.log('submitted', r); } }); }
      window.onload = loadCgpa;
    </script>
  </head>
  <body>
    <h2>COURSE REGISTRATION</h2>
    <table>
      <thead><tr><th>Code</th><th>Subject</th><th>Credits</th></tr></thead>
      <tbody>
        <tr><td>CSE101</td><td>Data Structures</td><td>4</td></tr>
        <tr><td>MAT201</td><td>Linear Algebra</td><td>3</td></tr>
      </tbody>
    </table>
    <script>document.write('<span>dynamic</span>');</script>
  </body>
</html>
`;

// Signals that body copy has been contaminated with JS/CSS source.
const CODE_SIGNALS = [
  /\bfunction\s*\w*\s*\(/,
  /\bvar\s+\w+\s*=/,
  /jQuery\(|\$\.ajax|\$\(['"#]/,
  /console\.(log|debug)/,
  /\{[^{}]*:[^{}]*;[^{}]*\}/, // css rule body
  /window\.onload|document\.write/,
];

function assertNoCode(value, where) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const signal of CODE_SIGNALS) {
    assert.ok(
      !signal.test(text),
      `${where} leaked code-like text matching ${signal}: ${text.slice(0, 200)}`,
    );
  }
}

test("loadHtml removes script/style/noscript and comment nodes", () => {
  const $ = loadHtml(`
    <style>.x{color:red}</style>
    <script>alert(1)</script>
    <noscript>no js</noscript>
    <!-- <script>alert(2)</script> -->
    <div id="keep">content</div>
  `);
  assert.equal($("script").length, 0);
  assert.equal($("style").length, 0);
  assert.equal($("noscript").length, 0);
  assert.equal($("#keep").text(), "content");
  assertNoCode($.root().text(), "loadHtml $.root().text()");
});

test("stripNonContent is idempotent and returns the same $", () => {
  const cheerio = require("cheerio");
  const $ = cheerio.load("<script>x()</script><p>hi</p>");
  const a = stripNonContent($);
  const b = stripNonContent(a);
  assert.equal(a, $);
  assert.equal(b, $);
  assert.equal($("p").text(), "hi");
});

test("extractGenericTable does not surface inline JS/CSS as text", () => {
  const result = extractGenericTable(PAGE_WITH_INLINE_CODE, "COURSE REGISTRATION");

  assert.equal(result.type, "generic-table");
  assert.equal(result.title, "COURSE REGISTRATION");
  assertNoCode(result.text, "extractGenericTable .text");
  assertNoCode(result.tables, "extractGenericTable .tables");
  assertNoCode(result, "extractGenericTable full result");

  // The real table content still comes through.
  const flat = JSON.stringify(result.tables);
  assert.ok(flat.includes("Data Structures"), "real row content preserved");
  assert.ok(flat.includes("CSE101"), "real code cell preserved");
});
