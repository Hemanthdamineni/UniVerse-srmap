import type { ComponentProps, MouseEventHandler } from "react";

export type MarkdownLinkProps = ComponentProps<"a"> & {
  node?: unknown;
};

/**
 * Streamdown `components.a` override. Markdown links always open in a new
 * tab (streamdown's rehype-harden already sanitizes rel/target; this makes
 * the intent explicit and adds brand styling via the .md-doc scope).
 */
export function MarkdownLink({
  children,
  href,
  node: _node,
  onClick,
  ...props
}: MarkdownLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || !href) return;
    if (/^(https?:)?\/\//i.test(href)) {
      event.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <a {...props} href={href} onClick={handleClick} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}
