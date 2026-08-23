import { useNavigate } from 'react-router-dom';
import { BookOpen, Briefcase, CalendarDays, ClipboardCheck, CreditCard, GraduationCap, Trophy } from "lucide-react";

// Per-link accent hues echo the category dots used by CampusHub/UpcomingEvents;
// foregrounds are mixed toward text-primary to hold WCAG contrast on both themes.
const LINK_TONES: Record<string, string> = {
  "/academic/timetable": "var(--accent-blue)",
  "/academic/attendance-details": "var(--accent-green)",
  "/exams/current-semester-results": "var(--accent-yellow)",
  "/finance/fee-dues": "var(--accent-orange)",
  "/resources": "var(--accent-blue)",
  "/events": "var(--accent-orange)",
  "/career": "var(--accent-green)",
};

function toneTile(tone?: string) {
  if (!tone) return undefined;
  return {
    background: `color-mix(in srgb, ${tone} 13%, var(--comp-surface))`,
    borderColor: `color-mix(in srgb, ${tone} 26%, transparent)`,
    color: `color-mix(in srgb, ${tone} 58%, var(--comp-text-primary))`,
  };
}

function QuickLinks({ feedbackPendingCount = 0 }: { feedbackPendingCount?: number }) {
  const navigate = useNavigate();

  const quickLinks = [
    {
      name: "Today",
      description: "Open timetable",
      icon: CalendarDays,
      path: "/academic/timetable",
    },
    {
      name: "Attendance",
      description: "Check risk",
      icon: ClipboardCheck,
      path: "/academic/attendance-details",
    },
    {
      name: "Marks",
      description: "Review results",
      icon: GraduationCap,
      path: "/exams/current-semester-results",
    },
    {
      name: "Fees",
      description: "Dues and paid",
      icon: CreditCard,
      path: "/finance/fee-dues",
    },
    {
      name: "Resources",
      description: "Study material",
      icon: BookOpen,
      path: "/resources",
    },
    {
      name: "Events",
      description: "Find and register",
      icon: Trophy,
      path: "/events",
    },
    {
      name: "Career",
      description: "Apply or track",
      icon: Briefcase,
      path: "/career",
    },
  ];

  const handleLinkClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col overflow-y-auto p-4">
      <div className="mb-3 shrink-0">
        <h2 className="card-title font-semibold">Student Tasks</h2>
        <p className="mt-1 text-xs text-[var(--comp-text-secondary)]">Start the things students check most.</p>
      </div>
      {feedbackPendingCount > 0 ? (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)', border: '1px solid var(--status-pending-border)' }}>
          {feedbackPendingCount} course feedback item{feedbackPendingCount === 1 ? "" : "s"} need attention.
        </div>
      ) : null}
      <div className="grid flex-1 grid-cols-1 auto-rows-fr gap-2 @sm:grid-cols-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
          <button
            key={link.path}
            type="button"
            onClick={() => handleLinkClick(link.path)}
            className="dashboard-subcard flex min-h-14 items-center gap-2 rounded-lg px-3 py-2 text-left transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--comp-accent)]"
            style={{ transitionDuration: 'var(--duration-fast)' }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-accent)]"
              style={toneTile(LINK_TONES[link.path])}
            >
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--comp-text-primary)]">{link.name}</span>
              <span className="block truncate text-xs text-[var(--comp-text-secondary)]">{link.description}</span>
            </span>
          </button>
        );})}
        <button
          type="button"
          onClick={() => handleLinkClick("/feedback/course-feedback")}
          className={`dashboard-subcard flex min-h-14 items-center gap-2 rounded-lg px-3 py-2 text-left transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--comp-accent)] ${feedbackPendingCount > 0 ? "ring-2 ring-[color-mix(in_srgb,var(--warning)_45%,transparent)]" : ""}`}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-accent)]"
            style={feedbackPendingCount > 0 ? toneTile("var(--warning)") : undefined}
          >
            <ClipboardCheck size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--comp-text-primary)]">Feedback</span>
            <span className="block truncate text-xs text-[var(--comp-text-secondary)]">
              {feedbackPendingCount > 0 ? "Complete pending" : "Course feedback"}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

export default QuickLinks;
