import { useMemo, useState, useRef, useLayoutEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { hasLatex, renderLatex } from '../utils/renderLatex';
import 'katex/dist/katex.min.css';

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  onRowSelect?: (row: TData | null) => void;
  selectedRowId?: string | number;
  getRowId?: (row: TData) => string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  maxHeight?: string;
}

export default function DataTable<TData>({
  data,
  columns,
  onRowSelect,
  selectedRowId,
  getRowId = (row: any) => row.id,
  enableSorting = true,
  enableFiltering = true,
  maxHeight = '400px',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const headerRef = useRef<HTMLTableSectionElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getRowId: getRowId as any,
  });

  const { rows } = table.getRowModel();

  // Measure header column widths after render
  useLayoutEffect(() => {
    if (headerRef.current) {
      const headerCells = headerRef.current.querySelectorAll('th');
      const widths = Array.from(headerCells).map((cell) => cell.offsetWidth);
      setColumnWidths(widths);
    }
  }, [columns, data]);

  // Virtualizer for performance with large datasets
  const parentRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  const handleRowClick = (row: Row<TData>) => {
    if (onRowSelect) {
      const rowId = getRowId(row.original);
      // Toggle selection: if already selected, unselect
      if (selectedRowId && String(selectedRowId) === String(rowId)) {
        onRowSelect(null);
      } else {
        onRowSelect(row.original);
      }
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {enableFiltering && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search..."
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
        </div>
      )}

      <div
        ref={parentRef as any}
        style={{
          maxHeight,
          overflow: 'auto',
          border: '1px solid #ddd',
          borderRadius: 4,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead
            ref={headerRef}
            style={{
              position: 'sticky',
              top: 0,
              background: '#f5f5f5',
              zIndex: 1,
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => (
                  <th
                    key={header.id}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #e0e0e0',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      width: columnWidths[idx] ? `${columnWidths[idx]}px` : 'auto',
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {(() => {
                        const headerContent = header.column.columnDef.header;
                        if (typeof headerContent === 'string') {
                          if (hasLatex(headerContent)) {
                            console.log('Rendering LaTeX header:', headerContent);
                            return (
                              <span
                                dangerouslySetInnerHTML={{ __html: renderLatex(headerContent) }}
                              />
                            );
                          }
                          console.log('Plain text header:', headerContent);
                          return headerContent;
                        }
                        return flexRender(headerContent, header.getContext());
                      })()}
                      {header.column.getCanSort() && (
                        <span>
                          {{
                            asc: ' ▲',
                            desc: ' ▼',
                          }[header.column.getIsSorted() as string] ?? ' ⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const rowId = getRowId(row.original);
              const isSelected = selectedRowId && String(selectedRowId) === String(rowId);

              return (
                <tr
                  key={row.id}
                  onClick={() => handleRowClick(row)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    cursor: onRowSelect ? 'pointer' : 'default',
                    background: isSelected ? '#e3f2fd' : 'white',
                    display: 'table',
                    tableLayout: 'fixed',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell, idx) => (
                    <td
                      key={cell.id}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #eee',
                        borderRight: '1px solid #f0f0f0',
                        whiteSpace: 'nowrap',
                        width: columnWidths[idx] ? `${columnWidths[idx]}px` : 'auto',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        Showing {rows.length} of {data.length} rows
      </div>
    </div>
  );
}
