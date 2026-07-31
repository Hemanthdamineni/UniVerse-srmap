import CampusFeedbackPage from "./CampusFeedbackPage";

const CATEGORIES = ["Experience", "Organization", "Venue", "Communication", "Usefulness"] as const;

export default function EventsFeedback() {
  return (
    <CampusFeedbackPage
      title="Events Feedback"
      type="events"
      categories={CATEGORIES}
      fixedTarget={{ id: "events-overall", type: "events", label: "Campus events and activities" }}
      targetLabel="Event"
    />
  );
}
