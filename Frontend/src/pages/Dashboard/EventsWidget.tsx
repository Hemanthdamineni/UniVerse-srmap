import { useNavigate } from "react-router-dom";

export default function EventsWidget() {
  const navigate = useNavigate();

  return (
    <div className="h-full p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="card-title font-bold">Upcoming Events</h2>
          <span className="text-xs font-medium px-2 py-1 bg-[var(--status-success-bg)] text-[var(--status-success-text)] rounded-full border border-[var(--status-success-border)]">3 New</span>
        </div>
        <p className="body-text text-sm mb-4">Discover hackathons, guest lectures, and campus competitions to level up your skills.</p>
        
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] flex items-center justify-between cursor-pointer hover:bg-[var(--comp-surface-hover)] transition-colors" onClick={() => navigate("/events")}>
            <div>
              <p className="text-sm font-semibold text-[var(--comp-text-primary)]">CodeSprint 2026</p>
              <p className="text-xs text-[var(--comp-text-secondary)]">Hackathon • Tomorrow, 9 AM</p>
            </div>
            <div className="h-2 w-2 rounded-full bg-[var(--accent-blue)]"></div>
          </div>
        </div>
      </div>
      
      <button 
        onClick={() => navigate("/events")}
        className="w-full mt-4 py-2 px-4 rounded-lg bg-[var(--comp-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Explore Events
      </button>
    </div>
  );
}
