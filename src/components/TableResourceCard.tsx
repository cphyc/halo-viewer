import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { ResourceConfig, SelectionState } from '../types';
import { getResourcePath } from '../api';
import { parseData } from '../parsers';
import DataTable from './DataTable';

interface TableResourceCardProps {
  resource: ResourceConfig;
  selections: SelectionState;
}

function useTableResourceData(resource: ResourceConfig, selections: SelectionState) {
  return useQuery({
    enabled: resource.type === 'table' && Object.keys(selections).length > 0,
    queryKey: ['table-resource', resource.id, selections],
    queryFn: async ({ signal }) => {
      const path = getResourcePath(resource, selections);
      const parser = resource.parser || 'json';
      return parseData(path, parser, signal);
    },
  });
}

export default function TableResourceCard({ resource, selections }: TableResourceCardProps) {
  const dataQ = useTableResourceData(resource, selections);

  // Build columns from parsed data keys
  const columns = useMemo<ColumnDef<any, any>[]>(() => {
    if (!dataQ.data) return [];

    const keys = Object.keys(dataQ.data);
    return keys.map((key) => ({
      accessorKey: key,
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      enableSorting: true,
      cell: (info: any) => {
        const value = info.getValue();
        if (typeof value === 'number') {
          if (Math.abs(value) > 1e6 || (Math.abs(value) < 0.01 && value !== 0)) {
            return value.toExponential(2);
          }
          return value.toFixed(2);
        }
        return value;
      },
    }));
  }, [dataQ.data]);

  // Transform column arrays into row objects
  const tableData = useMemo(() => {
    if (!dataQ.data) return [];

    const keys = Object.keys(dataQ.data);
    if (keys.length === 0) return [];

    // Get length from first array
    const firstKey = keys[0];
    const length = Array.isArray(dataQ.data[firstKey]) ? dataQ.data[firstKey].length : 0;

    // Validate all arrays have same length
    for (const key of keys) {
      if (!Array.isArray(dataQ.data[key]) || dataQ.data[key].length !== length) {
        console.error(`Table data validation failed: column "${key}" has different length`);
        return [];
      }
    }

    // Transform to row objects
    const rows = [];
    for (let i = 0; i < length; i++) {
      const row: any = {};
      for (const key of keys) {
        row[key] = dataQ.data[key][i];
      }
      rows.push(row);
    }

    return rows;
  }, [dataQ.data]);

  const handleDownload = () => {
    if (!dataQ.data) return;

    const csv = Object.keys(dataQ.data).join(',') + '\n';
    const rows = tableData.map((row) =>
      Object.values(row)
        .map((v) => JSON.stringify(v))
        .join(',')
    );
    const csvContent = csv + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resource.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div
        className="card-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{resource.name}</span>
        {resource.downloadable !== false && tableData.length > 0 && (
          <button
            onClick={handleDownload}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              background: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            Download CSV
          </button>
        )}
      </div>

      {dataQ.isLoading && <div className="muted">Loading {resource.name.toLowerCase()}…</div>}
      {dataQ.error && <div className="error">Failed to load {resource.name.toLowerCase()}</div>}
      {tableData.length > 0 && (
        <DataTable
          data={tableData}
          columns={columns}
          enableSorting={true}
          enableFiltering={true}
          maxHeight="500px"
        />
      )}
    </div>
  );
}
