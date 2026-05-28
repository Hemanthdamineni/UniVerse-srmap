import CampusFeedbackPage from "./CampusFeedbackPage";

const CATEGORIES = ["Experience", "Organization", "Venue", "Communication", "Usefulness"] as const;

export default function EventsFeedback() {
  return (
    <CampusFeedbackPage
      title="Events Feedback"
      type="events"
      categories={CATEGORIES}
      targetLabel="Event"
      targetEmptyMessage="No events are open for unofficial campus feedback yet."
      optionManagementLabel="Manage Event Feedback Targets"
      optionPlaceholder="Event name"
    />
  );
}
