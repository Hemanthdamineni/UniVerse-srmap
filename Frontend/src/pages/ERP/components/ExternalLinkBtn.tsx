/**
 * ExternalLinkBtn — shared outbound link button for ERP content pages
 * (FAQs, refund & change policies, etc.). Extracted from the byte-identical
 * copies previously duplicated in FaqsPage and RefundChangePage.
 */
export function ExternalLinkBtn({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold no-underline transition"
      style={{
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        color: 'var(--accent)',
        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 20%, transparent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {label}
    </a>
  );
}

export default ExternalLinkBtn;
