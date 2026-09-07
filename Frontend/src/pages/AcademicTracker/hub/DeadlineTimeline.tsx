/**
 * DeadlineTimeline.tsx — the merged "what's coming up" list (Batch B12).
 * Renders nothing until there's something to show, so it's safe to mount
 * anywhere in the Academic Hub.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarClock, GraduationCap, Briefcase, CalendarDays, BookOpen } from "lucide-react";
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { getDeadlines, relativeDue, sourceLabel, type DeadlineSource } from "../../../lib/core/deadlines";
import { hasSessionAuth } from "../../../lib/core/session";
import { isStaticPrototype } from "../../../lib/core/prototype";

const ICON: Record<DeadlineSource, typeof CalendarClock> = {
  classroom: BookOpen,
  opportunity: Briefcase,
  event: CalendarDays,
  "academic-calendar": GraduationCap,
};

export function DeadlineTimeline() {
  const enabled = hasSessionAuth() && !isStaticPrototype();
  const { data, isPending } = useQuery({
    queryKey: ["deadlines", 60],
    queryFn: () => getDeadlines({ horizonDays: 60 }),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!enabled) return null;
  const items = data?.items ?? [];
  if (!isPending && items.length === 0) return null;

  const classroomOk = data?.sources.classroom === "ok";

  return (
    <SectionCard title="Coming up">
      <p className="mb-3 flex items-center gap-1.5 text-xs text-[var(--comp-text-muted)]">
        <CalendarClock className="h-3.5 w-3.5" />
        Deadlines and dates across your saved opportunities, events, the academic calendar
        {classroomOk ? ", and Google Classroom" : ""}.
      </p>

      {isPending ? (
        <p className="text-sm text-[var(--comp-text-muted)]">Loading…</p>
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0">
          {items.slice(0, 12).map((item) => {
            const Icon = ICON[item.source] ?? CalendarClock;
            const rel = relativeDue(item.dueAt);
            const soon = Date.parse(item.dueAt) - Date.now() < 3 * 86_400_000;
            const inner = (
              <div className="flex items-start gap-3 rounded-lg border border-[var(--comp-border)] p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--comp-accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--comp-text-primary)]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
                    {sourceLabel(item.source)}
                    {item.meta?.course ? ` · ${item.meta.course}` : ""} ·{" "}
                    {new Date(item.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: soon
                      ? "color-mix(in srgb, var(--warning) 16%, transparent)"
                      : "var(--comp-surface-hover)",
                    color: soon ? "var(--warning)" : "var(--comp-text-secondary)",
                  }}
                >
                  {rel}
                </span>
              </div>
            );
            return (
              <li key={item.id}>
                {item.link && item.link.startsWith("/") ? (
                  <Link to={item.link} className="block no-underline">
                    {inner}
                  </Link>
                ) : item.link ? (
                  <a href={item.link} target="_blank" rel="noreferrer" className="block no-underline">
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

