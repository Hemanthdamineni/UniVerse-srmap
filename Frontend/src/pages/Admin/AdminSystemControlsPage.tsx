import { Link } from "react-router-dom";
import { ErpPageShell, SectionCard } from "../../components/erp/ErpPrimitives";
import { useAdminMode } from "../../contexts/AdminModeContext";

export default function AdminSystemControlsPage() {
  const admin = useAdminMode();
  return (
    <ErpPageShell title="Admin System Controls" source="Internal API">
      <SectionCard title="Admin Mode">
        <p className="text-sm text-[var(--text-secondary)]">
          Signed in as potential admin account: <span className="font-semibold text-[var(--text-primary)]">{admin.registerNo || "Unknown"}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--status-open-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-open-text)]">
            Admin Mode Enabled
          </span>
          <button
            type="button"
            onClick={() => void admin.disable()}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
          >
            Disable Admin Mode
          </button>
        </div>
      </SectionCard>
      <SectionCard title="Quick Admin Links">
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/events-management">
            Events Management
          </Link>
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/content-management">
            Content Management
          </Link>
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/helpdesk-tickets">
            Helpdesk Tickets
          </Link>
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/helpdesk-faqs">
            Helpdesk FAQs
          </Link>
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/career-opportunities">
            Career Opportunities
          </Link>
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/career-interviews">
            Career Interviews
          </Link>
          <Link className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" to="/admin/career-alumni">
            Career Alumni
          </Link>
        </div>
      </SectionCard>
    </ErpPageShell>
  );
}
