import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import type { BreadcrumbItem } from "@/config/navigationRegistry";

type Props = {
  items: BreadcrumbItem[];
};

export default function BreadcrumbsBar({ items }: Props) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="border-b border-[var(--border)] bg-[var(--surface)]/60 px-4 py-2 md:px-6">
      <ol className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1 text-sm text-[var(--text-secondary)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden /> : null}
              {isLast || !item.href ? (
                <span
                  className={isLast ? "font-semibold text-[var(--text-primary)]" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="rounded-sm text-[var(--text-secondary)] underline-offset-2 transition hover:text-[var(--text-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
