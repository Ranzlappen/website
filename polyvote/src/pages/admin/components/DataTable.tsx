import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = 'No data available.',
  onRowClick,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-8 text-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-surface-200 last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-surface-100' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-300">
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3">
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages} ({data.length} total)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
