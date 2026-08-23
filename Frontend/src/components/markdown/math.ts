import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { MathPlugin } from "streamdown";

/**
 * Math rendering for the app-wide markdown renderer.
 *
 * Streamdown's `plugins.math` extension point runs remark-math after its
 * default parsers and rehype-katex AFTER sanitization, so KaTeX markup is
 * never stripped. KaTeX's stylesheet is imported statically in
 * `styles/markdown.css` so fonts are bundled by Vite.
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

/**
 * Reliable markers that a span is TeX rather than money: backslash commands,
 * braces, sub/superscripts, or comparison/arithmetic operators. Hyphen is
 * deliberately excluded so price ranges ("$100 - $200") stay literal.
 */
const TEX_HINT = /\\[a-zA-Z]|[{}^_=+*/<>]/;

/** Amounts like "$100", "$1,200/month", "$99.99" — not equations. */
const MONEY_START = /^\s*\d/;

export interface ProtectedRegion {
  start: number;
  end: number;
}

/**
 * Find regions that must never be math-transformed: fenced code blocks
 * (``` or ~~~) and inline code spans (`…`). Ranges are half-open.
 */
function findProtectedRegions(source: string): ProtectedRegion[] {
  const regions: ProtectedRegion[] = [];
  // Fenced blocks: line-anchored ``` or ~~~ fences.
  const fence = /^[ \t]*(`{3,}|~{3,})/gm;
  let open: { markerChar: string; contentStart: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(source)) !== null) {
    const markerChar = match[1][0];
    if (!open) {
      open = { markerChar, contentStart: match.index + match[0].length };
    } else if (markerChar === open.markerChar) {
      regions.push({ start: open.contentStart, end: match.index });
      open = null;
    }
  }
  if (open) {
    // Unterminated fence — protect through end of input.
    regions.push({ start: open.contentStart, end: source.length });
    return regions;
  }
  // Inline code spans: `…`, ``…`` etc.
  const span = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;
  while ((match = span.exec(source)) !== null) {
    regions.push({ start: match.index, end: match.index + match[0].length });
  }
  return regions;
}

function inProtected(index: number, regions: ProtectedRegion[]): boolean {
  return regions.some((r) => index >= r.start && index < r.end);
}

interface DollarToken {
  index: number;
  length: number;
  display: boolean;
}

function scanDollars(source: string, ranges: ProtectedRegion[]): DollarToken[] {
  const tokens: DollarToken[] = [];
  const re = /\$\$|\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (!inProtected(m.index, ranges)) {
      tokens.push({
        index: m.index,
        length: m[0].length,
        display: m[0] === "$$",
      });
    }
  }
  return tokens;
}

/**
 * Promote one-line display math to the fenced flow form remark-math needs:
 * "$$x$$" alone on a line becomes
 * $$
 * x
 * $$
 * so it renders as a centered display block instead of inline math.
 */
function promoteFlowMath(source: string, ranges: ProtectedRegion[]): string {
  const lineRe = /^[ \t]*\$\$(?!\s)([^$\n]+?)(?<!\s)\$\$[ \t]*$/gm;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(source)) !== null) {
    if (inProtected(m.index, ranges)) continue;
    out += source.slice(last, m.index);
    out += `$$\n${m[1]}\n$$`;
    last = m.index + m[0].length;
  }
  if (last === 0) return source;
  out += source.slice(last);
  return out;
}

/**
 * Normalize math delimiters before markdown parsing:
 *
 * 1. Pandoc-style `\(...\)` and `\[...\]` become `$…$` / `$$…$$`.
 * 2. Standalone one-line `$$…$$` is promoted to the fenced flow form so it
 *    renders as a centered display block.
 * 3. Currency guard: single-dollar pairs with NO TeX markers whose content
 *    starts with a digit ("$100 and $200") are escaped so they render as
 *    literal dollars instead of being parsed as broken equations.
 *    Real math ($v$, $\alpha_i$, $E=mc^2$, $5x$) is left untouched.
 *
 * Code fences and inline code spans are always left untouched.
 */
export function normalizeMathSource(source: string): string {
  if (!source || !/[$\\]/.test(source)) return source;

  // Pass 1: \( … \) → $ … $ and \[ … \] → $$ … $$
  const pass1Ranges = findProtectedRegions(source);
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (inProtected(i, pass1Ranges)) {
      out += source[i];
      i += 1;
      continue;
    }
    const paren = source.startsWith("\\(", i);
    const bracket = !paren && source.startsWith("\\[", i);
    if (paren || bracket) {
      const closer = paren ? "\\)" : "\\]";
      const end = source.indexOf(closer, i + 2);
      if (end > -1) {
        const inner = source.slice(i + 2, end);
        out += `${paren ? "$" : "$$"}${inner}${paren ? "$" : "$$"}`;
        i = end + closer.length;
        continue;
      }
    }
    out += source[i];
    i += 1;
  }

  // Pass 2: promote standalone one-line $$…$$ to fenced flow (display) form.
  const flowRanges = findProtectedRegions(out);
  out = promoteFlowMath(out, flowRanges);

  // Pass 3: escape money-like single-$ pairs so remark-math ignores them.
  const pass2Ranges = findProtectedRegions(out);
  const tokens = scanDollars(out, pass2Ranges);

  let result = "";
  let copiedUpTo = 0;
  let k = 0;
  while (k < tokens.length) {
    const tok = tokens[k];

    if (tok.display) {
      const closeIdx = tokens.findIndex((t, j) => j > k && t.display);
      if (closeIdx === -1) break; // unbalanced $$ — leave rest verbatim
      result += out.slice(copiedUpTo, tokens[closeIdx].index + 2);
      copiedUpTo = tokens[closeIdx].index + 2;
      k = closeIdx + 1;
      continue;
    }

    const nextSingleIdx = (() => {
      for (let j = k + 1; j < tokens.length; j++) {
        if (!tokens[j].display) return j;
      }
      return -1;
    })();
    if (nextSingleIdx === -1) break; // lone $ — remark-math ignores it anyway

    const openerEnd = tok.index + 1;
    const closerStart = tokens[nextSingleIdx].index;
    const inner = out.slice(openerEnd, closerStart);
    if (!TEX_HINT.test(inner) && MONEY_START.test(inner)) {
      result += `${out.slice(copiedUpTo, tok.index)}\\$${inner}\\$`;
      copiedUpTo = closerStart + 1;
    } else {
      // Real math — copy through the closing delimiter untouched.
      result += out.slice(copiedUpTo, closerStart + 1);
      copiedUpTo = closerStart + 1;
    }
    k = nextSingleIdx + 1;
  }
  result += out.slice(copiedUpTo);
  return result;
}
