import MappedErpPage from "../ERP/MappedErpPage";
import { CompetitionPageShell } from "../../components/competition/CompetitionChrome";

export default function EventAttendance() {
  return (
    <CompetitionPageShell
      title="Event Attendance"
      subtitle="ERP attendance records for university events."
      variant="wide"
    >
      <MappedErpPage pageKey="events/event-attendance" title="Event Attendance" />
    </CompetitionPageShell>
  );
}
