/**
 * mathDetect.ts — a cheap, dependency-free "does this markdown contain math?"
 * check so `<Markdown>` only pulls the ~300 KB (gzip) KaTeX chunk for content
 * that actually has equations (B2 / T8.2.1).
 *
 * Runs on the *normalized* source (Pandoc delimiters already turned into `$`),
 * so it only has to recognise `$$…$$` and `$…$` — and it treats a single-`$`
 * pair as math only when the span carries a TeX signal (`\`, `{}`, `^`, `_`),
 * which keeps prose like "$1,200 to $1,500" from triggering a needless load.
 */

// A `$…$` (or `$$…$$`) span whose content has a backslash command, brace, or
// sub/superscript. Deliberately loose: a false positive just loads KaTeX for
// nothing; remark-math still renders correctly (or not at all) either way.
const INLINE_MATH = /\$\$?[^$\n]*[\\{}^_][^$\n]*\$\$?/;
const DISPLAY_MATH = /\$\$[\s\S]*?\$\$/;
// Belt-and-braces: raw Pandoc delimiters, in case normalization was skipped.
const PANDOC = /\\\(|\\\[/;

export function hasMath(source: string): boolean {
  if (!source || !source.includes("$")) return PANDOC.test(source || "");
  return DISPLAY_MATH.test(source) || INLINE_MATH.test(source) || PANDOC.test(source);
}
