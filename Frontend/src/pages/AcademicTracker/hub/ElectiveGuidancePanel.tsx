/**
 * ElectiveGuidancePanel.tsx — ranks the student's plan electives against their
 * declared career track(s) (Story 4.1 / T4.1.4). Self-contained: it fetches
 * `GET /api/career/elective-guidance`, which reads curriculum + intent off the
 * student graph server-side.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { getElectiveGuidance } from "../../../lib/career/careerApi";

export function ElectiveGuidancePanel() {
  const { data, isPending } = useQuery({
    queryKey: ["career", "elective-guidance"],
    queryFn: getElectiveGuidance,
    staleTime: 5 * 60_000,
  });

  if (isPending) {
    return (
      <SectionCard title="Elective guidance">
        <p className="text-sm" style={{ color: "var(--comp-text-muted)" }}>
          Matching your electives to your career goal…
        </p>
      </SectionCard>
    );
  }

  const tracks = data?.tracks ?? [];
  const electives = data?.electives ?? [];

  if (tracks.length === 0) {
    return (
      <SectionCard title="Elective guidance">
        <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
          Set a target role in your{" "}
          <Link to="/career/me/profile" className="text-[var(--comp-accent)] hover:underline">
            career profile
          </Link>{" "}
          and this will rank your plan electives against it.
        </p>
      </SectionCard>
    );
  }

  const primary = tracks.filter((t) => t.primary).map((t) => t.label);
  const secondary = tracks.filter((t) => !t.primary).map((t) => t.label);

  return (
    <SectionCard title="Elective guidance">
      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
        <Compass className="h-4 w-4 text-[var(--comp-accent)]" />
        Ranked for <strong style={{ color: "var(--comp-text-primary)" }}>{primary.join(", ") || "your goals"}</strong>
        {secondary.length > 0 ? ` (also weighing ${secondary.join(", ")})` : ""}.
      </p>

      {electives.length > 0 ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {electives.map((e) => (
            <li
              key={e.code ?? e.name}
              className="rounded-lg border border-[var(--comp-border)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                  {e.name}
                  {e.code ? (
                    <span className="ml-2 font-normal" style={{ color: "var(--comp-text-muted)" }}>
                      {e.code}
                    </span>
                  ) : null}
                </span>
                {e.credit != null ? (
                  <span className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                    {e.credit} cr
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-medium" style={{ color: "var(--comp-accent)" }}>
                {e.why}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic" style={{ color: "var(--comp-text-muted)" }}>
          None of your plan electives map to that track yet — the mapping is still growing. Check the
          full{" "}
          <Link to="/learn/roadmaps" className="text-[var(--comp-accent)] hover:underline">
            roadmaps
          </Link>{" "}
          instead.
        </p>
      )}
    </SectionCard>
  );
}
