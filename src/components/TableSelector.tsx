import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataTable from './DataTable-AG';
import { StructureConfig, SelectionState, TableColumnConfig } from '../types';
import { replacePlaceholders } from '../api';
import { parseData } from '../parsers';

interface TableSelectorProps {
  structure: StructureConfig;
  selections: SelectionState;
  onSelectionChange: (structureId: string, value: string | number | null) => void;
}

// Hook to fetch full parsed data for table display
function useTableData(structure: StructureConfig, selections: SelectionState) {
  // Check if all requirements are met
  const requirementsMet =
    structure.requires?.every((reqId) => selections[reqId] !== undefined) ?? true;

  return useQuery({
    queryKey: ['table-structure-data', structure.id, selections],
    queryFn: async ({ signal }) => {
      if (!structure.pathTemplate) {
        throw new Error('No pathTemplate defined');
      }
      const path = replacePlaceholders(structure.pathTemplate, selections);
      const parser = structure.parser || 'json';
      return parseData(path, parser, signal);
    },
    enabled: !!structure.pathTemplate && !structure.derived_from && requirementsMet,
    staleTime: Infinity,
  });
}

export default function TableSelector({
  structure,
  selections,
  onSelectionChange,
}: TableSelectorProps) {
  const dataQuery = useTableData(structure, selections);
  const currentValue = selections[structure.id];

  // Lift sorting state to TableSelector so it persists across re-renders
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>(() => {
    // Initialize sorting from defaultSort in tableColumns
    if (!structure.tableColumns) {
      return [];
    }
    const defaultSortColumn = structure.tableColumns.find((col) => col.defaultSort);
    if (defaultSortColumn) {
      return [{ id: defaultSortColumn.key, desc: defaultSortColumn.defaultSort === 'desc' }];
    }
    return [];
  });

  // Build columns from tableColumns config for AG-Grid
  const columns = useMemo(() => {
    if (!structure.tableColumns) {
      return [];
    }

    return structure.tableColumns.map((colConfig: TableColumnConfig) => ({
      key: colConfig.key,
      label: colConfig.label,
      sortable: colConfig.sortable ?? true,
    }));
  }, [structure.tableColumns]);

  // Transform parsed data (column arrays) into table rows (array of objects)
  const tableData = useMemo(() => {
    if (!dataQuery.data || !structure.tableColumns) {
      return [];
    }

    const parsedData = dataQuery.data;
    const keys = structure.tableColumns.map((col) => col.key);

    // Get length from first column
    const firstKey = keys[0];
    if (!firstKey || !Array.isArray(parsedData[firstKey])) {
      return [];
    }

    const length = parsedData[firstKey].length;

    // Transform column arrays to row objects
    const rows = [];
    for (let i = 0; i < length; i++) {
      const row: any = {};
      for (const key of keys) {
        if (Array.isArray(parsedData[key])) {
          row[key] = parsedData[key][i];
        }
      }
      rows.push(row);
    }

    return rows;
  }, [dataQuery.data, structure.tableColumns]);

  // Get row ID function
  const getRowId = (row: any) => {
    const idKey = structure.idKey || 'id';
    return String(row[idKey] ?? row.id ?? row.ids);
  };

  const handleRowSelect = (row: any | null) => {
    if (row === null) {
      onSelectionChange(structure.id, null);
    } else {
      const idKey = structure.idKey || 'id';
      const value = row[idKey] ?? row.id ?? row.ids;
      onSelectionChange(structure.id, value);
    }
  };

  if (dataQuery.isLoading) {
    return <div className="muted">Loading {structure.name.toLowerCase()}...</div>;
  }

  if (dataQuery.error) {
    return <div className="error">Failed to load {structure.name.toLowerCase()}</div>;
  }

  if (!dataQuery.data || tableData.length === 0) {
    return <div className="muted">No {structure.name.toLowerCase()} available</div>;
  }

  return (
    <div>
      <DataTable
        data={tableData}
        columns={columns as any}
        onRowSelect={handleRowSelect}
        selectedRowId={currentValue}
        getRowId={getRowId}
        enableSorting={true}
        enableFiltering={true}
        maxHeight="400px"
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </div>
  );
}
