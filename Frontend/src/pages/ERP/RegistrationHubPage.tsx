/**
 * RegistrationHubPage.tsx — one destination for every ERP registration flow
 * (Batch B14 / Story 5.1). Replaces six separate sidebar entries with a single
 * tabbed page: Course · Hostel · Transport · Exam · Minor/OE · SAP.
 *
 * Each tab reuses the existing `RegistrationErpPage` renderer against its
 * blueprint, so live data, refresh, and the "submit on the official portal"
 * guidance all keep working. Deep-linkable via `?tab=hostel`.
 */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageLayouts";
import { PageHeader } from "../../components/ui/Layouts";
import { SegmentedControl } from "../../components/ui";
import RegistrationErpPage from "./RegistrationErpPage";
import { PAGE_BLUEPRINTS } from "../../config/erpBlueprints";
import type { PageBlueprint } from "../../config/erpBlueprints";

type TabKey = "course" | "hostel" | "transport" | "exam" | "minor-oe" | "sap";

const TAB_ROUTES: Record<TabKey, string> = {
  course: "/registration/course-registration",
  hostel: "/registration/hostel-registration",
  transport: "/registration/transport-registration",
  exam: "/registration/exam-registration",
  "minor-oe": "/registration/minor-oe-registration",
  sap: "/registration/sap-registration",
};

const TAB_LABELS: Record<TabKey, string> = {
  course: "Course",
  hostel: "Hostel",
  transport: "Transport",
  exam: "Exam",
  "minor-oe": "Minor / OE",
  sap: "SAP",
};

// Fallbacks so the hub renders even if a blueprint is renamed/removed later.
const FALLBACK_FETCH_KEYS: Record<TabKey, string[]> = {
  course: ["academic/course-registration", "academic/course-registration-cancellation"],
  hostel: ["hostel/hostel-booking-for-full-year"],
  transport: ["transport/transport-registration", "transport/registration-acknowledgment"],
  exam: ["examination/exam-registration", "examination/exam-registration-details"],
  "minor-oe": ["academic/minor-program-registration"],
  sap: ["sap/sap-process"],
};

function blueprintFor(tab: TabKey): PageBlueprint {
  const route = TAB_ROUTES[tab];
  const found = (PAGE_BLUEPRINTS as Record<string, PageBlueprint>)[route];
  if (found) return found;
  return {
    route,
    heading: `${TAB_LABELS[tab]} Registration`,
    fetchKeys: FALLBACK_FETCH_KEYS[tab],
    loadingMessage: `Loading ${TAB_LABELS[tab].toLowerCase()} registration…`,
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "document",
  } as PageBlueprint;
}

const TAB_ORDER: TabKey[] = ["course", "hostel", "transport", "exam", "minor-oe", "sap"];

function isTabKey(value: string | null): value is TabKey {
  return value != null && (TAB_ORDER as string[]).includes(value);
}

export default function RegistrationHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const activeTab: TabKey = isTabKey(raw) ? raw : "course";

  const blueprint = useMemo(() => blueprintFor(activeTab), [activeTab]);

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Registration"
        subtitle="Course, hostel, transport, exam, minor/OE and SAP registration — all in one place."
      />

      <SegmentedControl<TabKey>
        ariaLabel="Registration sections"
        fluid
        value={activeTab}
        onChange={(key) => {
          setSearchParams(
            (prev) => {
              prev.set("tab", key);
              return prev;
            },
            { replace: true },
          );
        }}
        options={TAB_ORDER.map((key) => ({ value: key, label: TAB_LABELS[key] }))}
      />

      {/* RegistrationErpPage brings its own ErpPageShell + section heading; the
          hub just supplies the tab chrome around it. `key` forces a clean
          remount (and fresh query) when the tab changes. */}
      <RegistrationErpPage key={activeTab} blueprint={blueprint} />
    </PageContainer>
  );
}
