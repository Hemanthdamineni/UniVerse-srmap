import { Streamdown } from "streamdown";
import type { MathPlugin } from "streamdown";
import type { ComponentProps } from "react";
import { memo, useEffect, useMemo, useState } from "react";

import { cn } from "../../lib/core/utils";
import { ChatStreamingProvider } from "./CodeBlock";
import { MarkdownCode } from "./MarkdownCode";
import { MarkdownLink } from "./MarkdownLink";
import { normalizeMathSource } from "./mathNormalize";
import { hasMath } from "./mathDetect";

export type MarkdownProps = Omit<ComponentProps<typeof Streamdown>, "components"> & {
  /** True while content is still arriving (AI/chat surfaces). Renders
   * incomplete-markdown repair plus shimmering code placeholders. */
  streaming?: boolean;
};

const markdownComponents = { a: MarkdownLink, code: MarkdownCode };

const EMPTY_PLUGINS = {} as const;

// Cache the resolved plugin across every <Markdown> instance so the KaTeX
// chunk + stylesheet are fetched at most once per session.
let cachedMathPlugin: MathPlugin | null = null;
let mathLoad: Promise<MathPlugin> | null = null;
function loadMathPlugin(): Promise<MathPlugin> {
  if (cachedMathPlugin) return Promise.resolve(cachedMathPlugin);
  if (!mathLoad) {
    mathLoad = Promise.all([import("./math"), import("katex/dist/katex.min.css")]).then(([mod]) => {
      cachedMathPlugin = mod.mathPlugin;
      return cachedMathPlugin;
    });
  }
  return mathLoad;
}

/**
 * Load the KaTeX math plugin only when the source actually contains an
 * equation. Markdown without math (the overwhelming majority — course notes,
 * READMEs, chat) never pulls the KaTeX chunk (B2 / T8.2.1).
 */
function useMathPlugin(source: unknown): MathPlugin | null {
  const needsMath = typeof source === "string" && hasMath(source);
  const [plugin, setPlugin] = useState<MathPlugin | null>(cachedMathPlugin);

  useEffect(() => {
    if (!needsMath || plugin) return;
    let alive = true;
    void loadMathPlugin().then((p) => {
      if (alive) setPlugin(p);
    });
    return () => {
      alive = false;
    };
  }, [needsMath, plugin]);

  return needsMath ? plugin : null;
}

/**
 * App-wide markdown renderer. Ported from the terax renderer: streamdown
 * engine, Lezer-highlighted code blocks with copy chrome, shell command
 * cards, KaTeX math (inline `$…$`, display `$$…$$`, and Pandoc `\(…\)` /
 * `\[…\]` forms), and theme-token styling in both light and dark mode.
 *
 * Static by default — pass `streaming` only when content grows over time.
 */
export const Markdown = memo(
  ({ className, streaming = false, children, ...props }: MarkdownProps) => {
    const source = typeof children === "string" ? normalizeMathSource(children) : children;
    const mathPlugin = useMathPlugin(source);
    const plugins = useMemo(
      () => (mathPlugin ? { math: mathPlugin } : EMPTY_PLUGINS),
      [mathPlugin],
    );
    return (
      <ChatStreamingProvider value={streaming}>
        <Streamdown
          className={cn(
            "md-doc select-text",
            "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            className,
          )}
          components={markdownComponents}
          plugins={plugins}
          mode={streaming ? "streaming" : "static"}
          parseIncompleteMarkdown={streaming}
          {...props}
        >
          {source}
        </Streamdown>
      </ChatStreamingProvider>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.streaming === nextProps.streaming &&
    nextProps.isAnimating === prevProps.isAnimating,
);

Markdown.displayName = "Markdown";
