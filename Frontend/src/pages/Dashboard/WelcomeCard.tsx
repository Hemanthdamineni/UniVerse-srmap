import { getCurrentProfileName, getCurrentRegNo } from "../../lib/core/identity";
import { hasSeenOnboarding } from "../../lib/core/onboarding";

function WelcomeCard({ profileData }: { profileData?: Record<string, unknown> | null }) {
  const name = getCurrentProfileName(profileData ?? null);
  const regNo = getCurrentRegNo(profileData ?? null);

  // Returning users keep the familiar greeting; first-timers get a personal
  // one — the live-sync explanation lives in the first-run guide below.
  const firstName = name.trim().split(/\s+/)[0] || "";
  const greeting = hasSeenOnboarding()
    ? "Welcome back!"
    : firstName
      ? `Welcome, ${firstName}!`
      : "Welcome!";

  return (
    <div className="flex items-center justify-between h-full px-1">
      <div className="flex items-center gap-4">
        <div>
          {/* Greeting sits one type step under decision-relevant widget
              titles so schedule/attendance can compete for attention. Search
              was removed earlier for Command Palette redundancy; the
              decorative bell went the same way (no handler, and its
              always-lit dot implied false notifications). */}
          <h2 className="section-title font-semibold">{greeting}</h2>
          <p className="body-text mt-1">
            {name}
            {regNo ? ` · Register No. ${regNo}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export default WelcomeCard;
