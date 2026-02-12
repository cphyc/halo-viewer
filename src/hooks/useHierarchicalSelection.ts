import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StructureConfig, StructureOption, SelectionState, ResourcesConfig } from '../types';
import { getStructureOptions, evaluateDerivedValue } from '../api';
import { getOrderedStructure } from '../utils/resourceFilters';

export function useHierarchicalSelection(config: ResourcesConfig | undefined) {
  const [selections, setSelections] = useState<SelectionState>({});

  // Get ordered structure items
  const orderedStructure = useMemo(() => {
    if (!config) return [];
    return getOrderedStructure(config.structure);
  }, [config]);

  // Update derived values when selections change
  useEffect(() => {
    if (!config) return;

    const newSelections = { ...selections };
    let hasChanges = false;

    for (const item of orderedStructure) {
      if (item.derived_from) {
        // Check if all required selections are available
        const allRequirementsAvailable = item.requires?.every(
          (reqId) => newSelections[reqId] !== undefined
        );

        if (allRequirementsAvailable) {
          try {
            const derivedValue = evaluateDerivedValue(item.derived_from, newSelections);
            if (newSelections[item.id] !== derivedValue) {
              newSelections[item.id] = derivedValue;
              hasChanges = true;
            }
          } catch (error) {
            console.error(`Failed to compute derived value for ${item.id}:`, error);
          }
        }
      }
    }

    if (hasChanges) {
      setSelections(newSelections);
    }
  }, [selections, config, orderedStructure]);

  // Set a selection at a given structure item
  const setSelection = (structureId: string, value: string | number | null) => {
    if (!config) return;

    setSelections((prev) => {
      const newSelections = { ...prev };

      if (value === null) {
        // Clear this selection and all dependent selections
        delete newSelections[structureId];

        // Find and clear dependent items
        for (const item of orderedStructure) {
          if (item.requires?.includes(structureId)) {
            delete newSelections[item.id];
          }
        }
      } else {
        newSelections[structureId] = value;
      }

      return newSelections;
    });
  };

  // Clear selections from a given level onwards
  const clearFromLevel = (structureItem: StructureConfig) => {
    if (!config) return;

    setSelections((prev) => {
      const newSelections = { ...prev };
      const tree = new Map(orderedStructure.map((item) => [item.id, item]));

      // Find the index of the structure item
      const index = orderedStructure.findIndex((item) => item.id === structureItem.id);
      if (index === -1) return prev;

      // Clear this and all subsequent items
      for (let i = index; i < orderedStructure.length; i++) {
        delete newSelections[orderedStructure[i].id];
      }

      return newSelections;
    });
  };

  // Get the next unselected structure item
  const getNextUnselected = (): StructureConfig | null => {
    for (const item of orderedStructure) {
      // Skip derived items (they're computed automatically)
      if (item.derived_from) continue;

      // Check if this item is already selected
      if (selections[item.id] !== undefined) continue;

      // Check if all requirements are met
      const allRequirementsMet =
        item.requires?.every((reqId) => selections[reqId] !== undefined) ?? true;

      if (allRequirementsMet) {
        return item;
      }
    }

    return null;
  };

  return {
    selections,
    setSelection,
    clearFromLevel,
    orderedStructure,
    getNextUnselected,
  };
}

// Hook to fetch options for a specific structure item
export function useStructureOptions(structure: StructureConfig, selections: SelectionState) {
  // Check if all required selections are available
  const requirementsMet =
    structure.requires?.every((reqId) => selections[reqId] !== undefined) ?? true;

  return useQuery<StructureOption[]>({
    queryKey: ['structure-options', structure.id, selections],
    queryFn: ({ signal }) => getStructureOptions(structure, selections, signal),
    enabled: !!structure.pathTemplate && !structure.derived_from && requirementsMet,
    staleTime: Infinity,
  });
}
