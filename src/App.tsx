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

function useManifest() {
  // Use the same catalog query that HaloCatalogPointCloud uses
  const catalogQuery = useHaloCatalog();

  return useQuery({
    queryKey: ['manifest', 'derived'],
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

function useHalo(id: string | null) {
  return useQuery<HaloCatalogData | null>({
    enabled: !!id,
    queryKey: ['halo', id],
    queryFn: ({ signal }) => getHalo(id!, signal),
  });
}

function useHaloCatalog(catalogUrl: string = 'demo-halos/cutouts/halos_00100.ascii') {
  return useQuery<HaloCatalog>({
    queryKey: ['halo-catalog', catalogUrl],
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
  const manQ = useManifest();
  const resourcesQ = useResourcesConfig();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const haloQ = useHalo(currentId);

  useEffect(() => {
    if (manQ.data && !currentId) {
      const i = manQ.data.halos.length - 1;
      console.log(`Setting to ${manQ.data.halos[i]?.id}.`);
      setCurrentId(manQ.data.halos[i]?.id ?? null);
    }
  }, [manQ.data, currentId]);

  return (
    <div className="container">
      <header className="header">
        <h1>Halo Viewer</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                `demo-halos/cutouts/output_00100/halo_${haloQ.data.id}_gas.bin`
              )}
            />
            <HaloCatalogExample selectedHaloId={currentId ? parseInt(currentId) : undefined} />
            <HaloPanel halo={haloQ.data} />
            {/* Dynamic resource cards based on resources.json */}
            {resourcesQ.data?.resources.map((resource) => (
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
