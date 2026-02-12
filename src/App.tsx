import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getHalo, getHalos, resolve as resolveURL, getResourcesConfig } from './api';
import type { HaloGlobalInfo, HaloCatalog, HaloCatalogData, ResourcesConfig } from './types';
import CutoutRunner from './components/CutoutRunner';
import InfoRow from './components/InfoRow';
import DynamicResourceCard from './components/DynamicResourceCard';
import './styles.css';
import HaloCatalogExample from './components/HaloCatalogExample';

const qc = new QueryClient();

function useManifest(simulationId: string, outputId: number) {
  // Use the same catalog query that HaloCatalogPointCloud uses
  const catalogQuery = useHaloCatalog(simulationId, outputId);

  return useQuery({
    queryKey: ['manifest', simulationId, outputId],
    queryFn: async () => {
      if (!catalogQuery.data) {
        throw new Error('Catalog not loaded');
      }

      // Convert catalog halos to manifest format
      // Sort by mass (descending) to show most massive halos first
      const sortedHalos = [...catalogQuery.data.halos].sort((a, b) => b.mass - a.mass);

      // Limit to top 50 halos to keep dropdown manageable and avoid UI issues
      const topHalos = sortedHalos.slice(0, 50);

      const manifestHalos = topHalos.map((halo) => ({
        id: halo.id.toString().padStart(6, '0'), // Format as "000001", "000002", etc.
        name: `Halo ${halo.id}`,
      }));

      return { halos: manifestHalos };
    },
    enabled: !!catalogQuery.data,
    staleTime: Infinity, // Never goes stale since it's derived from catalog data
  });
}

function useHalo(simulationId: string, outputId: number, id: string | null) {
  return useQuery<HaloCatalogData | null>({
    enabled: !!id,
    queryKey: ['halo', simulationId, outputId, id],
    queryFn: ({ signal }) => getHalo(simulationId, outputId, id!, signal),
  });
}

function useHaloCatalog(simulationId: string, outputId: number) {
  const catalogUrl = `data/catalogues/${simulationId}/halos_${outputId}.0.ascii`;
  return useQuery<HaloCatalog>({
    queryKey: ['halo-catalog', simulationId, outputId],
    queryFn: ({ signal }) => getHalos(catalogUrl, signal),
    staleTime: Infinity, // 5 minutes
  });
}

function useResourcesConfig() {
  return useQuery<ResourcesConfig>({
    queryKey: ['resources-config'],
    queryFn: ({ signal }) => getResourcesConfig(signal),
    staleTime: Infinity,
  });
}

function HaloPanel({ halo }: { halo: HaloCatalogData }) {
  return (
    <div className="card">
      <div className="card-title">Global Information</div>
      <InfoRow label="Halo ID" value={halo.id} noLatex={true} />

      <InfoRow
        labelLatex="M_{200b}"
        value={halo.mass}
        unit="M_\odot" // solar masses
      />

      <InfoRow
        labelLatex="R_{200b}"
        value={halo.rvir * 1000} // Convert Mpc to kpc for display
        unit="\mathrm{kpc}"
      />

      <InfoRow
        labelLatex="R_c"
        value={halo.rc * 1000} // Convert Mpc to kpc for display
        unit="\mathrm{kpc}"
      />

      <InfoRow
        label="Position"
        value={`(${halo.x.toFixed(1)}, ${halo.y.toFixed(1)}, ${halo.z.toFixed(1)})`}
        unit="\mathrm{Mpc}"
        noLatex={true}
      />
    </div>
  );
}

function Shell() {
  const resourcesQ = useResourcesConfig();
  const [currentId, setCurrentId] = useState<string | null>(null);
  enum SimulationIds {
    MEGATRON_CP_NEW = 'MEGATRON_CP_NEW',
    MEGATRON_CP_599 = 'MEGATRON_CP_599',
    MEGATRON_CP_599_var95 = 'MEGATRON_CP_599_var95',
  }
  const [simulationId, setSimulationId] = useState<SimulationIds>(SimulationIds.MEGATRON_CP_NEW);
  const [outputId, setOutputId] = useState<number>(10);
  const manQ = useManifest(simulationId, outputId);
  const haloQ = useHalo(simulationId, outputId, currentId);

  // Reset currentId when simulation or output changes
  useEffect(() => {
    setCurrentId(null);
  }, [simulationId, outputId]);

  useEffect(() => {
    if (manQ.data && !currentId) {
      const i = 0;
      console.log(`Setting to ${manQ.data.halos[i]?.id}.`);
      setCurrentId(manQ.data.halos[i]?.id ?? null);
    }
  }, [manQ.data, currentId]);

  return (
    <div className="container">
      <header className="header">
        <h1>Halo Viewer</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={simulationId}
            onChange={(e) => setSimulationId(e.target.value as SimulationIds)}
          >
            {Object.entries(SimulationIds).map(([key, value]) => (
              <option key={key} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select value={outputId} onChange={(e) => setOutputId(Number(e.target.value))}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((id) => (
              <option key={id} value={id}>
                Output {id}
              </option>
            ))}
          </select>
          {manQ.isSuccess && (
            <select value={currentId ?? ''} onChange={(e) => setCurrentId(e.target.value)}>
              {manQ.data!.halos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name || h.id}
                </option>
              ))}
            </select>
          )}
          {haloQ.isFetching && <span className="muted">Loading…</span>}
        </div>
      </header>

      {!currentId && <div className="muted">No halo selected.</div>}
      {haloQ.error && <div className="error">Failed to load halo metadata.</div>}
      {haloQ.data && (
        <>
          <div className="grid2">
            <CutoutRunner
              cutoutUrl={resolveURL(
                `data/cutouts/${simulationId}/output_${String(outputId).padStart(5, '0')}/halo_${haloQ.data.id}_gas.bin`
              )}
            />
            <HaloCatalogExample
              simulationId={simulationId}
              outputId={outputId}
              selectedHaloId={currentId ? parseInt(currentId) : undefined}
            />
            <HaloPanel halo={haloQ.data} />
            {/* Dynamic resource cards based on resources.json */}
            {resourcesQ.data?.resources
              .filter((resource) => {
                resource.type !== 'metadata';
              })
              .map((resource) => (
                <DynamicResourceCard key={resource.id} halo={haloQ.data!} resource={resource} />
              ))}
          </div>
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
