import CampusFeedbackPage from "./CampusFeedbackPage";

const CATEGORIES = ["Food Quality", "Cleanliness", "Facilities", "Staff Behavior", "Maintenance"] as const;

export default function HostelMessFeedback() {
  return (
    <CampusFeedbackPage
      title="Hostel & Mess Feedback"
      type="hostel_mess"
      categories={CATEGORIES}
      fixedTarget={{ id: "hostel-mess-services", type: "hostel_mess", label: "Hostel and mess services" }}
      targetLabel="Service"
    />
  );
}
