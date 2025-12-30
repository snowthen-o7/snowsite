import React, { useMemo, useState } from 'react';
import type { ParsedCSV } from '../../types/csv';

interface DataPreviewProps {
  data: ParsedCSV;
  maxRows?: number;
  highlightRows?: Set<number>;
  highlightClass?: string;
  onRowClick?: (rowIndex: number, row: Record<string, string>) => void;
  className?: string;
}

export function DataPreview({
  data,
  maxRows = 100,
  highlightRows,
  highlightClass = 'bg-yellow-100 dark:bg-yellow-900/30',
  onRowClick,
  className = '',
}: DataPreviewProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const displayRows = useMemo(() => {
    let rows = [...data.rows];

    if (sortColumn) {
      rows.sort((a, b) => {
        const valA = a[sortColumn] || '';
        const valB = b[sortColumn] || '';

        // Try numeric comparison
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        // String comparison
        const result = valA.localeCompare(valB);
        return sortDirection === 'asc' ? result : -result;
      });
    }

    return rows.slice(0, maxRows);
  }, [data.rows, sortColumn, sortDirection, maxRows]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const truncated = data.rowCount > maxRows;

  return (
    <div className={`overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 ${className}`}>
      {/* Header info bar */}
      <div className="flex items-center justify-between bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <span>
          {data.filename} • {data.headers.length} columns • {data.rowCount.toLocaleString()} rows
        </span>
        {truncated && (
          <span className="text-amber-600 dark:text-amber-500">
            Showing first {maxRows} rows
          </span>
        )}
      </div>

      {/* Table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50">
              <th className="w-12 px-3 py-2 text-left text-xs font-medium text-zinc-500">
                #
              </th>
              {data.headers.map((header) => (
                <th
                  key={header}
                  onClick={() => handleSort(header)}
                  className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="flex items-center gap-1">
                    {header}
                    {sortColumn === header && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => {
              const originalIndex = data.rows.indexOf(row);
              const isHighlighted = highlightRows?.has(originalIndex);

              return (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(originalIndex, row)}
                  className={`
                    border-b border-zinc-100 transition-colors
                    dark:border-zinc-800/50
                    ${isHighlighted ? highlightClass : ''}
                    ${onRowClick ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900' : ''}
                  `}
                >
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {originalIndex + 1}
                  </td>
                  {data.headers.map((header) => (
                    <td
                      key={header}
                      className="max-w-xs truncate px-3 py-2 text-zinc-900 dark:text-zinc-100"
                      title={row[header]}
                    >
                      {row[header] || (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayRows.length === 0 && (
        <div className="py-12 text-center text-zinc-500">No data to display</div>
      )}
    </div>
  );
}

export default DataPreview;
