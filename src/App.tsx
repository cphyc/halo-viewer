import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getHalo, getSpectrum, getHalos, spectrumPath, resolve as resolveURL } from './api';
import type { HaloGlobalInfo, SpectrumJSON, SpecData, HaloCatalog, HaloCatalogData } from './types';
import SpectrumChartjs from './components/SpectrumChartjs';
import CutoutRunner from './components/CutoutRunner';
import InfoRow from './components/InfoRow';
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
    placeholderData: {
      halos: [
        { id: '000001', name: 'Loading...' },
        { id: '000002', name: 'Please wait...' },
      ],
    },
  });
}

function useHalo(id: string | null) {
  return useQuery<HaloCatalogData | null>({
    enabled: !!id,
    queryKey: ['halo', id],
    queryFn: ({ signal }) => getHalo(id!, signal),
  });
}

function useHaloCatalog(catalogUrl: string = 'demo-halos/halos_00100.ascii') {
  return useQuery<HaloCatalog>({
    queryKey: ['halo-catalog', catalogUrl],
    queryFn: ({ signal }) => getHalos(catalogUrl, signal),
    staleTime: 300_000, // 5 minutes
  });
}

function useSpectrum(specPath: string | null) {
  return useQuery<SpectrumJSON>({
    enabled: !!specPath,
    queryKey: ['spectrum', specPath],
    queryFn: ({ signal }) => getSpectrum(specPath!, signal),
  });
}

function SpectrumCard({ halo }: { halo: HaloGlobalInfo }) {
  const specQ = useSpectrum(halo.spectrum ? halo.spectrum : spectrumPath(halo.id));

  const data: SpecData | null = useMemo(() => {
    if (!specQ.data) return null;
    if ('lambda' in specQ.data && 'flux' in specQ.data) {
      return {
        lambda: Float64Array.from(specQ.data.lambda),
        flux: Float64Array.from(specQ.data.flux),
      };
    }
    if ('pairs' in specQ.data) {
      const n = specQ.data.pairs.length;
      const l = new Float64Array(n);
      const f = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        l[i] = specQ.data.pairs[i][0];
        f[i] = specQ.data.pairs[i][1];
      }
      return { lambda: l, flux: f };
    }
    return null;
  }, [specQ.data]);

  return (
    <div className="card">
      <div className="card-title">Spectrum</div>
      {specQ.isLoading && <div className="muted">Loading spectrum…</div>}
      {specQ.error && <div className="error">Failed to load spectrum</div>}
      {data && <SpectrumChartjs data={data} />}
    </div>
  );
}

function HaloPanel({
  halo,
  environmentComponent,
}: {
  halo: HaloCatalogData;
  environmentComponent: React.ReactNode;
}) {
  return (
    <div className="grid2">
      <div className="card">
        <div className="card-title">Environment</div>
        {environmentComponent}
      </div>
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
          value={halo.r200b * 1000} // Convert Mpc to kpc for display
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

      <div className="card">
        <div className="card-title">Spectrum</div>
        <div className="muted">
          Spectrum data available in catalog mode: halo_{halo.id.toString().padStart(6, '0')}
          _spectrum.json
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const manQ = useManifest();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const haloQ = useHalo(currentId);

  useEffect(() => {
    if (manQ.data && !currentId) {
      setCurrentId(manQ.data.halos[0]?.id ?? null);
    }
  }, [manQ.data, currentId]);

  // Create a persistent environment component that reuses the Three.js canvas
  const environmentComponent = useMemo(
    () => <HaloCatalogExample selectedHaloId={currentId ? parseInt(currentId) : undefined} />,
    [currentId]
  );

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
      {haloQ.data && <HaloPanel halo={haloQ.data} environmentComponent={environmentComponent} />}
      <>
        {/* <SpectrumCard halo={haloQ.data} /> */}
        <CutoutRunner cutoutUrl={resolveURL(`demo-halos/halo_${haloQ.id}_gas.bin`)} />
      </>
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
