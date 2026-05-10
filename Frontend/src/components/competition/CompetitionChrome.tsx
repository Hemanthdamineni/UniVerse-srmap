import { useRef, type ReactNode } from "react";
import { FileCheck2 } from "lucide-react";
import { usePageContrast } from "../../hooks/usePageContrast";
import { PageContainer } from "../layout/PageLayouts";

type ShellVariant = "default" | "wide" | "focus";

export function CompetitionPageShell({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
  variant = "default",
}: {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: ShellVariant;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  usePageContrast(shellRef, [title, subtitle, eyebrow, variant]);

  return (
    <div ref={shellRef} className={`competition-page-shell competition-page-shell-${variant}`}>
      <PageContainer
        className={
          variant === "focus"
            ? "max-w-[980px] space-y-4"
            : variant === "wide"
              ? "max-w-full space-y-4"
              : "max-w-[1280px] space-y-4"
        }
      >
        {(title || subtitle || actions || eyebrow) ? (
          <div className="competition-page-header" data-page-contrast="true">
            <div>
              {eyebrow ? <p className="competition-eyebrow">{eyebrow}</p> : null}
              {title ? <h1 className="page-title">{title}</h1> : null}
              {subtitle ? <p className="body-text">{subtitle}</p> : null}
            </div>
            {actions ? <div className="competition-page-actions">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </PageContainer>
    </div>
  );
}

export function CompetitionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`competition-card dashboard-card ${className}`}>{children}</section>;
}

export function CompetitionEmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <CompetitionCard className="competition-empty-panel">
      <FileCheck2 size={30} />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </CompetitionCard>
  );
}
