import { describe, expect, it } from "vitest";
import { hasMath } from "./mathDetect";

describe("hasMath", () => {
  it("detects inline and display equations", () => {
    expect(hasMath("Energy: $E=mc^2$ here")).toBe(true);
    expect(hasMath("$$\\int_0^1 x\\,dx$$")).toBe(true);
    expect(hasMath("value $\\alpha_i$")).toBe(true);
  });

  it("detects raw Pandoc delimiters (normalization skipped)", () => {
    expect(hasMath("Given \\(x^2\\)")).toBe(true);
    expect(hasMath("See:\n\\[a + b\\]")).toBe(true);
  });

  it("ignores plain prose, code, and currency", () => {
    expect(hasMath("# Unit 1\n\nSome **bold** text and a list.")).toBe(false);
    expect(hasMath("Run `npm test` then `npm run build`.")).toBe(false);
    expect(hasMath("Stipend $1,200 to $1,500 per month.")).toBe(false);
    expect(hasMath("")).toBe(false);
  });
});
