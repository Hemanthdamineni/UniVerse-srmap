import { CompetitionPageShell } from "../../../components/competition/CompetitionChrome";

/** Shared page frame for the event workflow pages. */
export function PageStack({ children }: { children: React.ReactNode }) {
  return (
    <CompetitionPageShell variant="wide">
      <div className="space-y-6">
        {children}
      </div>
    </CompetitionPageShell>
  );
}

/** Runs a busy-guarded async action, surfacing errors into a string state. */
export async function runStep(
  setBusy: (v: boolean) => void,
  setError: (v: string) => void,
  action: () => Promise<void>,
  errorMsg: string
) {
  setBusy(true);
  setError("");
  try {
    await action();
  } catch (err) {
    setError(err instanceof Error ? err.message : errorMsg);
  } finally {
    setBusy(false);
  }
}