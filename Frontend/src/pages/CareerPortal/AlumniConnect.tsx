import { useEffect, useMemo, useState } from "react";
import {
  EmptyStateCard,
  ErpPageShell,
  SectionCard,
  StatusBanner,
} from "../../components/erp/ErpPrimitives";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  createAlumniProfile,
  deleteAlumniProfile,
  listAlumni,
  requestAlumniConnection,
  type AlumniProfile,
  updateAlumniProfile,
} from "../../lib/careerApi";

export default function AlumniConnect({ adminMode = false }: { adminMode?: boolean }) {
  const admin = useAdminAccess();
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("All");
  const [editingId, setEditingId] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    batch: "",
    degree: "",
    company: "",
    role: "",
    location: "",
    expertise: "",
    bio: "",
    openToConnect: true,
  });

  async function loadAlumni() {
    try {
      const data = await listAlumni(
        {
          ...(search.trim() ? { query: search.trim() } : {}),
          ...(batchFilter !== "All" ? { batch: batchFilter } : {}),
        },
        adminMode && admin.unlocked ? admin.adminHeaders : undefined
      );
      setAlumni(data.items);
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load alumni directory.",
      });
    }
  }

  useEffect(() => {
    void loadAlumni();
  }, [admin.adminHeaders, admin.unlocked, adminMode, batchFilter, search]);

  const batches = useMemo(() => {
    const unique = Array.from(new Set(alumni.map((item) => item.batch).filter(Boolean))).sort().reverse();
    return ["All", ...unique];
  }, [alumni]);

  async function runAction(action: () => Promise<unknown>, successText: string) {
    setBanner(null);
    try {
      await action();
      setBanner({ tone: "success", text: successText });
      await loadAlumni();
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  return (
    <ErpPageShell title="Alumni Connect" source="Internal API">
      {banner ? <StatusBanner message={{ id: "alumni-banner", tone: banner.tone, text: banner.text }} /> : null}

      {adminMode && admin.unlocked ? (
        <SectionCard title={editingId ? "Edit Alumni Profile" : "Add Alumni Profile"}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const payload = {
                name: form.name.trim(),
                batch: form.batch.trim(),
                degree: form.degree.trim(),
                company: form.company.trim(),
                role: form.role.trim(),
                location: form.location.trim(),
                expertise: form.expertise
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                bio: form.bio.trim(),
                openToConnect: form.openToConnect,
              };
              if (editingId) {
                void runAction(
                  () => updateAlumniProfile(editingId, payload, admin.adminHeaders),
                  "Alumni profile updated."
                );
              } else {
                void runAction(
                  () => createAlumniProfile(payload, admin.adminHeaders),
                  "Alumni profile created."
                );
              }
              setEditingId("");
              setForm({
                name: "",
                batch: "",
                degree: "",
                company: "",
                role: "",
                location: "",
                expertise: "",
                bio: "",
                openToConnect: true,
              });
            }}
            className="grid gap-3 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Batch</label>
              <input
                value={form.batch}
                onChange={(event) => setForm((prev) => ({ ...prev, batch: event.target.value }))}
                placeholder="2024"
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Degree</label>
              <input
                value={form.degree}
                onChange={(event) => setForm((prev) => ({ ...prev, degree: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Company</label>
              <input
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Role</label>
              <input
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Location</label>
              <input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Expertise</label>
              <input
                value={form.expertise}
                onChange={(event) => setForm((prev) => ({ ...prev, expertise: event.target.value }))}
                placeholder="React, ML, System Design"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Bio</label>
              <textarea
                value={form.bio}
                onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="alumni-open-connect"
                type="checkbox"
                checked={form.openToConnect}
                onChange={(event) => setForm((prev) => ({ ...prev, openToConnect: event.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <label htmlFor="alumni-open-connect" className="text-sm text-[var(--text-primary)]">
                Open to student connection requests
              </label>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-[#0A3035] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#124850]"
              >
                {editingId ? "Update Alumni" : "Add Alumni"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId("");
                    setForm({
                      name: "",
                      batch: "",
                      degree: "",
                      company: "",
                      role: "",
                      location: "",
                      expertise: "",
                      bio: "",
                      openToConnect: true,
                    });
                  }}
                  className="rounded-full border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[#0A3035] hover:text-[#0A3035]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Find Alumni">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, company, role, or skill..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[#0A3035]"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {batches.map((batch) => (
              <button
                key={batch}
                type="button"
                onClick={() => setBatchFilter(batch)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  batchFilter === batch
                    ? "border-[#0A3035] bg-[#0A3035] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[#0A3035] hover:text-[#0A3035]"
                }`}
              >
                {batch}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {alumni.length === 0 ? (
        <EmptyStateCard message="No alumni profiles match the current search." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {alumni.map((item) => (
            <article key={item.id} className="dashboard-card flex flex-col justify-between p-4 md:p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[#0A3035]">{item.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.degree} · Batch {item.batch}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A3035]/8">
                    <span className="text-sm font-bold text-[#0A3035]">
                      {item.name
                        .split(" ")
                        .map((value) => value[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[#0A3035]">{item.role}</span> at {item.company}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">{item.location}</div>
                {item.bio ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.bio}</p>
                ) : null}
                {item.expertise.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.expertise.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#0A3035]/8 px-2.5 py-0.5 text-xs font-semibold text-[#0A3035]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.requested ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                    Request Sent
                  </span>
                ) : item.openToConnect ? (
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        () =>
                          requestAlumniConnection(item.id, {
                            message: "Interested in connecting through the university portal.",
                          }),
                        `Connection request sent to ${item.name}.`
                      )
                    }
                    className="rounded-full bg-[#0A3035] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124850]"
                  >
                    Request Connect
                  </button>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                    Not Available
                  </span>
                )}
                {adminMode && admin.unlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          name: item.name,
                          batch: item.batch,
                          degree: item.degree,
                          company: item.company,
                          role: item.role,
                          location: item.location,
                          expertise: item.expertise.join(", "),
                          bio: item.bio || "",
                          openToConnect: item.openToConnect,
                        });
                      }}
                      className="rounded-full border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          () => deleteAlumniProfile(item.id, admin.adminHeaders),
                          "Alumni profile deleted."
                        )
                      }
                      className="rounded-full border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </ErpPageShell>
  );
}
