import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHalos } from '../api';
import PointCloud3D from './PointCloud3D';
import InfoRow from './InfoRow';

interface HaloCatalogPointCloudProps {
  catalogUrl?: string;
  pointSize?: number;
  pointColor?: string;
  massThreshold?: number;
  selectedHaloId?: number;
}

const HaloCatalogPointCloud: React.FC<HaloCatalogPointCloudProps> = ({
  catalogUrl = 'demo-halos/halos_00100.ascii',
  pointColor = '#4a90e2',
  massThreshold = 0,
  selectedHaloId,
}) => {
  // Use React Query to fetch and cache halo catalog data
  const catalogQuery = useQuery({
    queryKey: ['halo-catalog', catalogUrl],
    queryFn: ({ signal }) => getHalos(catalogUrl, signal),
    staleTime: 300_000, // 5 minutes
  });

  // Filter halos by mass threshold and prepare data for PointCloud3D
  const { x, y, z, rvir, rc, ids, filteredStats } = useMemo(() => {
    if (!catalogQuery.data) {
      return { x: [], y: [], z: [], rvir: [], rc: [], ids: [], filteredStats: null };
    }

    const filteredHalos = catalogQuery.data.halos.filter(halo => halo.mass >= massThreshold);

    const filteredStats = {
      ...catalogQuery.data.stats,
      filtered: filteredHalos.length,
    };

    return {
      x: filteredHalos.map(halo => halo.x),
      y: filteredHalos.map(halo => halo.y),
      z: filteredHalos.map(halo => halo.z),
      rvir: filteredHalos.map(halo => halo.r200b),
      rc: filteredHalos.map(halo => halo.rc),
      ids: filteredHalos.map(halo => halo.id),
      filteredStats,
    };
  }, [catalogQuery.data, massThreshold]);

  if (catalogQuery.isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: '#666'
      }}>
        Loading halo catalog...
      </div>
    );
  }

  if (catalogQuery.error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: '#e74c3c',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div>Error loading catalog:</div>
        <div style={{ fontSize: '14px' }}>
          {catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Unknown error occurred'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <PointCloud3D
        x={x}
        y={y}
        z={z}
        size={rvir}
        core_size={rc}
        pointColor={pointColor}
        ids={ids}
        selectedHaloId={selectedHaloId}
      />

      {filteredStats && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          pointerEvents: 'none'
        }}>
          <InfoRow label="Halos" value={`${filteredStats.filtered.toLocaleString()} / ${filteredStats.total.toLocaleString()}`} />
          <InfoRow label="M_\mathrm{min}" value={filteredStats.massRange[0]} unit="M_\odot" />
          <InfoRow label="M_\mathrm{max}" value={filteredStats.massRange[1]} unit="M_\odot" />
          <InfoRow label="X" value={`[${filteredStats.positionRange.x[0].toFixed(1)}, ${filteredStats.positionRange.x[1].toFixed(1)}]`} unit="Mpc/h" />
          <InfoRow label="Y" value={`[${filteredStats.positionRange.y[0].toFixed(1)}, ${filteredStats.positionRange.y[1].toFixed(1)}]`} unit="Mpc/h" />
          <InfoRow label="Z" value={`[${filteredStats.positionRange.z[0].toFixed(1)}, ${filteredStats.positionRange.z[1].toFixed(1)}]`} unit="Mpc/h" />
        </div>
      )}
    </div>
  );
};

export default HaloCatalogPointCloud;
