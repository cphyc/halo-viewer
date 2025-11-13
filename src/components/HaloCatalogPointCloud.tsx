import React, { useState, useEffect, useMemo } from 'react';
import PointCloud3D from './PointCloud3D';
import InfoRow from './InfoRow';

interface HaloData {
  id: number;
  x: number;
  y: number;
  z: number;
  mass: number; // m200b column
  r200b: number;
  rc: number;
}

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
  const [halos, setHalos] = useState<HaloData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    filtered: number;
    massRange: [number, number];
    positionRange: {
      x: [number, number];
      y: [number, number];
      z: [number, number];
    };
  } | null>(null);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(catalogUrl);
        if (!response.ok) {
          throw new Error(`Failed to load catalog: ${response.statusText}`);
        }

        const text = await response.text();
        const lines = text.split('\n');

        const haloData: HaloData[] = [];

        let h0 = 1;

        for (const line of lines) {
          if (line.startsWith('#Om')) {
            const match = line.match(/#h0\s*=\s*([\d.]+)/);
            if (match) {
              h0 = parseFloat(match[1]);
            }
          }
          // Skip comments and empty lines
          if (line.startsWith('#') || line.trim() === '') continue;

          const columns = line.trim().split(/\s+/);
          if (columns.length < 11) continue; // Ensure we have enough columns

          const id = parseInt(columns[0]);
          // Get mass -> provided in Msun/h
          const mass = parseFloat(columns[2]) / h0; // m200b column

          // Get radii -> kpccm/h
          const rc = parseFloat(columns[43]) / 1000 * 4;
          const r200b = parseFloat(columns[4]) / 1000 * 4;
          // Get x/y/z positions, centering around (25,25,25)
          // -> provided in Mpccm/h
          const x = parseFloat(columns[8]) - 25;
          const y = parseFloat(columns[9]) - 25;
          const z = parseFloat(columns[10]) - 25;

          // Skip invalid data
          if (isNaN(id) || isNaN(mass) || isNaN(x) || isNaN(y) || isNaN(z) || isNaN(rc)) continue;

          haloData.push({ id, x, y, z, mass, r200b, rc });
        }

        setHalos(haloData);

        // Calculate statistics
        if (haloData.length > 0) {
          const masses = haloData.map(h => h.mass);
          const xs = haloData.map(h => h.x);
          const ys = haloData.map(h => h.y);
          const zs = haloData.map(h => h.z);

          setStats({
            total: haloData.length,
            filtered: haloData.filter(h => h.mass >= massThreshold).length,
            massRange: [Math.min(...masses), Math.max(...masses)],
            positionRange: {
              x: [Math.min(...xs), Math.max(...xs)],
              y: [Math.min(...ys), Math.max(...ys)],
              z: [Math.min(...zs), Math.max(...zs)],
            }
          });
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [catalogUrl, massThreshold]);

  // Filter halos by mass threshold and prepare data for PointCloud3D
  const { x, y, z, rvir, rc, ids } = useMemo(() => {
    const filteredHalos = halos.filter(halo => halo.mass >= massThreshold);

    return {
      x: filteredHalos.map(halo => halo.x),
      y: filteredHalos.map(halo => halo.y),
      z: filteredHalos.map(halo => halo.z),
      rvir: filteredHalos.map(halo => halo.r200b),
      rc: filteredHalos.map(halo => halo.rc),
      ids: filteredHalos.map(halo => halo.id),
    };
  }, [halos, massThreshold]);

  if (loading) {
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

  if (error) {
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
        <div style={{ fontSize: '14px' }}>{error}</div>
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

      {stats && (
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
          <InfoRow label="Halos" value={`${stats.filtered.toLocaleString()} / ${stats.total.toLocaleString()}`} />
          <InfoRow label="M_\mathrm{min}" value={stats.massRange[0]} unit="M_\odot" />
          <InfoRow label="M_\mathrm{max}" value={stats.massRange[1]} unit="M_\odot" />
          <InfoRow label="X" value={`[${stats.positionRange.x[0].toFixed(1)}, ${stats.positionRange.x[1].toFixed(1)}]`} unit="Mpc/h" />
          <InfoRow label="Y" value={`[${stats.positionRange.y[0].toFixed(1)}, ${stats.positionRange.y[1].toFixed(1)}]`} unit="Mpc/h" />
          <InfoRow label="Z" value={`[${stats.positionRange.z[0].toFixed(1)}, ${stats.positionRange.z[1].toFixed(1)}]`} unit="Mpc/h" />
        </div>
      )}
    </div>
  );
};

export default HaloCatalogPointCloud;
