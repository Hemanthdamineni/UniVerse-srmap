const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizePrintableHtml } = require("../src/services/erp/erpActionExecutor");

test("sanitizePrintableHtml preserves receipt structure but removes executable and remote content", () => {
  const document = sanitizePrintableHtml(`
    <html><head><title>Receipt</title><script>globalThis.pwned = true</script></head>
    <body onload="alert(1)"><h1 onclick="alert(2)">Paid</h1>
    <img src="http://169.254.169.254/latest/meta-data"><a href="javascript:alert(3)">link</a>
    <table style="background:url(https://evil.example)"><tr><td colspan="2">₹ 100</td></tr></table></body></html>
  `);

  assert.match(document, /Paid/);
  assert.match(document, /₹ 100/);
  assert.match(document, /Content-Security-Policy/);
  assert.doesNotMatch(document, /script|onload|onclick|169\.254|javascript:|evil\.example|<img|<a\b/i);
});
