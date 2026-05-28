import DocumentErpPage from "../ERP/DocumentErpPage";
import { CompetitionPageShell } from "../../components/competition/CompetitionChrome";

export default function EventAttendance() {
  return (
    <CompetitionPageShell
      title="Event Attendance"
      subtitle="ERP attendance records for university events."
      variant="wide"
    >
      <DocumentErpPage blueprint={{
        route: "/events/attendance",
        heading: "Event Attendance",
        fetchKeys: ["events/event-attendance"],
        domain: "erp",
        sourceMode: "erp",
        integrationState: "native",
        renderer: "document",
        loadingMessage: "Loading event attendance...",
      }} />
    </CompetitionPageShell>
  );
}
