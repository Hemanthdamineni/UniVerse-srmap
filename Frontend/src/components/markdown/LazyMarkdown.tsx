import { Suspense, lazy } from "react";
import type { MarkdownProps } from "./Markdown";

const Markdown = lazy(() => import("./Markdown").then((m) => ({ default: m.Markdown })));

// Deferred-loading variant of <Markdown/> so the KaTeX/streamdown stack only
// lands in the chunk when markdown actually renders.
export function LazyMarkdown(props: MarkdownProps) {
  return (
    <Suspense fallback={<div className="skeleton-shimmer h-24 rounded-lg" aria-hidden="true" />}>
      <Markdown {...props} />
    </Suspense>
  );
}
