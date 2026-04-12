import * as React from "react";
import { useNavigate } from "react-router-dom";
import { KeyboardIcon } from "lucide-react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export default function AppKeyboardShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const gRef = React.useRef(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (event.key === "g") {
        gRef.current = true;
        window.setTimeout(() => {
          gRef.current = false;
        }, 800);
        return;
      }

      if (gRef.current && event.key === "d") {
        event.preventDefault();
        gRef.current = false;
        navigate("/dashboard");
        return;
      }

      if (gRef.current && event.key === "h") {
        event.preventDefault();
        gRef.current = false;
        navigate("/resources");
        return;
      }

      if (gRef.current && event.key === "c") {
        event.preventDefault();
        gRef.current = false;
        navigate("/career");
        return;
      }

      if (gRef.current && event.key === "e") {
        event.preventDefault();
        gRef.current = false;
        navigate("/events/listings");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <>
      <div className="pointer-events-none fixed bottom-6 left-6 z-40">
        <Button
          type="button"
          variant="outline"
          onClick={() => setHelpOpen(true)}
          className="pointer-events-auto h-9 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-primary)] shadow-[0_8px_22px_rgba(10,38,42,0.18)] transition hover:bg-white"
          aria-label="Keyboard shortcuts help"
        >
          <KeyboardIcon className="size-4" />
          <span className="hidden text-sm sm:inline">Shortcuts</span>
        </Button>
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md border-[var(--border)] bg-[var(--background)] p-6 text-[var(--text-primary)]">
          <DialogHeader className="px-0 pt-0">
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Power-user navigation. Shortcuts are disabled while typing in form fields.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-2 text-sm text-[var(--text-primary)]">
          <li className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span>Command palette</span>
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">⌘K</kbd>{" "}
            <span className="text-[var(--text-secondary)]">or</span>{" "}
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">Ctrl+K</kbd>
          </li>
          <li className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span>This help</span>
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">?</kbd>
          </li>
          <li className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span>Go to dashboard</span>
            <span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">g</kbd>{" "}
              then{" "}
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">d</kbd>
            </span>
          </li>
          <li className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span>Go to learning home</span>
            <span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">g</kbd>{" "}
              then{" "}
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">h</kbd>
            </span>
          </li>
          <li className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
            <span>Go to career services</span>
            <span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">g</kbd>{" "}
              then{" "}
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">c</kbd>
            </span>
          </li>
          <li className="flex justify-between gap-4 py-2">
            <span>Go to competition listings</span>
            <span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">g</kbd>{" "}
              then{" "}
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs">e</kbd>
            </span>
          </li>
        </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
