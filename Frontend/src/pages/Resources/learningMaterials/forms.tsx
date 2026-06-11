import type { FormEvent } from "react";
import { RESOURCE_GROUPS } from "./constants";
import type { MaterialFormState, RecommendationFormState } from "./types";

type RecommendationFormProps = {
  form: RecommendationFormState;
  uploading: boolean;
  onChange: (updates: Partial<RecommendationFormState>) => void;
  onSubmit: (event: FormEvent) => void;
  onFileUpload: (file: File | null) => void;
};

type MaterialFormProps = {
  form: MaterialFormState;
  editingId: string;
  uploading: boolean;
  onChange: (updates: Partial<MaterialFormState>) => void;
  onSubmit: (event: FormEvent) => void;
  onCancelEdit: () => void;
  onFileUpload: (file: File | null) => void;
};

export function RecommendationForm({
  form,
  uploading,
  onChange,
  onSubmit,
  onFileUpload,
}: RecommendationFormProps) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource Title</label>
        <input
          required
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="e.g. Unit 4 Important PYQs"
          aria-label="Resource Title"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Description</label>
        <textarea
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.description}
          rows={3}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Why this resource is useful for this subject."
          aria-label="Description"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource URL</label>
        <input
          required
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="https://..."
          aria-label="Resource URL"
        />
        <label className="mt-2 block text-xs text-[var(--text-secondary)]">Or upload a file</label>
        <input
          type="file"
          className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          onChange={(event) => onFileUpload(event.target.files?.[0] || null)}
        />
        {uploading ? <p className="mt-1 text-xs text-[var(--text-secondary)]">Uploading file...</p> : null}
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Kind</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.kind}
          onChange={(event) => onChange({ kind: event.target.value })}
        >
          <option value="pdf">PDF</option>
          <option value="ppt">Presentation</option>
          <option value="video">Video</option>
          <option value="link">Web / YouTube Link</option>
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Group</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.resourceGroup}
          onChange={(event) => onChange({ resourceGroup: event.target.value })}
        >
          {RESOURCE_GROUPS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <button
          type="submit"
          className="rounded-xl bg-[var(--comp-accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--comp-accent-hover)]"
        >
          Submit Recommendation
        </button>
      </div>
    </form>
  );
}

export function MaterialForm({
  form,
  editingId,
  uploading,
  onChange,
  onSubmit,
  onCancelEdit,
  onFileUpload,
}: MaterialFormProps) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource Title</label>
        <input
          required
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="e.g. Unit 3 revision notes"
          aria-label="Resource Title"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Description</label>
        <textarea
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.description}
          rows={3}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="What this resource covers and when to use it"
          aria-label="Description"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Resource URL</label>
        <input
          required
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="https://..."
          aria-label="Resource URL"
        />
        <label className="mt-2 block text-xs text-[var(--text-secondary)]">Or upload a file</label>
        <input
          type="file"
          className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          onChange={(event) => onFileUpload(event.target.files?.[0] || null)}
        />
        {uploading ? <p className="mt-1 text-xs text-[var(--text-secondary)]">Uploading file...</p> : null}
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Kind</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.kind}
          onChange={(event) => onChange({ kind: event.target.value })}
        >
          <option value="pdf">PDF</option>
          <option value="ppt">Presentation</option>
          <option value="video">Video</option>
          <option value="link">YouTube / Web Link</option>
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Group</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.resourceGroup}
          onChange={(event) => onChange({ resourceGroup: event.target.value })}
        >
          {RESOURCE_GROUPS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Visibility</label>
        <select
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.visibility}
          onChange={(event) => onChange({ visibility: event.target.value })}
        >
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[var(--comp-text-primary)]">Tags</label>
        <input
          className="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
          value={form.tags}
          onChange={(event) => onChange({ tags: event.target.value })}
          placeholder="revision, unit-3, high-priority"
          aria-label="Tags"
        />
      </div>
      <div className="md:col-span-2 flex items-center gap-2">
        <input
          id="resource-featured"
          type="checkbox"
          checked={form.featured}
          onChange={(event) => onChange({ featured: event.target.checked })}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        <label htmlFor="resource-featured" className="text-sm text-[var(--text-primary)]">
          Mark as featured / priority resource
        </label>
      </div>
      <div className="md:col-span-2 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-xl bg-[var(--comp-accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--comp-accent-hover)]"
        >
          {editingId ? "Update Resource" : "Publish Resource"}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--comp-accent)] hover:text-[var(--comp-text-primary)]"
          >
            Cancel Edit
          </button>
        ) : null}
      </div>
    </form>
  );
}
