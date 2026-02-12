// src/components/DynamicResourceCard.tsx
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResourceConfig, Data1D, Data1DJSON, SelectionState } from '../types';
import { getData1D } from '../api';
import Data1DChartjs from './Data1DChartjs';

interface DynamicResourceCardProps {
  resource: ResourceConfig;
  selections: SelectionState;
}

function useResourceData(resource: ResourceConfig, selections: SelectionState) {
  return useQuery<Data1DJSON>({
    enabled: !!resource && Object.keys(selections).length > 0,
    queryKey: ['resource', resource.id, selections],
    queryFn: ({ signal }) => getData1D(resource, selections, signal),
  });
}

function downloadData(data: Data1D, filename: string, resource: ResourceConfig) {
  // Create a JSON representation of the data
  // For bundled resources, this data has already been unbundled in the useMemo hook
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

export default function DynamicResourceCard({ resource, selections }: DynamicResourceCardProps) {
  const dataQ = useResourceData(resource, selections);
  const haloId = selections.haloId as number;

  const data: Data1D | null = useMemo(() => {
    if (!dataQ.data) return null;

    if (resource.type === '1D') {
      if (!resource.xAxis || !resource.yAxis) {
        throw new Error(`Resource ${resource.id} is missing required xAxis or yAxis configuration`);
      }

      // Handle 1D data
      if (resource.dataKey === undefined && resource.bucket_size !== 0) {
        throw new Error(`Resource ${resource.id} is missing dataKey for bundled resource`);
        return null;
      }

      if (!haloId) {
        return null;
      }

      const resourceData = dataQ.data[resource.dataKey || 'data'][haloId.toString()];

      if (resource.xAxis.key === undefined || resource.yAxis.key === undefined) {
        throw new Error(`Resource ${resource.id} is missing xAxis.key or yAxis.key`);
      }

      const xkey = resource.xAxis.key;
      const ykey = resource.yAxis.key;

      let xData: Float64Array;
      let yData: Float64Array;

      if (resource.bucket_size > 0) {
        const globalData = dataQ.data;
        xData = (
          xkey in globalData
            ? globalData[xkey as keyof Data1DJSON]
            : resourceData[xkey as keyof typeof resourceData]
        ) as Float64Array;
        yData = (
          ykey in globalData
            ? globalData[ykey as keyof Data1DJSON]
            : resourceData[ykey as keyof typeof resourceData]
        ) as Float64Array;
      } else {
        xData = resourceData[xkey as keyof typeof resourceData] as Float64Array;
        yData = resourceData[ykey as keyof typeof resourceData] as Float64Array;
      }

      return { x: xData, y: yData };
    }
    return null;
  }, [dataQ.data, haloId, resource]);

  const handleDownload = () => {
    if (!data || !haloId) return;
    const filename = `${resource.id}_halo_${haloId}.json`;
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
      {dataQ.isLoading && <div className="muted">Loading {resource.name.toLowerCase()}…</div>}
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
