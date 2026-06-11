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
    {
      name: "Helpdesk",
      color: "dashboard-subcard",
      path: "/helpdesk/raise-ticket"
    },
  ];

  const handleLinkClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="h-full p-3">
      <h2 className="card-title font-bold mb-2.5">Quick Links</h2>
      {feedbackPendingCount > 0 ? (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--status-pending-bg)', color: 'var(--status-pending-text)', border: '1px solid var(--status-pending-border)' }}>
          {feedbackPendingCount} feedback item{feedbackPendingCount === 1 ? "" : "s"} waiting for review.
        </div>
      ) : null}
      <div className="flex h-[calc(100%-2.25rem)] flex-col gap-1.5">
        {quickLinks.map((link, index) => (
          <div
            key={index}
            onClick={() => handleLinkClick(link.path)}
            className={`${link.color} flex min-h-[30px] items-center justify-center rounded-lg px-2 py-1.5 cursor-pointer hover:shadow-sm transition-all`}
            style={{ transitionDuration: 'var(--transition-fast)' }}
          >
            <p className="text-sm font-medium text-center" style={{ color: 'var(--comp-text-primary)' }}>{link.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuickLinks;
