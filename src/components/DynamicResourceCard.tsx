// src/components/DynamicResourceCard.tsx
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HaloCatalogData, ResourceConfig, Data1D, Data1DJSON } from '../types';
import { getData1D } from '../api';
import Data1DChartjs from './Data1DChartjs';

interface DynamicResourceCardProps {
  halo: HaloCatalogData;
  resource: ResourceConfig;
}

function useResourceData(resource: ResourceConfig, haloId: number) {
  return useQuery<Data1DJSON>({
    enabled: !!resource && !!haloId,
    queryKey: ['resource', resource.id, haloId],
    queryFn: ({ signal }) => getData1D(resource, haloId, signal),
  });
}

function downloadData(data: Data1D, filename: string, resource: ResourceConfig) {
  // Create a JSON representation of the data
  const output = {
    [resource.xAxis?.key || 'x']: Array.from(data.x),
    [resource.yAxis?.key || 'y']: Array.from(data.y),
  };

  const jsonStr = JSON.stringify(output, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DynamicResourceCard({ halo, resource }: DynamicResourceCardProps) {
  const dataQ = useResourceData(resource, halo.id);

  const data: Data1D | null = useMemo(() => {
    if (!dataQ.data) return null;

    if (resource.type === '1D') {
      // Handle 1D data
      if ('wavelength' in dataQ.data && 'data' in dataQ.data) {
        const haloData = dataQ.data.data[halo.id.toString()];
        const dataKey = resource.dataKey || 'total';

        if (haloData && haloData[dataKey as keyof typeof haloData]) {
          return {
            x: dataQ.data.wavelength,
            y: haloData[dataKey as keyof typeof haloData] as Float64Array,
          };
        }
        return null;
      }
    }
    return null;
  }, [dataQ.data, halo.id, resource]);

  const handleDownload = () => {
    if (!data) return;
    const filename = `${resource.id}_halo_${halo.id}.json`;
    downloadData(data, filename, resource);
  };

  return (
    <div className="card">
      <div
        className="card-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{resource.name}</span>
        {resource.downloadable !== false && data && (
          <button
            onClick={handleDownload}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              background: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            Download
          </button>
        )}
      </div>
      {dataQ.isLoading && (
        <div className="muted">
          Loading {resource.name.toLowerCase()} for halo {halo.id}…
        </div>
      )}
      {dataQ.error && <div className="error">Failed to load {resource.name.toLowerCase()}</div>}
      {data && resource.type === '1D' && (
        <Data1DChartjs
          data={data}
          xLabel={resource.xAxis?.label}
          xUnit={resource.xAxis?.unit}
          yLabel={resource.yAxis?.label}
          yUnit={resource.yAxis?.unit}
        />
      )}
    </div>
  );
}
