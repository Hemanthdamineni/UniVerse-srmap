import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

type Props<T> = {
  "aria-label": string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
};

export default function DataTable<T>({
  "aria-label": ariaLabel,
  columns,
  rows,
  getRowKey,
  emptyMessage = "No rows to display.",
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm text-[var(--text-primary)]" aria-label={ariaLabel}>
        <thead className="bg-[var(--background)] text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          <tr>
            {columns.map((col) => (
              <th key={col.id} scope="col" className={`px-4 py-3 ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-t border-[var(--border)] odd:bg-[var(--background)]/40">
              {columns.map((col) => (
                <td key={col.id} className={`px-4 py-3 align-top ${col.className ?? ""}`}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
