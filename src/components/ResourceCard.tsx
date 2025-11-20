// src/components/ResourceCard.tsx
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSpectrum, resolve as resolveURL } from '../api';
import type { ResourceConfig, HaloCatalogData, SpectrumJSON, SpecData } from '../types';
import SpectrumChartjs from './SpectrumChartjs';

function DownloadLink({ url, title }: { url: string; title: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <a
        href={url}
        download
        style={{
          display: 'inline-block',
          padding: '4px 8px',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          color: 'inherit',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
        }}
      >
        ⬇ Download {title}
      </a>
    </div>
  );
}

function SpectrumResourceCard({ halo, url }: { halo: HaloCatalogData; url: string }) {
  const specQ = useQuery<SpectrumJSON>({
    queryKey: ['spectrum', url],
    queryFn: ({ signal }) => getSpectrum(url, signal),
  });

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
    <>
      {specQ.isLoading && <div className="muted">Loading spectrum for halo {halo.id}…</div>}
      {specQ.error && <div className="error">Failed to load spectrum</div>}
      {data && (
        <>
          <SpectrumChartjs data={data} />
          <DownloadLink url={resolveURL(url)} title="Spectrum Data" />
        </>
      )}
    </>
  );
}

function ImageResourceCard({ halo, url }: { halo: HaloCatalogData; url: string }) {
  const resolvedUrl = resolveURL(url);

  return (
    <>
      <img
        src={resolvedUrl}
        alt={`Image for halo ${halo.id}`}
        style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error';
          errorDiv.textContent = 'Failed to load image';
          target.parentElement?.insertBefore(errorDiv, target);
        }}
      />
      <DownloadLink url={resolvedUrl} title="Image" />
    </>
  );
}

export default function ResourceCard({
  resource,
  halo,
}: {
  resource: ResourceConfig;
  halo: HaloCatalogData;
}) {
  // Replace {id} in urlTemplate with actual halo id
  const url = resource.urlTemplate.replace('{id}', halo.id.toString());

  return (
    <div className="card">
      <div className="card-title">{resource.title}</div>
      {resource.dataType === 'spectrum' && <SpectrumResourceCard halo={halo} url={url} />}
      {resource.dataType === 'image' && <ImageResourceCard halo={halo} url={url} />}
      {/* Add support for other resource types here */}
    </div>
  );
}
