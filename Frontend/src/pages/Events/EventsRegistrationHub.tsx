import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList, FileCheck2, Users } from "lucide-react";
import { CompetitionCard, CompetitionPageShell } from "../../components/competition/CompetitionChrome";

const paths = [
  {
    title: "Discover",
    body: "Browse active platform events and register from the event detail page.",
    href: "/events",
    action: "Open events",
    icon: CalendarDays,
  },
  {
    title: "My registrations",
    body: "Track registered events, submission windows, and result-ready competitions.",
    href: "/events/my-activity?tab=registered",
    action: "View registrations",
    icon: Users,
  },
  {
    title: "My submissions",
    body: "Continue or review round submissions for events you joined.",
    href: "/events/my-activity?tab=submissions",
    action: "View submissions",
    icon: FileCheck2,
  },
  {
    title: "Organizer monitoring",
    body: "Review registrations and submissions for events you created.",
    href: "/events/my-created",
    action: "Organizer view",
    icon: ClipboardList,
  },
];

export default function EventsRegistrationHub() {
  return (
    <CompetitionPageShell
      eyebrow="Registration"
      title="Events Registration"
      subtitle="University ERP event summaries stay separate from the internal events platform."
      variant="wide"
    >
      <CompetitionCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold text-[var(--comp-text-primary)]">Platform events</h2>
            <p className="comp-body mt-1">
              Use these paths for live platform registration, round submissions, and organizer monitoring.
            </p>
          </div>
          <span className="competition-pill">Internal events platform</span>
        </div>
      </CompetitionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {paths.map((item) => {
          const Icon = item.icon;
          return (
            <CompetitionCard key={item.href} className="flex h-full flex-col gap-3 p-5">
              <Icon size={24} className="text-[var(--comp-accent)]" />
              <div className="min-h-[88px]">
                <h2 className="m-0 text-base font-semibold text-[var(--comp-text-primary)]">{item.title}</h2>
                <p className="comp-body mt-1">{item.body}</p>
              </div>
              <Link className="comp-btn-primary mt-auto" to={item.href}>
                {item.action}
              </Link>
            </CompetitionCard>
          );
        })}
      </div>

      <CompetitionCard className="p-5">
        <h2 className="m-0 text-lg font-semibold text-[var(--comp-text-primary)]">ERP registration summary</h2>
        <p className="comp-body mt-1">
          Legacy ERP event-registration data is reference-only here. Platform registrations and submissions are
          managed through `/events`.
        </p>
      </CompetitionCard>
    </CompetitionPageShell>
  );
}
