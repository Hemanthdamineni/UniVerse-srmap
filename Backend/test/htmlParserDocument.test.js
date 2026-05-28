const test = require("node:test");
const assert = require("node:assert/strict");

const { parseHtmlContent } = require("../src/services/htmlParser");

test("builds a document tree for tables, forms, and mixed content", () => {
  const html = `
    <div id="divContent">
      <h2>Sample Page</h2>
      <p>Welcome back</p>
      <table>
        <tr><th>Name</th><th>Status</th></tr>
        <tr><td>Alice</td><td>Active</td></tr>
      </table>
      <form method="post" action="/submit">
        <label for="username">Username</label>
        <input id="username" name="username" value="demo" />
        <button type="submit">Save</button>
      </form>
    </div>
  `;

  const parsed = parseHtmlContent(html);

  assert.equal(parsed.title, "Sample Page");
  assert.ok(parsed.document);
  assert.equal(parsed.document.title, "Sample Page");
  assert.equal(parsed.document.root.type, "container");
  assert.equal(parsed.document.root.props.variant, "section");
  assert.ok(Array.isArray(parsed.document.root.children));

  const childTypes = parsed.document.root.children.map((child) => child.type);
  assert.ok(childTypes.includes("text"));
  assert.ok(childTypes.includes("table"));
  assert.ok(childTypes.includes("form"));

  const tableNode = parsed.document.root.children.find((child) => child.type === "table");
  assert.deepEqual(tableNode.props.columns, [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
  ]);
  assert.equal(tableNode.props.rows.length, 1);
  assert.equal(tableNode.props.rows[0].key, "alice-active");
  assert.deepEqual(tableNode.props.rows[0].values, { name: "Alice", status: "Active" });

  const formNode = parsed.document.root.children.find((child) => child.type === "form");
  assert.equal(formNode.props.method, "POST");
  assert.equal(formNode.props.title, "");
  assert.ok(formNode.children.some((child) => child.type === "field"));
  assert.ok(formNode.children.some((child) => child.type === "button"));

  const buttonNode = formNode.children.find((child) => child.type === "button");
  assert.deepEqual(buttonNode.props.action, {
    type: "submit_form",
    target: "/submit",
    method: "POST",
    onSuccess: "reload_page",
  });
});

test("merges adjacent text nodes and flattens noisy containers", () => {
  const html = `
    <div id="divContent">
      <div>
        Hello
        <span>world</span>
      </div>
      <div><div><p>Nested text</p></div></div>
    </div>
  `;

  const parsed = parseHtmlContent(html);
  const textNodes = parsed.document.root.children.filter((child) => child.type === "text");

  assert.equal(textNodes.length, 2);
  assert.equal(textNodes[0].props.text, "Hello world");
  assert.equal(textNodes[1].props.text, "Nested text");
});

test("creates a safe fallback document for empty pages", () => {
  const parsed = parseHtmlContent(`<div id="divContent"></div>`);

  assert.equal(parsed.document.root.type, "container");
  assert.equal(parsed.document.root.children.length, 1);
  assert.equal(parsed.document.root.children[0].type, "text");
  assert.equal(parsed.document.root.children[0].props.text, "No content available.");
});

test("converts form-like tables into form nodes", () => {
  const html = `
    <div id="divContent">
      <h2>Bank Details</h2>
      <table>
        <tr><td>Beneficiary Name*</td><td><input name="beneficiaryName" value="Student" /></td></tr>
        <tr><td>Bank Name*</td><td><select name="bankName"><option value="SBI" selected>SBI</option></select></td></tr>
        <tr><td>Save</td><td><button type="submit">Save</button></td></tr>
      </table>
    </div>
  `;

  const parsed = parseHtmlContent(html);
  const formNode = parsed.document.root.children.find((child) => child.type === "form");

  assert.ok(formNode);
  assert.equal(formNode.children.filter((child) => child.type === "field").length, 2);
  assert.equal(formNode.children.filter((child) => child.type === "button").length, 1);

  const fieldLabels = formNode.children
    .filter((child) => child.type === "field")
    .map((child) => child.props.label);
  assert.deepEqual(fieldLabels, ["Beneficiary Name*", "Bank Name*"]);
});

test("recovers exam selection tables as actionable form controls", () => {
  const html = `
    <div id="divContent">
      <h2>Exam Application Details</h2>
      <table>
        <td>Exam Month And Year</td>
        <td>
          <select name="cmbExamMonth" id="cmbExamMonth">
            <option value="0,0,0">[Select Exam Month And Year]</option>
            <option value="12,2025,14688">DECEMBER 2025</option>
          </select>
        </td>
        <tr>
          <td colspan="2"><button onclick="funPrintApplication()">Print</button></td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseHtmlContent(html);
  const formNode = parsed.document.root.children.find((child) => child.type === "form");

  assert.ok(formNode);
  assert.equal(formNode.children.length, 2);

  const fieldNode = formNode.children.find((child) => child.type === "field");
  assert.equal(fieldNode.props.name, "cmbExamMonth");
  assert.equal(fieldNode.props.inputType, "select");
  assert.deepEqual(fieldNode.props.options[1], {
    label: "DECEMBER 2025",
    value: "12,2025,14688",
    selected: false,
  });

  const buttonNode = formNode.children.find((child) => child.type === "button");
  assert.equal(buttonNode.props.label, "Print");
  assert.deepEqual(buttonNode.props.action, {
    type: "print_exam_application",
    target: "/srmapstudentcorner/students/report/PrintStudentExamApplication.jsp",
    method: "GET",
    onSuccess: "no_update",
  });
});

test("normalizes interactive table cells into safe display values", () => {
  const html = `
    <div id="divContent">
      <h2>Payment Acknowledgment</h2>
      <table>
        <tr><th>Receipt</th><th>Action</th></tr>
        <tr>
          <td>Seas/123</td>
          <td><input type="button" value="Print" onclick="window.open('students/fee/receipt.jsp?id=1')" /></td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseHtmlContent(html);
  const tableNode = parsed.document.root.children.find((child) => child.type === "table");

  assert.ok(tableNode);
  assert.equal(tableNode.props.rows.length, 1);
  assert.equal(tableNode.props.rows[0].values.receipt, "Seas/123");
  assert.equal(tableNode.props.rows[0].values.action, "Print");
});
