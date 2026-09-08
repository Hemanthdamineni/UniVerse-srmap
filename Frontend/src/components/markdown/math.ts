import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { MathPlugin } from "streamdown";

/**
 * KaTeX plugin for the app-wide markdown renderer. This module (and
 * `katex/dist/katex.min.css`) is imported **lazily** by `Markdown.tsx` — only
 * when the source contains an equation — so math-free markdown never pays the
 * ~300 KB (gzip) cost (B2 / T8.2.1).
 *
 * Streamdown's `plugins.math` extension point runs remark-math after its
 * default parsers and rehype-katex AFTER sanitization, so KaTeX markup is
 * never stripped.
 */
export const mathPlugin: MathPlugin = {
  name: "katex",
  type: "math",
  remarkPlugin: [remarkMath],
  rehypePlugin: [
    rehypeKatex,
    {
      // Never throw on authoring mistakes — render the TeX source in red.
      throwOnError: false,
      errorColor: "#D32F2F",
      strict: false,
      trust: false,
      output: "htmlAndMathml",
      macros: {
        // Common shortcuts in university notes (only activate when written).
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\C": "\\mathbb{C}",
        "\\eps": "\\varepsilon",
      },
    },
  ],
};
