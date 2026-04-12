const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractCgpaSummaryFromHtml,
  extractSemesterNumber,
  buildCgpaSummaryPayload,
} = require("../src/services/cgpaSummary");

test("extractCgpaSummaryFromHtml reads CGPA from the exam-mark summary block", () => {
  const html = `
    <html>
      <body>
        <div style="float: right; font-size: 20px;">CGPA : 8.91</div>
      </body>
    </html>
  `;

  const result = extractCgpaSummaryFromHtml(html);
  assert.equal(result.cgpa, "8.91");
});

test("buildCgpaSummaryPayload keeps extracted semester metadata", () => {
  const payload = buildCgpaSummaryPayload({
    cgpa: "8.91",
    semesterLabel: "Semester IV",
    semesterNumber: extractSemesterNumber("Semester IV"),
  });

  assert.equal(payload.Academic["CGPA Summary"].TableContent["Current CGPA"], "8.91");
  assert.equal(payload.Academic["CGPA Summary"].meta.semesterNumber, 4);
});
