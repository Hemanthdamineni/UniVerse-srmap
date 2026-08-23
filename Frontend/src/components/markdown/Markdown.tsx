import { Streamdown } from "streamdown";
import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
import "katex/dist/katex.min.css";

import { cn } from "../../lib/core/utils";
import { ChatStreamingProvider } from "./CodeBlock";
import { MarkdownCode } from "./MarkdownCode";
import { MarkdownLink } from "./MarkdownLink";
import { mathPlugin, normalizeMathSource } from "./math";

export type MarkdownProps = Omit<ComponentProps<typeof Streamdown>, "components"> & {
  /** True while content is still arriving (AI/chat surfaces). Renders
   * incomplete-markdown repair plus shimmering code placeholders. */
  streaming?: boolean;
};

const markdownComponents = { a: MarkdownLink, code: MarkdownCode };

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
    const plugins = useMemo(() => ({ math: mathPlugin }), []);
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
