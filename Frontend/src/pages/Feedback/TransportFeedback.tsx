import CampusFeedbackPage from "./CampusFeedbackPage";

const CATEGORIES = ["Punctuality", "Cleanliness", "Driver Behavior", "Route Coverage", "Safety"] as const;

export default function TransportFeedback() {
  return (
    <CampusFeedbackPage
      title="Transport Feedback"
      type="transport"
      categories={CATEGORIES}
      fixedTarget={{ id: "transport-overall", type: "transport", label: "Campus transport services" }}
      targetLabel="Service"
    />
  );
}
