import {
  useState,
  Link,
  SectionCard,
  InlineError,
  EmptyView,
  createLmsCollection,
  listLmsCollections,
  getLmsCollection,
  updateLmsCollection,
  deleteLmsCollection,
  removeFromLmsCollection,
  useAsyncPage,
  LmsFrame
} from "./_shared/LmsPageShared";
import { ConfirmDialog } from "../../components/dialog";
import type { LmsCollection, LmsResource } from "./_shared/LmsPageShared";

export function CollectionsPage() {
  const { data, setData, loading, error } = useAsyncPage(() => listLmsCollections(), []);
  const [actionError, setActionError] = useState("");
  const [openId, setOpenId] = useState("");

  const collections = ((data as LmsCollection[]) || []);

  const refresh = async () => {
    try {
      setData(await listLmsCollections());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to refresh collections.");
    }
  };

  return (
    <LmsFrame title="Collections" loading={loading} error={error}>
      {actionError ? <InlineError message={actionError} /> : null}

      <SectionCard title="Create collection">
        <CollectionForm
          onSubmit={async () => {
            await refresh();
          }}
        />
      </SectionCard>

      {collections.length === 0 && !loading ? (
        <EmptyView
          title="No collections yet"
          description="Group related resources into named collections — exam prep packs, unit-wise notes, and more."
        />
      ) : null}

      <div className="divide-y divide-[var(--comp-border)]">
        {collections.map((collection) => (
          <div key={collection.id} className="space-y-3 py-3">
            <Link
              to={`/resources/me/collections?collectionId=${collection.id}`}
              className="block no-underline"
              onClick={() => setOpenId(collection.id)}
            >
              <h3 className="text-base font-semibold text-[var(--comp-text-primary)] hover:text-[var(--info)]">
                {collection.name}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">{collection.description || "No description"}</p>
            </Link>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--comp-text-muted)]">
              <span className="tabular-nums">
                {collection.itemCount ?? 0} {collection.itemCount === 1 ? "item" : "items"}
                {" · "}
                {Number(collection.isPublic) === 1 ? "public" : "private"}
              </span>
              <button
                className={`text-xs font-semibold ${openId === collection.id ? "text-[var(--comp-accent)]" : "text-[var(--info)]"}`}
                onClick={() => setOpenId(openId === collection.id ? "" : collection.id)}
              >
                {openId === collection.id ? "Hide manager" : "Manage"}
              </button>
            </div>
            {openId === collection.id ? (
              <CollectionManager
                collection={collection}
                onChanged={refresh}
                onError={setActionError}
              />
            ) : null}
          </div>
        ))}
      </div>
    </LmsFrame>
  );
}

function CollectionForm({ onSubmit }: { onSubmit: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input className="lms-input" placeholder="Collection name" aria-label="Collection name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="lms-input" placeholder="Description (optional)" aria-label="Collection description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button
          className="lms-btn lms-btn-primary"
          disabled={busy}
          onClick={async () => {
            if (!name.trim()) {
              setFormError("Collection name is required.");
              return;
            }
            setFormError("");
            setBusy(true);
            try {
              await createLmsCollection({ name, description: description || undefined, isPublic });
              setName("");
              setDescription("");
              setIsPublic(false);
              await onSubmit();
            } catch (err) {
              setFormError(err instanceof Error ? err.message : "Unable to create this collection.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Create
        </button>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-xs text-[var(--comp-text-secondary)]">
        <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
        Visible to other students
      </label>
      {formError ? <InlineError message={formError} /> : null}
    </div>
  );
}

function CollectionManager({
  collection,
  onChanged,
  onError
}: {
  collection: LmsCollection;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [detail, setDetail] = useState<LmsCollection | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [isPublic, setIsPublic] = useState(Number(collection.isPublic) === 1);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleDeleteConfirmed() {
    setConfirmingDelete(false);
    setDeleteBusy(true);
    try {
      await deleteLmsCollection(collection.id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't delete this collection. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const loadItems = async () => {
    setLoadingDetail(true);
    try {
      setDetail(await getLmsCollection(collection.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to load this collection's items.");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Edit metadata */}
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
        <input className="lms-input py-1.5 text-xs" aria-label="Rename collection" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="lms-input py-1.5 text-xs" placeholder="Description" aria-label="Edit collection description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="flex items-center gap-1 text-xs text-[var(--comp-text-secondary)]">
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
          Public
        </label>
        <button
          className="lms-btn lms-btn-primary"
          onClick={async () => {
            if (!name.trim()) {
              onError("Collection name is required.");
              return;
            }
            try {
              await updateLmsCollection(collection.id, {
                name,
                description: description || null,
                isPublic,
              });
              await onChanged();
            } catch (err) {
              onError(err instanceof Error ? err.message : "Unable to update this collection.");
            }
          }}
        >
          Save
        </button>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {!detail && !loadingDetail ? (
          <button
            className="lms-btn lms-btn-ghost"
            onClick={() => void loadItems()}
          >
            Show items
          </button>
        ) : null}
        {loadingDetail ? <p className="text-xs text-[var(--comp-text-muted)]">Loading items...</p> : null}
        {detail ? (
          (detail.items || []).length === 0 ? (
            <p className="text-xs text-[var(--comp-text-muted)]">No items in this collection yet.</p>
          ) : (
            (detail.items || []).map((item: LmsResource) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <Link to={`/resources/${item.id}`} className="min-w-0 flex-1 truncate no-underline text-[var(--comp-text-secondary)] hover:text-[var(--info)]">
                  {item.title}
                </Link>
                <button
                  className="shrink-0 text-xs font-semibold text-[var(--error)]"
                  onClick={async () => {
                    try {
                      await removeFromLmsCollection(collection.id, item.id);
                      await Promise.all([loadItems(), onChanged()]);
                    } catch (err) {
                      onError(err instanceof Error ? err.message : "Unable to remove this item.");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )
        ) : null}
      </div>

      {/* Delete */}
      <button
        className="lms-btn lms-btn-danger"
        onClick={() => setConfirmingDelete(true)}
      >
        Delete collection
      </button>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this collection?"
        description={`"${collection.name}" will be removed. Its items are kept but become ungrouped.`}
        confirmLabel="Delete collection"
        danger
        busy={deleteBusy}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </div>
  );
}

export default CollectionsPage;
