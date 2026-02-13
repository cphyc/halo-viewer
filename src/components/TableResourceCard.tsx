import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataTable from './DataTable-AG';
import { ResourceConfig, SelectionState } from '../types';
import { getResourcePath } from '../api';
import { parseData } from '../parsers';

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

  // Build column definitions for AG-Grid
  const columns = useMemo(() => {
    if (!dataQ.data) return [];

    const keys = Object.keys(dataQ.data);
    return keys.map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      sortable: true,
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

    const csv =
      Object.keys(dataQ.data).join(',') +
      '\n' +
      tableData
        .map((row) =>
          Object.values(row)
            .map((v) => JSON.stringify(v))
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resource.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (dataQ.isLoading) {
    return (
      <div className="card">
        <div className="card-title">{resource.name}</div>
        <div className="muted">Loading...</div>
      </div>
    );
  }

  if (dataQ.error) {
    return (
      <div className="card">
        <div className="card-title">{resource.name}</div>
        <div className="error">Failed to load data</div>
      </div>
    );
  }

  if (!dataQ.data || tableData.length === 0) {
    return (
      <div className="card">
        <div className="card-title">{resource.name}</div>
        <div className="muted">No data available</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">
        {resource.name}
        {resource.downloadable && (
          <button onClick={handleDownload} style={{ marginLeft: 16, fontSize: 12 }}>
            Download CSV
          </button>
        )}
      </div>

      <DataTable
        data={tableData}
        columns={columns}
        enableSorting={true}
        enableFiltering={true}
        maxHeight="500px"
      />
    </div>
  );
}
