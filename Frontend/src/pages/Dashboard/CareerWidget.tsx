import { useNavigate } from "react-router-dom";

export default function CareerWidget() {
  const navigate = useNavigate();

  return (
    <div className="h-full p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="card-title font-bold">Career Portal</h2>
          <span className="text-[var(--accent-blue)] text-xs font-semibold px-2 py-1 bg-[var(--accent-blue)]/10 rounded-full">Hiring Season</span>
        </div>
        <p className="body-text text-sm mb-4">View your placement drive applications, internship opportunities, and interview schedules.</p>
        
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] flex items-center justify-between cursor-pointer hover:bg-[var(--comp-surface-hover)] transition-colors" onClick={() => navigate("/career/jobs")}>
            <div>
              <p className="text-sm font-semibold text-[var(--comp-text-primary)]">SDE Intern - Google</p>
              <p className="text-xs text-[var(--comp-text-secondary)]">Deadline: In 2 days</p>
            </div>
            <div className="text-xs font-medium px-2 py-0.5 rounded border border-[var(--comp-border)] text-[var(--comp-text-secondary)] bg-[var(--background)]">Apply</div>
          </div>
        </div>
      </div>
      
      <button 
        onClick={() => navigate("/career")}
        className="w-full mt-4 py-2 px-4 rounded-lg border-2 border-[var(--comp-accent)] text-[var(--comp-accent)] text-sm font-medium hover:bg-[var(--comp-accent)] hover:text-white transition-colors"
      >
        Go to Career Portal
      </button>
    </div>
  );
}
