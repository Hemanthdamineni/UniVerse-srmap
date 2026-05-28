import CampusFeedbackPage from "./CampusFeedbackPage";

const CATEGORIES = ["Punctuality", "Cleanliness", "Driver Behavior", "Route Coverage", "Safety"] as const;

export default function TransportFeedback() {
  return (
    <CampusFeedbackPage
      title="Transport Feedback"
      type="transport"
      categories={CATEGORIES}
      targetLabel="Route"
      targetEmptyMessage="No transport routes are open for unofficial campus feedback yet."
      optionManagementLabel="Manage Transport Feedback Routes"
      optionPlaceholder="Route name"
    />
  );
}
