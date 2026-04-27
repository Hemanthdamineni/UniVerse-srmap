import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  className?: string;
  items: BreadcrumbItem[];
}

export function Breadcrumb({ className, items }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center text-sm", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1 md:space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {isLast ? (
                <span className="text-[var(--comp-text-primary)] font-medium truncate max-w-[200px]">
                  {item.label}
                </span>
              ) : (
                <div className="flex items-center">
                  <Link
                    to={item.href || "#"}
                    className="text-[var(--comp-text-secondary)] hover:text-[var(--comp-text-primary)] transition-colors truncate max-w-[150px]"
                  >
                    {item.label}
                  </Link>
                  <ChevronRight className="w-4 h-4 mx-1 text-[var(--comp-text-muted)]" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
