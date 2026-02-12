import { useState } from 'react';
import { StructureConfig, SelectionState } from '../types';
import { useStructureOptions } from '../hooks/useHierarchicalSelection';
import TableSelector from './TableSelector';

interface SelectionPanelProps {
  orderedStructure: StructureConfig[];
  selections: SelectionState;
  onSelectionChange: (structureId: string, value: string | number | null) => void;
}

interface StructureItemSelectorProps {
  structure: StructureConfig;
  selections: SelectionState;
  onSelectionChange: (structureId: string, value: string | number | null) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function StructureItemSelector({
  structure,
  selections,
  onSelectionChange,
  isCollapsed,
  onToggleCollapse,
}: StructureItemSelectorProps) {
  const optionsQuery = useStructureOptions(structure, selections);
  const currentValue = selections[structure.id];
  const isDerived = !!structure.derived_from;
  const isSelected = currentValue !== undefined;
  const selectionType = structure.selectionType || 'dropdown';

  // Check if all requirements are met
  const requirementsMet =
    structure.requires?.every((reqId) => selections[reqId] !== undefined) ?? true;

  if (!requirementsMet) {
    return null;
  }

  const handleClear = () => {
    onSelectionChange(structure.id, null);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px',
          background: isSelected ? '#f0f0f0' : 'transparent',
          borderRadius: 4,
        }}
      >
        {isSelected && !isDerived && (
          <button
            onClick={onToggleCollapse}
            style={{
              padding: '2px 6px',
              fontSize: '12px',
              cursor: 'pointer',
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: 3,
            }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        )}

        <label style={{ minWidth: 120, fontWeight: isSelected ? 'bold' : 'normal' }}>
          {structure.name}:
        </label>

        {isDerived ? (
          <span style={{ fontStyle: 'italic', color: '#666' }}>
            {currentValue !== undefined ? String(currentValue) : '(computed)'}
          </span>
        ) : (
          <>
            {isCollapsed && currentValue !== undefined && (
              <span style={{ color: '#666', flex: 1 }}>
                {optionsQuery.data?.find((opt) => opt.id === currentValue)?.label ||
                  String(currentValue)}
              </span>
            )}
            {isSelected && (
              <button
                onClick={handleClear}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: '#ff5252',
                  color: 'white',
                  border: 'none',
                  borderRadius: 3,
                }}
                title="Clear selection"
              >
                ✕ Clear
              </button>
            )}
          </>
        )}
      </div>

      {!isCollapsed && !isDerived && (
        <div style={{ marginTop: 8, marginLeft: 32 }}>
          {selectionType === 'table' ? (
            <TableSelector
              structure={structure}
              selections={selections}
              onSelectionChange={onSelectionChange}
            />
          ) : (
            <>
              <select
                value={currentValue !== undefined ? String(currentValue) : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    onSelectionChange(structure.id, null);
                  } else {
                    // Try to parse as number if possible
                    const numValue = Number(value);
                    onSelectionChange(structure.id, isNaN(numValue) ? value : numValue);
                  }
                }}
                disabled={optionsQuery.isLoading}
                style={{ width: '100%', maxWidth: 400 }}
              >
                <option value="">-- Select {structure.name} --</option>
                {optionsQuery.data?.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {optionsQuery.isLoading && <span className="muted">Loading options…</span>}
              {optionsQuery.error && <span className="error">Failed to load options</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SelectionPanel({
  orderedStructure,
  selections,
  onSelectionChange,
}: SelectionPanelProps) {
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  const toggleCollapse = (structureId: string) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(structureId)) {
        next.delete(structureId);
      } else {
        next.add(structureId);
      }
      return next;
    });
  };

  return (
    <div className="card">
      <div className="card-title">Data Selection</div>
      {orderedStructure.map((structure) => (
        <StructureItemSelector
          key={structure.id}
          structure={structure}
          selections={selections}
          onSelectionChange={onSelectionChange}
          isCollapsed={collapsedItems.has(structure.id)}
          onToggleCollapse={() => toggleCollapse(structure.id)}
        />
      ))}
    </div>
  );
}
