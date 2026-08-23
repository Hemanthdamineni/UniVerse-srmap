import { useCallback, useRef, useState } from "react";
import { hasSeenOnboarding, markOnboardingSeen } from "../../lib/core/onboarding";

const LEAVE_ANIMATION_MS = 200;

function shortcutLabel() {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
}

interface FirstRunGuideProps {
  onDismiss?: () => void;
}

export default function FirstRunGuide({ onDismiss }: FirstRunGuideProps) {
  // Lazy init keeps the guide out of the DOM entirely once dismissed, while
  // still letting the CSS entrance animation play on first mount.
  const [visible, setVisible] = useState(() => !hasSeenOnboarding());
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef<number | undefined>(undefined);

  const handleDismiss = useCallback(() => {
    markOnboardingSeen();
    setLeaving(true);
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, LEAVE_ANIMATION_MS);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <section
      aria-label="Getting started"
      className={`first-run-guide${leaving ? " first-run-guide--leaving" : ""}`}
    >
      <div>
        <h2 className="first-run-guide__title">Synced with your SRM account</h2>
        <p className="first-run-guide__body">
          Attendance, timetable, and marks come straight from the university ERP
          each time you sign in. Nothing to configure.
        </p>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="first-run-guide__hint">
          <kbd className="first-run-kbd">{shortcutLabel()}</kbd>
          jumps to any page
        </span>
        <button type="button" className="btn-secondary no-underline" onClick={handleDismiss}>
          Got it
        </button>
      </div>
    </section>
  );
}
