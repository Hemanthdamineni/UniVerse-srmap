import {
  useState,
  SectionCard,
  InlineError,
  EmptyView,
  RequestCard,
  createLmsRequest,
  fulfillLmsRequest,
  getLmsResource,
  listLmsRequests,
  upvoteLmsRequest,
  closeLmsRequest,
  useSession,
  getProfileRegisterNo,
  useAsyncPage,
  LmsFrame
} from "./_shared/LmsPageShared";
import { ConfirmDialog } from "../../components/dialog";
import type { LmsRequest } from "./_shared/LmsPageShared";

const REQUEST_STATUSES = ["open", "fulfilled", "closed"] as const;

export function RequestBoardPage() {
  const { profile } = useSession();
  const currentRegNo = getProfileRegisterNo(profile);

  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const { data, setData, loading, error } = useAsyncPage(
    () =>
      statusFilter === "all"
        ? listLmsRequests({ subjectCode: subjectFilter, limit: 50, page: 1 })
        : listLmsRequests({ status: statusFilter, subjectCode: subjectFilter, limit: 50, page: 1 }),
    [statusFilter, subjectFilter]
  );
  const [listError, setListError] = useState("");
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [fulfilBusyId, setFulfilBusyId] = useState<string | null>(null);
  const [fulfilError, setFulfilError] = useState("");

  async function handleFulfil(requestId: string, requestTitle: string) {
    const input = window.prompt(
      `Paste the resource ID that fulfils "${requestTitle}" — you can copy it from the resource page URL (/learn/r/<id>).`
    );
    const resourceId = input?.trim();
    if (!resourceId) return;
    setFulfilError("");
    setFulfilBusyId(requestId);
    try {
      await getLmsResource(resourceId);
      await fulfillLmsRequest(requestId, resourceId);
      await refresh({ status: statusFilter, subjectCode: subjectFilter });
    } catch (err) {
      setFulfilError(
        err instanceof Error ? err.message : "Couldn't link that resource to the request. Please try again."
      );
    } finally {
      setFulfilBusyId(null);
    }
  }

  const requests: LmsRequest[] = data?.items || [];
  // "My requests" is a client-side view over the fetched page (owner close needs
  // userId; the backend list endpoint has no mine-only filter).
  const visibleRequests = mineOnly && currentRegNo
    ? requests.filter((request) => request.userId === currentRegNo)
    : requests;

  async function handleCloseConfirmed() {
    if (!pendingCloseId) return;
    const requestId = pendingCloseId;
    setPendingCloseId(null);
    try {
      await closeLmsRequest(requestId);
      await refresh({ status: statusFilter, subjectCode: subjectFilter });
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't close this request. Please try again.");
    }
  }

  const refresh = async (params: Record<string, unknown>) => {
    setListError("");
    try {
      const next =
        params.status === "all"
          ? await listLmsRequests({ subjectCode: params.subjectCode as string, limit: 50, page: 1 })
          : await listLmsRequests({
              status: params.status as string,
              subjectCode: params.subjectCode as string,
              limit: 50,
              page: 1,
            });
      setData(next);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Unable to refresh the request board.");
    }
  };

  return (
    <LmsFrame title="Request Board" loading={loading} error={error}>
      <SectionCard title="Filters">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-[var(--comp-text-secondary)]">
            Status
            <select
              className="lms-input w-auto py-1.5 text-xs"
              aria-label="Status filter"
              value={statusFilter}
              onChange={(event) => void refresh({ status: event.target.value, subjectCode: subjectFilter })}
            >
              <option value="open">Open</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </label>
          <input
            className="lms-input w-40 py-1.5 text-xs uppercase"
            placeholder="Subject code"
            aria-label="Subject code filter"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void refresh({ status: statusFilter, subjectCode: subjectFilter });
              }
            }}
          />
          <button
            className={`lms-btn ${mineOnly ? "lms-btn-primary" : "lms-btn-ghost"}`}
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((value) => !value)}
          >
            My requests
          </button>
        </div>
      </SectionCard>

      {listError ? <InlineError message={listError} /> : null}
      {fulfilError ? <InlineError message={fulfilError} /> : null}

      <div className="space-y-3">
        {visibleRequests.map((request) => {
          const canClose = request.status === "open" && request.userId === currentRegNo;
          const canFulfil = request.status === "open" && request.userId !== currentRegNo;
          return (
            <div key={request.id} className="space-y-1">
              <RequestCard
                request={request}
                onUpvote={async (requestId) => {
                  await upvoteLmsRequest(requestId);
                  await refresh({ status: statusFilter, subjectCode: subjectFilter });
                }}
              />
              {(canClose || canFulfil || request.status !== "open") && (
                <div className="flex items-center justify-end gap-2 px-1">
                  {request.status !== "open" && (
                    <span className="text-xs font-medium capitalize text-[var(--comp-text-muted)]">
                      {request.status}
                      {request.fulfilledBy ? ` by ${request.fulfilledBy}` : ""}
                    </span>
                  )}
                  {canFulfil && (
                    <button
                      className="lms-btn lms-btn-ghost border-[color-mix(in_srgb,var(--info)_25%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)]"
                      disabled={fulfilBusyId !== null}
                      onClick={() => void handleFulfil(request.id, request.title)}
                    >
                      {fulfilBusyId === request.id ? "Linking..." : "I have this resource"}
                    </button>
                  )}
                  {canClose && (
                    <button
                      className="lms-btn lms-btn-ghost border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]"
                      onClick={() => setPendingCloseId(request.id)}
                    >
                      Close request
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visibleRequests.length === 0 && !loading ? (
          <EmptyView
            title={mineOnly ? "You haven't posted any requests here yet." : "No requests match these filters."}
            description={
              mineOnly
                ? "Post one below so others can help fill the gap."
                : "Try a different status or subject, or post your own request."
            }
          />
        ) : null}
      </div>

      <SectionCard title="Post a Request">
        <RequestForm
          onSubmit={async () => {
            await refresh({ status: statusFilter, subjectCode: subjectFilter });
          }}
        />
      </SectionCard>

      <ConfirmDialog
        open={pendingCloseId !== null}
        onOpenChange={(open) => { if (!open) setPendingCloseId(null); }}
        title="Close this request?"
        description="It will be marked as closed on the request board so others know it no longer needs fulfilling."
        confirmLabel="Close request"
        onConfirm={() => void handleCloseConfirmed()}
      />
    </LmsFrame>
  );
}

function RequestForm({ onSubmit }: { onSubmit: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [semester, setSemester] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !subjectCode.trim() || !subjectName.trim() || !semester.trim()) {
      setFormError("Title, subject code, subject name and semester are required.");
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      await createLmsRequest({ title, subjectCode, subjectName, semester, description });
      setTitle("");
      setSubjectCode("");
      setSubjectName("");
      setSemester("");
      setDescription("");
      await onSubmit();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to post this request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="lms-input" placeholder="Title" aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="lms-input" placeholder="Subject code" aria-label="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} />
        <input className="lms-input" placeholder="Subject name" aria-label="Subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} />
        <input className="lms-input" placeholder="Semester" aria-label="Semester" value={semester} onChange={(event) => setSemester(event.target.value)} />
      </div>
      <textarea className="mt-3 min-h-24 w-full lms-input" placeholder="Description (optional)" aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      {formError ? <InlineError message={formError} /> : null}
      <button
        className="mt-3 lms-btn lms-btn-primary"
        disabled={busy}
        onClick={() => void handleSubmit()}
      >
        {busy ? "Posting..." : "Post request"}
      </button>
      <p className="mt-2 text-xs text-[var(--comp-text-muted)]">
        {REQUEST_STATUSES.length} statuses are tracked — open, fulfilled and closed.
      </p>
    </div>
  );
}

export default RequestBoardPage;
