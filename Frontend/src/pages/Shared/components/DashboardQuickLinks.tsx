import { useNavigate } from "react-router-dom";
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { DASHBOARD_QUICK_LINKS, isPageVisible, PAGE_BLUEPRINTS } from "../../../config/erpBlueprints";

export default function DashboardQuickLinks() {
  const navigate = useNavigate();

  return (
    <SectionCard title="Quick Links">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {DASHBOARD_QUICK_LINKS.filter((link) => (PAGE_BLUEPRINTS[link.route] ? isPageVisible(PAGE_BLUEPRINTS[link.route]) : true)).map((link) => (
          <button
            key={link.route}
            type="button"
            onClick={() => navigate(link.route)}
            className="dashboard-subcard rounded-lg border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] px-3 py-3 text-left text-sm font-medium text-[var(--comp-text-primary)] transition hover:bg-[var(--comp-surface-hover)] hover:shadow-sm"
          >
            {link.label}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
