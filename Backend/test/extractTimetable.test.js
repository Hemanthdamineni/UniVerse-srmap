const test = require("node:test");
const assert = require("node:assert/strict");

const { extractTimetable } = require("../src/services/erp/extractors/extractTimetable");

const TIMETABLE_HTML = `
  <html>
  <body>
    <h2>TIME TABLE</h2>
    <table id="tblClassTimetable">
      <tr class="timetablehead"><td>Period</td><td>1</td><td>2</td></tr>
      <tr class="subheader"><td></td><td>09:00 To 09:50</td><td>10:00 To 10:50</td></tr>
      <tr>
        <td class="subheader">Monday</td>
        <td title="Deep Learning">Cse457(C 302)(c 507)</td>
        <td></td>
      </tr>
    </table>
    <table id="tblSubjectList">
      <tr>
        <td class="subheader">Subjects Description</td>
        <td class="subheader">L-T-P-C</td>
        <td class="subheader">Faculty Name</td>
        <td class="subheader">Class Room Name</td>
        <td class="subheader">Extra</td>
      </tr>
      <tr>
        <td>Cse 457</td>
        <td>Deep Learning</td>
        <td>3-0-0-4</td>
        <td>Dr. Ravi Kant Kumar (19073)</td>
        <td>(C 302)(c 507)</td>
      </tr>
      <tr>
        <td>cse401</td>
        <td>Coding Skills - III</td>
        <td>0-0-2-1</td>
        <td>Dr. Shreeram Hudda (Temporary)</td>
        <td>APJ Block 210</td>
      </tr>
    </table>
  </body>
  </html>
`;

test("extractTimetable normalizes subject codes, faculty IDs, and room lists", () => {
  const result = extractTimetable(TIMETABLE_HTML);

  assert.equal(result.type, "timetable");
  assert.deepEqual(result.subjects[0], {
    code: "CSE 457",
    description: "Deep Learning",
    ltpc: "3-0-0-4",
    // Pure-digit employee IDs are display noise; strip them.
    faculty: "Dr. Ravi Kant Kumar",
    // Adjacent-paren room lists render as a comma list with consistent casing.
    classroom: "C 302, C 507",
  });
  // Non-digit parentheticals survive; non-paren rooms pass through untouched.
  assert.equal(result.subjects[1].faculty, "Dr. Shreeram Hudda (Temporary)");
  assert.equal(result.subjects[1].code, "CSE401");
  assert.equal(result.subjects[1].classroom, "APJ Block 210");
});

test("extractTimetable keeps the period grid combined format intact", () => {
  const result = extractTimetable(TIMETABLE_HTML);

  assert.deepEqual(result.schedule, [
    {
      day: "Monday",
      periods: ["Cse457(C 302)(c 507) — Deep Learning", ""],
    },
  ]);
  assert.deepEqual(result.timeSlots, ["09:00 To 09:50", "10:00 To 10:50"]);
});
