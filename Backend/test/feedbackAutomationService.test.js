const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseFeedbackLandingPage,
  validateOptionNumber,
} = require("../src/services/campus/feedbackServices");

test("parseFeedbackLandingPage extracts pending subjects and completion state", () => {
  const html = `
    <html>
      <body>
        <input id="feedbacktype" value="subject" />
        <input id="mcontroller" value="controller-1" />
        <table>
          <tr><td class="clsSubject" id="SUB101">Operating Systems</td></tr>
          <tr><td class="clsSubject" id="SUB102">DBMS</td></tr>
        </table>
      </body>
    </html>
  `;

  const parsed = parseFeedbackLandingPage(html);
  assert.equal(parsed.pendingSubjects.length, 2);
  assert.equal(parsed.pendingSubjects[0].id, "SUB101");
  assert.equal(parsed.feedbackType, "subject");
  assert.equal(parsed.controller, "controller-1");
  assert.equal(parsed.alreadySubmitted, false);
});

test("validateOptionNumber accepts values 1 to 5 only", () => {
  assert.equal(validateOptionNumber(5).value, "25");
  assert.throws(() => validateOptionNumber(6), /optionNo must be between 1 and 5/i);
});
