import { useNavigate } from 'react-router-dom';
import { BookOpen, Briefcase, CalendarDays, ClipboardCheck, CreditCard, GraduationCap, Trophy } from "lucide-react";

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
    <div className="h-full p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div>
          <h2 className="card-title font-bold">Student Tasks</h2>
          <p className="mt-0.5 text-xs text-[var(--comp-text-secondary)]">Start the things students check most.</p>
        </div>
      </div>
      {feedbackPendingCount > 0 ? (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)', border: '1px solid var(--status-pending-border)' }}>
          {feedbackPendingCount} course feedback item{feedbackPendingCount === 1 ? "" : "s"} need attention.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
          <button
            key={link.path}
            type="button"
            onClick={() => handleLinkClick(link.path)}
            className="dashboard-subcard flex min-h-[58px] items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--comp-accent)]"
            style={{ transitionDuration: 'var(--transition-fast)' }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-accent)]">
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
          className={`dashboard-subcard flex min-h-[58px] items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--comp-accent)] ${feedbackPendingCount > 0 ? "ring-2 ring-amber-300" : ""}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--warning)]">
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
