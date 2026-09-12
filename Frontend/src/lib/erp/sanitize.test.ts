import { describe, expect, it } from "vitest";
import { extractSections } from "./sanitize";

describe("extractSections — leaked-code salvage", () => {
  it("keeps the real notice sentence when it is glued to a JS redirect call", () => {
    const sections = extractSections({
      "sap/sap-process": {
        data: {
          SAP: {
            "SAP Process": {
              title: "SAP REGISTRATION",
              text:
                "SAP Registration function redirectSapRegistration() { funLoadDetails(44); } " +
                "Note: Students will be allowed to register one time, hence, please select carefully. " +
                "SAP REGISTRATION ..... redirectSapRegistration();",
              tables: [],
            },
          },
        },
      },
    });

    expect(sections.length).toBeGreaterThan(0);
    const combined = sections.map((s) => s.text).join(" ");
    expect(combined).toMatch(/Students will be allowed to register one time/i);
    expect(combined).not.toMatch(/function/i);
    expect(combined).not.toMatch(/redirectSapRegistration\(\)/);
  });

  it("keeps the real notice sentence even when a literal 'Loading.........' stub is glued next to it", () => {
    const sections = extractSections({
      "sap/sap-process": {
        data: {
          SAP: {
            "SAP Process": {
              title: "SAP REGISTRATION",
              text:
                "SAP Registration Note: Students will be allowed to register one time, hence, please select carefully. " +
                "SAP REGISTRATION Loading.........",
              tables: [],
            },
          },
        },
      },
    });

    expect(sections.length).toBeGreaterThan(0);
    const combined = sections.map((s) => s.text).join(" ");
    expect(combined).toMatch(/Students will be allowed to register one time/i);
    expect(combined).not.toMatch(/Loading\.{2,}/i);
  });

  it("keeps the real status sentence when it is buried in leaked CSS/jQuery", () => {
    const sections = extractSections({
      "sap/withdraw": {
        data: {
          SAP: {
            Withdraw: {
              title: "",
              text:
                '.alert-danger { color: red;font-weight: bolder;font-size: x-large;} ' +
                '.alert-success { color: green;font-weight: bolder;font-size: x-large;font-family: monospace} ' +
                'var url = "students/registrations/sapregistrationresource.jsp"; ' +
                'var frmtitle = "SEMESTER ABROAD PROGRAM"; ' +
                '$(function () { $(".divmsg").hide(); $(".btWithdraw").on("click", funWithdraw); }); ' +
                'function funWithdraw() { if ($.trim($("#studentremarks").val()) === "") { ' +
                'superAlert(frmtitle, "Fill Remarks", "", "#divAlert"); return false; } ' +
                'var confirm = window.confirm("Wish to Withdraw?"); if (!confirm) return; ' +
                "SAP WITHDRAW You are not registered with SAP.",
              tables: [],
            },
          },
        },
      },
    });

    expect(sections.length).toBeGreaterThan(0);
    const combined = sections.map((s) => s.text).join(" ");
    expect(combined).toMatch(/You are not registered with SAP/i);
    expect(combined).not.toMatch(/superAlert|function|\$\(/i);
  });

  it("still discards text that is pure leaked code with no salvageable prose", () => {
    const sections = extractSections({
      "x/y": {
        data: {
          Section: {
            title: "",
            text: '$(document).ready(function () { $(".x").hide(); var a = 1; if (a === 1) { alert("hi"); } });',
            tables: [],
          },
        },
      },
    });

    expect(sections.length).toBe(0);
  });
});
