import { describe, expect, it } from "vitest";

import { markdownCodeText } from "./MarkdownCode";

describe("markdownCodeText", () => {
  it("preserves text nested inside React children for HTML-wrapped code blocks", async () => {
    const React = await import("react");

    const text = markdownCodeText([
      "\n",
      React.createElement("span", { key: "a" }, 'const client = createClient("");'),
      "\n",
      React.createElement("span", { key: "b" }, 'await client.send({ id: "example" });'),
      "\n",
    ]);

    expect(text).toBe(
      '\nconst client = createClient("");\nawait client.send({ id: "example" });\n',
    );
  });

  it("returns empty string for nullish or boolean children", () => {
    expect(markdownCodeText(null)).toBe("");
    expect(markdownCodeText(undefined)).toBe("");
    expect(markdownCodeText(true)).toBe("");
  });

  it("joins arrays and flattens nested elements", async () => {
    const React = await import("react");

    const text = markdownCodeText([
      "a",
      React.createElement("b", { key: "x" }, ["b", React.createElement("i", { key: "y" }, "c")]),
      4,
    ]);
    expect(text).toBe("abc4");
  });
});
