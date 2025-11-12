import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getHalo, getManifest, getSpectrum, spectrumPath, resolve as resolveURL } from './api';
import type { HaloGlobalInfo, SpectrumJSON } from './types';
// import SpectrumPyodide from './components/SpectrumPyodide';
// import SpectrumCanvas from './components/SpectrumCanvas';
import SpectrumChartjs from './components/SpectrumChartjs';
import CutoutRunner from './components/CutoutRunner';
import InfoRow from './components/InfoRow';
import './styles.css';

const qc = new QueryClient();

function useManifest() {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: ({ signal }) => getManifest(signal),
    staleTime: 60_000,
  });
}

function useHalo(id: string | null) {
  return useQuery<HaloGlobalInfo>({
    enabled: !!id,
    queryKey: ['halo', id],
    queryFn: ({ signal }) => getHalo(id!, signal),
  });
}

// function SpectrumCard({ halo }: { halo: HaloGlobalInfo }) {
//   const url = halo.spectrum ? halo.spectrum : spectrumPath(halo.id);
//   const full = resolveURL(url);
//   return (
//     <div className="card">
//       <div className="card-title">Spectrum (Pyodide + Matplotlib)</div>
//       <SpectrumPyodide specUrl={full} height={260} />
//     </div>
//   );
// }

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
      return { lambda: Float64Array.from(specQ.data.lambda), flux: Float64Array.from(specQ.data.flux) };
    }
    if ('pairs' in specQ.data) {
      const n = specQ.data.pairs.length;
      const l = new Float64Array(n);
      const f = new Float64Array(n);
      for (let i = 0; i < n; i++) { l[i] = specQ.data.pairs[i][0]; f[i] = specQ.data.pairs[i][1]; }
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

function HaloPanel({ halo }: { halo: HaloGlobalInfo }) {
  const [imgKey, setImgKey] = useState<string>(() => Object.keys(halo.images ?? {})[0] ?? '');
  useEffect(() => {
    const first = Object.keys(halo.images ?? {})[0] ?? '';
    setImgKey(first);
  }, [halo.id]);

  const imageURL = useMemo(() => (imgKey && halo.images?.[imgKey]) ? new URL(halo.images[imgKey], window.location.origin).toString() : '', [imgKey, halo.images]);

  return (
    <div className="grid2">
      <div className="card">
        <div className="card-title">Global Information</div>
        <InfoRow label="Halo ID" value={halo.id} />

        <InfoRow label="Name" value={halo.name ?? ''} />

        <InfoRow
          labelLatex="M_{\rm DM}"
          value={halo.dm_mass.toExponential(3)}
          unit="M_\odot"          // solar masses
        />

        <InfoRow
          labelLatex="M_\star"
          value={halo.stellar_mass.toExponential(3)}
          unit="M_\odot"
        />

        <InfoRow
          labelLatex="R_{\rm vir}"
          value={halo.r_vir.toFixed(2)}
          unit="\mathrm{kpc}"
        />
      </div>

      <div className="card">
        <div className="card-title">Image</div>
        {Object.keys(halo.images || {}).length === 0 && <div className="muted">No images provided.</div>}
        {Object.keys(halo.images || {}).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="imgsel" className="muted" style={{ marginRight: 8 }}>View:</label>
            <select id="imgsel" value={imgKey} onChange={(e) => setImgKey(e.target.value)}>
              {Object.keys(halo.images).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        )}
        {imageURL && (
          <img src={imageURL} alt={`${halo.id} ${imgKey}`} style={{ width: '100%', borderRadius: 8 }} />
        )}
      </div>

      <SpectrumCard halo={halo} />

      <CutoutRunner cutoutUrl={resolveURL(`demo-halos/halo_${halo.id}_gas.bin`)} />
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

  return (
    <div className="container">
      <header className="header">
        <h1>Halo Viewer</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {manQ.isSuccess && (
            <select value={currentId ?? ''} onChange={(e) => setCurrentId(e.target.value)}>
              {manQ.data!.halos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name ? `${h.name} (${h.id})` : h.id}
                </option>
              ))}
            </select>
          )}
          {haloQ.isFetching && <span className="muted">Loading…</span>}
        </div>
      </header>

      {!currentId && <div className="muted">No halo selected.</div>}
      {haloQ.error && <div className="error">Failed to load halo metadata.</div>}
      {haloQ.data && <HaloPanel halo={haloQ.data} />}

      <footer className="footer">
        <span className="muted">Static SPA • Vite + React + TanStack Query • Pyodide + Matplotlib</span>
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