import type { ReactNode } from "react";
import { DataTable as UnifiedDataTable } from "../ui/DataTable";

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
  "aria-label": _ariaLabel,
  columns,
  rows,
  getRowKey,
  emptyMessage = "No rows to display.",
}: Props<T>) {
  return (
    <UnifiedDataTable
      data={rows}
      columns={columns.map((column) => ({
        header: column.header,
        accessor: column.cell,
        className: column.className,
      }))}
      keyExtractor={(row) => getRowKey(row)}
      emptyTitle={emptyMessage}
      className="w-full"
    />
  )
}
