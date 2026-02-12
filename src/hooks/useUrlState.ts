import { useEffect, useCallback, useRef } from 'react';
import { SelectionState, StructureConfig } from '../types';

/**
 * Hook to sync selection state with URL query parameters
 * @param selections Current selection state
 * @param setSelections Function to update selections
 * @param structure Structure configuration to identify derived values
 */
export function useUrlState(
  selections: SelectionState,
  setSelections: (selections: SelectionState) => void,
  structure: StructureConfig[]
) {
  const isInitialMount = useRef(true);
  const ignoreNextUrlChange = useRef(false);

  // Build a set of derived structure IDs for quick lookup
  const derivedIds = useRef(new Set<string>());
  useEffect(() => {
    derivedIds.current = new Set(
      structure.filter((item) => item.derived_from).map((item) => item.id)
    );
  }, [structure]);

  // Read from URL on initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const params = new URLSearchParams(window.location.search);
      const urlSelections: SelectionState = {};

      // Parse all query parameters as selections
      params.forEach((value, key) => {
        // Try to parse as number if possible
        const numValue = Number(value);
        urlSelections[key] = isNaN(numValue) ? value : numValue;
      });

      // Only update if we found any selections in URL
      if (Object.keys(urlSelections).length > 0) {
        ignoreNextUrlChange.current = true;
        setSelections(urlSelections);
      }
    }
  }, [setSelections]);

  // Write to URL when selections change
  useEffect(() => {
    if (ignoreNextUrlChange.current) {
      ignoreNextUrlChange.current = false;
      return;
    }

    const params = new URLSearchParams();

    // Add non-derived selections to URL params
    Object.entries(selections).forEach(([key, value]) => {
      // Skip derived values
      if (derivedIds.current.has(key)) {
        return;
      }

      if (value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    });

    // Update URL without triggering navigation
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [selections]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlSelections: SelectionState = {};

      params.forEach((value, key) => {
        const numValue = Number(value);
        urlSelections[key] = isNaN(numValue) ? value : numValue;
      });

      ignoreNextUrlChange.current = true;
      setSelections(urlSelections);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setSelections]);
}
