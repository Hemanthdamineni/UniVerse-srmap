import { describe, expect, it } from "vitest";

import { normalizeMathSource } from "./math";

describe("normalizeMathSource", () => {
  it("passes plain text through unchanged", () => {
    expect(normalizeMathSource("Hello world")).toBe("Hello world");
  });

  it("converts Pandoc \\(…\\) to $…$", () => {
    expect(normalizeMathSource("Given \\(x^2\\) here")).toBe("Given $x^2$ here");
  });

  it("converts Pandoc \\[…\\] to display math (fenced flow form)", () => {
    expect(normalizeMathSource("See:\n\\[a + b\\]")).toBe("See:\n$$\na + b\n$$");
  });

  it("leaves unmatched \\( alone", () => {
    const src = "a \\( b";
    expect(normalizeMathSource(src)).toBe(src);
  });

  it("escapes money-like pairs but keeps real math", () => {
    const money = "between $100 and $200 total";
    expect(normalizeMathSource(money)).toBe("between \\$100 and \\$200 total");

    // Letter-led or TeX-marked spans stay math.
    expect(normalizeMathSource("so $v$ holds")).toBe("so $v$ holds");
    expect(normalizeMathSource("sum $\\alpha_1$ end")).toBe("sum $\\alpha_1$ end");
    expect(normalizeMathSource("collatz $3n+1$ ends")).toBe(
      "collatz $3n+1$ ends",
    );
    expect(normalizeMathSource("rate $5x=20$ per")).toBe("rate $5x=20$ per");
  });

  it("promotes standalone one-line $$…$$ to fenced flow form", () => {
    expect(normalizeMathSource("$$E=mc^2$$")).toBe("$$\nE=mc^2\n$$");
  });

  it("does not promote inline $$…$$ inside prose", () => {
    expect(normalizeMathSource("text $$x$$ more")).toBe("text $$x$$ more");
  });

  it("never touches dollars inside fenced code blocks", () => {
    const src = "```\ncost=$100 and $200\n```";
    expect(normalizeMathSource(src)).toBe(src);
  });

  it("protects an unterminated fence through end of input", () => {
    const src = "```bash\necho $HOME";
    expect(normalizeMathSource(src)).toBe(src);
  });

  it("never touches dollars inside inline code spans", () => {
    expect(normalizeMathSource("run `pay $100 now` twice")).toBe(
      "run `pay $100 now` twice",
    );
  });

  it("handles mixed real math adjacent to money text", () => {
    // The trailing "$50" has no closing dollar — remark-math ignores lone $,
    // so it passes through verbatim.
    const out = normalizeMathSource("gain $g_i$ of $50 per unit");
    expect(out).toBe("gain $g_i$ of $50 per unit");
  });
});
