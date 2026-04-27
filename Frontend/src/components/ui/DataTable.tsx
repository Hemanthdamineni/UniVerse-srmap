import React from 'react';
import { cn } from '../../lib/utils';
import { SkeletonBlock } from './SkeletonBlock';
import { EmptyState } from './EmptyState';
import { InlineError } from './InlineError';

export interface Column<T> {
  header: React.ReactNode;
  accessor: (row: T) => React.ReactNode;
  className?: string; // Appended to th and td
}

export interface DataTableProps<T> {
  data: T[] | undefined | null;
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading,
  error,
  onRetry,
  emptyTitle = "No data found",
  emptyDescription,
  emptyIcon,
  className
}: DataTableProps<T>) {

  if (error) {
    return <InlineError message={typeof error === 'string' ? error : error.message} onRetry={onRetry} className={className} />;
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="erp-table-shell hidden md:block">
          <SkeletonBlock height={48} className="w-full !rounded-none !border-b !border-[color:var(--comp-border)]" />
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <SkeletonBlock key={i} height={32} className="w-full" />
            ))}
          </div>
        </div>
        <div className="md:hidden space-y-3">
          {[1, 2, 3].map(i => (
             <SkeletonBlock key={i} height={120} className="w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} className={className} />;
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop Table View */}
      <div className="hidden md:block erp-table-shell">
        <table className="erp-table">
          <thead className="erp-table-head">
            <tr className="erp-table-row">
              {columns.map((col, i) => (
                <th key={i} className={cn("erp-table-head-cell label-text", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="erp-table-body">
            {data.map((row, rowIndex) => (
              <tr key={keyExtractor(row, rowIndex)} className="erp-table-row bg-[color:var(--comp-surface)] hover:bg-[color:var(--comp-surface-hover)]">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className={cn("erp-table-cell", col.className)}>
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card View */}
      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => (
          <div key={keyExtractor(row, rowIndex)} className="border-[0.5px] border-[color:var(--comp-border)] bg-[color:var(--comp-surface)] rounded-[var(--border-radius-lg,12px)] p-4 space-y-3">
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                <span className="label-text shrink-0">{col.header}</span>
                <span className="body-text text-sm sm:text-right break-words">{col.accessor(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
