/**
 * Mobile presentation for the fee tables.
 *
 * Both fee pages render five right-aligned currency columns, which collapse into
 * unreadable slivers on a phone. Each row becomes a card leading with the amount
 * that matters — outstanding on Dues, paid on Paid — with the rest as a label/value
 * grid. Total rows keep their accent treatment so the summary still stands out.
 */

export type FeeRowField = {
  label: string;
  value: React.ReactNode;
  /** Renders larger and in the accent/success colour — the number students look for. */
  lead?: boolean;
};

export type FeeRow = {
  key: string;
  title: string;
  subtitle?: string;
  isTotal?: boolean;
  fields: FeeRowField[];
};

export default function FeeRowCards({ rows }: { rows: FeeRow[] }) {
  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {rows.map((row) => (
        <li
          key={row.key}
          className="rounded-xl border p-4"
          style={{
            borderColor: row.isTotal
              ? "color-mix(in srgb, var(--comp-accent) 40%, transparent)"
              : "var(--comp-border)",
            backgroundColor: row.isTotal
              ? "color-mix(in srgb, var(--comp-accent) 8%, transparent)"
              : "var(--comp-surface)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: row.isTotal ? "var(--comp-accent)" : "var(--comp-text-primary)" }}
          >
            {row.title}
          </p>
          {row.subtitle ? (
            <p className="mt-0.5 text-xs" style={{ color: "var(--comp-text-secondary)" }}>
              {row.subtitle}
            </p>
          ) : null}

          <dl className="mt-3 flex flex-col gap-2">
            {row.fields.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                  {f.label}
                </dt>
                <dd
                  className={`m-0 tabular-nums ${f.lead ? "text-base font-bold" : "text-sm font-medium"}`}
                  style={{
                    color: f.lead
                      ? row.isTotal
                        ? "var(--comp-accent)"
                        : "var(--success)"
                      : "var(--comp-text-primary)",
                  }}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
