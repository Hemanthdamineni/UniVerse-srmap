import { getCurrentProfileName } from "../../lib/core/identity";

// The ERP stores student names fully uppercased ("DAMINENI HEMANTH…").
// Shouty names get re-cased per word; genuinely mixed-case names
// (McDonald, DeSilva) pass through untouched.
function toDisplayName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "";
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'\-])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

function initialsOf(displayName: string): string {
  const parts = displayName.split(" ").filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function timeGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function WelcomeCard({ profileData }: { profileData?: Record<string, unknown> | null }) {
  const displayName = toDisplayName(getCurrentProfileName(profileData ?? null));
  // identity falls back to regNo then the literal "Student"; neither is a
  // name worth greeting by, so those collapse to a nameless greeting.
  const isGeneric = !displayName || displayName.toLowerCase() === "student";
  const firstName = isGeneric ? "" : displayName.split(" ")[0];

  const now = new Date();
  const greeting = `${timeGreeting(now.getHours())}${firstName ? `, ${firstName}` : ""}!`;

  return (
    <div className="flex h-full items-center gap-3 px-1">
      {!isGeneric && (
        <div aria-hidden="true" className="welcome-avatar">
          {initialsOf(displayName)}
        </div>
      )}
      <div className="min-w-0">
        {/* Greeting sits one type step under decision-relevant widget
            titles so schedule/attendance can compete for attention. Search
            was removed earlier for Command Palette redundancy; the
            decorative bell went the same way (no handler, and its
            always-lit dot implied false notifications). Full name and
            register number live in BasicInfo directly below. */}
        <h2 className="section-title truncate font-semibold">{greeting}</h2>
        <p className="body-text mt-0.5 truncate">{DATE_FORMAT.format(now)}</p>
      </div>
    </div>
  );
}

export default WelcomeCard;
