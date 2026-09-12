const test = require("node:test");
const assert = require("node:assert/strict");
const { buildGuidePdfHtml } = require("../src/routes/lmsRoutes");

test("guide PDF HTML treats guide content as text, not executable markup", () => {
  const html = buildGuidePdfHtml({
    title: `<img src="http://169.254.169.254/latest/meta-data">`,
    description: `<script>fetch('https://evil.example')</script>`,
    sections: [{ title: "<b>Unit</b>", content: `<iframe src="http://localhost"></iframe>` }],
  });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;iframe/);
  assert.doesNotMatch(html, /<script>|<iframe|<img src=/i);
  assert.match(html, /default-src 'none'/);
});
