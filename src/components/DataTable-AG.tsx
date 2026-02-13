import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridReadyEvent,
  RowClickedEvent,
  SortChangedEvent,
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { hasLatex, renderLatex } from '../utils/renderLatex';

// Register all community modules (includes all features we need)
ModuleRegistry.registerModules([AllCommunityModule]);

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: DataTableColumn[];
  onRowSelect?: (row: TData | null) => void;
  selectedRowId?: string | number;
  getRowId?: (row: TData) => string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  maxHeight?: string;
  sorting?: { id: string; desc: boolean }[];
  onSortingChange?: (sorting: { id: string; desc: boolean }[]) => void;
}

// Custom header component for rendering LaTeX
function LatexHeaderComponent(props: any) {
  const displayName = props.displayName;

  if (hasLatex(displayName)) {
    return (
      <div
        className="ag-header-cell-label"
        dangerouslySetInnerHTML={{ __html: renderLatex(displayName) }}
      />
    );
  }

  return <div className="ag-header-cell-label">{displayName}</div>;
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
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
}: DataTableProps<TData>) {
  const gridRef = useRef<AgGridReact>(null);
  const [quickFilterText, setQuickFilterText] = useState('');

  // Force grid to refresh when selectedRowId changes to update row styling
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.redrawRows();
    }
  }, [selectedRowId]);

  // Scroll to selected row when selection changes
  useEffect(() => {
    if (gridRef.current?.api && selectedRowId !== undefined && selectedRowId !== null) {
      // Find the node with the selected ID
      gridRef.current.api.forEachNode((node) => {
        const rowId = getRowId(node.data);
        if (String(rowId) === String(selectedRowId)) {
          // Scroll to this node and center it
          gridRef.current!.api.ensureNodeVisible(node, 'middle');
        }
      });
    }
  }, [selectedRowId, getRowId]);

  // Convert columns to AG-Grid column definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    return columns.map((col) => ({
      field: col.key,
      headerName: col.label,
      sortable: enableSorting && (col.sortable ?? true),
      filter: enableFiltering ? 'agTextColumnFilter' : false,
      floatingFilter: enableFiltering,
      resizable: true,
      headerComponent: hasLatex(col.label) ? LatexHeaderComponent : undefined,
      // Format numbers with appropriate precision
      valueFormatter: (params: any) => {
        const value = params.value;
        if (typeof value === 'number') {
          // Scientific notation for very large/small numbers
          if (Math.abs(value) > 1e6 || (Math.abs(value) < 0.01 && value !== 0)) {
            return value.toExponential(2);
          }
          // Regular formatting with 2 decimals
          return value.toFixed(2);
        }
        return value;
      },
    }));
  }, [columns, enableSorting, enableFiltering]);

  // Apply initial sorting when grid is ready
  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      if (externalSorting && externalSorting.length > 0) {
        const sortModel = externalSorting.map((sort) => ({
          colId: sort.id,
          sort: (sort.desc ? 'desc' : 'asc') as 'asc' | 'desc',
        }));
        params.api.applyColumnState({
          state: sortModel,
          defaultState: { sort: null },
        });
      }
    },
    [externalSorting]
  );

  // Handle row click
  const onRowClicked = useCallback(
    (event: RowClickedEvent) => {
      if (onRowSelect) {
        const rowId = getRowId(event.data);
        // Toggle selection: if already selected, unselect
        if (selectedRowId && String(selectedRowId) === String(rowId)) {
          onRowSelect(null);
        } else {
          onRowSelect(event.data);
          // Note: scrolling is handled by the useEffect watching selectedRowId
        }
      }
    },
    [onRowSelect, getRowId, selectedRowId]
  );

  // Handle sort changes
  const onSortChanged = useCallback(
    (event: SortChangedEvent) => {
      if (externalOnSortingChange) {
        const sortModel = event.api
          .getColumnState()
          .filter((col) => col.sort !== null)
          .map((col) => ({
            id: col.colId!,
            desc: col.sort === 'desc',
          }));
        externalOnSortingChange(sortModel);
      }
    },
    [externalOnSortingChange]
  );

  // Row class rules for highlighting selected row
  const getRowStyle = useCallback(
    (params: any) => {
      const rowId = getRowId(params.data);
      if (selectedRowId && String(selectedRowId) === String(rowId)) {
        return { backgroundColor: '#e3f2fd' };
      }
      return undefined;
    },
    [getRowId, selectedRowId]
  );

  return (
    <div style={{ width: '100%' }}>
      {enableFiltering && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
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

      <div className="ag-theme-quartz" style={{ height: maxHeight, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: enableSorting,
            filter: enableFiltering ? 'agTextColumnFilter' : false,
            floatingFilter: enableFiltering,
            resizable: true,
          }}
          onGridReady={onGridReady}
          onRowClicked={onRowClicked}
          onSortChanged={onSortChanged}
          getRowId={(params) => getRowId(params.data)}
          getRowStyle={getRowStyle}
          quickFilterText={quickFilterText}
          animateRows={false}
          suppressCellFocus={true}
          rowSelection={{
            mode: 'singleRow',
            enableClickSelection: false,
          }}
          // Enable virtual scrolling for performance
          rowBuffer={10}
        />
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Showing {data.length} rows</div>
    </div>
  );
}
