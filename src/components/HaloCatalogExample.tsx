import React, { useState, useEffect } from 'react';
import HaloCatalogPointCloud from './HaloCatalogPointCloud';

interface HaloCatalogExampleProps {
  selectedHaloId?: number;
}

const HaloCatalogExample: React.FC<HaloCatalogExampleProps> = ({
  selectedHaloId: externalSelectedHaloId,
}) => {
  const [massThreshold, setMassThreshold] = useState(1e6); // 1e6 solar masses
  const [pointColor, setPointColor] = useState('#4a90e2');
  const [selectedHaloId, setSelectedHaloId] = useState<number | undefined>(undefined);

  // Update local selectedHaloId when external prop changes
  useEffect(() => {
    if (externalSelectedHaloId !== undefined) {
      setSelectedHaloId(externalSelectedHaloId);
    }
  }, [externalSelectedHaloId]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: '12px',
        }}
      >
        <div>
          <label htmlFor="massThreshold" style={{ marginRight: '4px' }}>
            Mass:
          </label>
          <input
            id="massThreshold"
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={Math.log10(massThreshold)}
            onChange={(e) => setMassThreshold(Math.pow(10, parseFloat(e.target.value)))}
            style={{ marginRight: '4px', width: '60px' }}
          />
          <span style={{ fontSize: '10px', color: '#666' }}>{massThreshold.toExponential(1)}</span>
        </div>

        <div>
          <label htmlFor="pointColor" style={{ marginRight: '4px' }}>
            Color:
          </label>
          <input
            id="pointColor"
            type="color"
            value={pointColor}
            onChange={(e) => setPointColor(e.target.value)}
            style={{ width: '30px', height: '20px' }}
          />
        </div>

        <div>
          <label htmlFor="haloSelect" style={{ marginRight: '4px' }}>
            Go to:
          </label>
          <input
            id="haloSelect"
            type="number"
            placeholder="Halo ID"
            style={{ width: '60px', marginRight: '4px', fontSize: '11px' }}
            value={selectedHaloId || ''}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedHaloId(value ? parseInt(value) : undefined);
            }}
          />
          <button
            onClick={() => setSelectedHaloId(undefined)}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div
        style={{
          flexGrow: 1,
          minHeight: '400px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          position: 'relative',
        }}
      >
        <HaloCatalogPointCloud
          catalogUrl="demo-halos/halos_00100.ascii"
          massThreshold={massThreshold}
          pointColor={pointColor}
          selectedHaloId={selectedHaloId}
        />
      </div>
    </div>
  );
};

export default HaloCatalogExample;
