import { useNavigate } from 'react-router-dom';

function QuickLinks({ feedbackPendingCount = 0 }: { feedbackPendingCount?: number }) {
  const navigate = useNavigate();

  const quickLinks = [
    {
      name: "Timetable",
      color: "dashboard-subcard",
      path: "/academic/timetable"
    },
    {
      name: "Attendance",
      color: "dashboard-subcard",
      path: "/academic/attendance-details"
    },
    {
      name: "Internal Marks",
      color: "dashboard-subcard",
      path: "/exams/current-semester-results"
    },
    {
      name: "Fee Details",
      color: "dashboard-subcard",
      path: "/finance/fee-dues"
    },
    {
      name: "LMS",
      color: "dashboard-subcard",
      path: "/resources"
    },
    {
      name: "Feedback Assistant",
      color: feedbackPendingCount > 0 ? "dashboard-subcard ring-2 ring-amber-300" : "dashboard-subcard",
      path: "/feedback/course-feedback"
    },
  ];

  const handleLinkClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="p-2">
      <h2 className="font-bold text-lg mb-2">Quick Links</h2>
      {feedbackPendingCount > 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {feedbackPendingCount} feedback item{feedbackPendingCount === 1 ? "" : "s"} waiting for review.
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {quickLinks.map((link, index) => (
          <div
            key={index}
            onClick={() => handleLinkClick(link.path)}
            className={`${link.color} p-2 rounded-lg cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200`}
          >
            <div className="text-center">
              <p className="text-md font-medium">{link.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuickLinks;
