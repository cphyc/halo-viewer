import { useMemo } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { resolve as resolveURL, getResourcesConfig } from './api';
import type { HaloCatalogData, ResourcesConfig } from './types';
import CutoutRunner from './components/CutoutRunner';
import InfoRow from './components/InfoRow';
import SelectionPanel from './components/SelectionPanel';
import ResourceLevel from './components/ResourceLevel';
import { useHierarchicalSelection } from './hooks/useHierarchicalSelection';
import { filterResourcesByLevel, groupResourcesByLevel } from './utils/resourceFilters';
import './styles.css';
import HaloCatalogExample from './components/HaloCatalogExample';

const qc = new QueryClient();

function useResourcesConfig() {
  return useQuery<ResourcesConfig>({
    queryKey: ['resources-config'],
    queryFn: ({ signal }) => getResourcesConfig(signal),
    staleTime: Infinity,
  });
}

function HaloPanel({ haloData }: { haloData: HaloCatalogData | undefined }) {
  if (!haloData) return null;

  return (
    <div className="card">
      <div className="card-title">Global Information</div>
      <InfoRow label="Halo ID" value={haloData.id} noLatex={true} />

      <InfoRow labelLatex="M_{200b}" value={haloData.mass} unit="M_\odot" />

      <InfoRow labelLatex="R_{200b}" value={haloData.rvir * 1000} unit="\mathrm{kpc}" />

      <InfoRow labelLatex="R_c" value={haloData.rc * 1000} unit="\mathrm{kpc}" />

      <InfoRow
        label="Position"
        value={`(${haloData.x.toFixed(1)}, ${haloData.y.toFixed(1)}, ${haloData.z.toFixed(1)})`}
        unit="\mathrm{Mpc}"
        noLatex={true}
      />
    </div>
  );
}

function Shell() {
  const resourcesQ = useResourcesConfig();
  const { selections, setSelection, orderedStructure } = useHierarchicalSelection(resourcesQ.data);

  // Filter resources based on current selections
  const availableResources = useMemo(() => {
    if (!resourcesQ.data) return [];
    return filterResourcesByLevel(resourcesQ.data.resources, selections);
  }, [resourcesQ.data, selections]);

  // Group resources by level
  const groupedResources = useMemo(() => {
    return groupResourcesByLevel(availableResources);
  }, [availableResources]);

  // Check if all required selections for special components are made
  const hasSimulationId = selections.simulationId !== undefined;
  const hasOutputId = selections.outputId !== undefined;
  const hasHaloId = selections.haloId !== undefined;
  const allSelectionsComplete = hasSimulationId && hasOutputId && hasHaloId;

  // Get halo data for the info panel (if available)
  const haloData: HaloCatalogData | undefined = useMemo(() => {
    if (!allSelectionsComplete) return undefined;

    // Note: We would need to fetch this from the catalog
    // For now, we'll return undefined and handle this later
    return undefined;
  }, [allSelectionsComplete, selections]);

  return (
    <div className="container">
      <header className="header">
        <h1>Halo Viewer</h1>
      </header>

      {resourcesQ.isLoading && <div className="muted">Loading configuration…</div>}
      {resourcesQ.error && <div className="error">Failed to load resources configuration.</div>}

      {resourcesQ.data && (
        <>
          <SelectionPanel
            orderedStructure={orderedStructure}
            selections={selections}
            onSelectionChange={setSelection}
          />

          {/* Show special components only when all selections are made */}
          {allSelectionsComplete && (
            <div className="grid2">
              <CutoutRunner
                cutoutUrl={resolveURL(
                  `data/cutouts/${selections.simulationId}/output_${String(selections.outputId).padStart(5, '0')}/halo_${selections.haloId}_gas.bin`
                )}
              />
              <HaloCatalogExample
                simulationId={String(selections.simulationId)}
                outputId={Number(selections.outputId)}
                selectedHaloId={Number(selections.haloId)}
              />
              <HaloPanel haloData={haloData} />
            </div>
          )}

          {/* Render resources grouped by level */}
          {Array.from(groupedResources.entries())
            .sort(([a], [b]) => a - b)
            .map(([level, resources]) => (
              <ResourceLevel
                key={level}
                level={level}
                resources={resources}
                selections={selections}
              />
            ))}

          {availableResources.length === 0 && Object.keys(selections).length > 0 && (
            <div className="muted">No resources available for current selection.</div>
          )}
        </>
      )}

      <footer className="footer">
        <span className="muted">Megatron Data Viewer • Cadiou, Katz, Rey</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <Shell />
    </QueryClientProvider>
  );
}
