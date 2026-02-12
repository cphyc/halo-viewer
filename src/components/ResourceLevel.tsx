import { useState } from 'react';
import { ResourceConfig, SelectionState } from '../types';
import DynamicResourceCard from './DynamicResourceCard';

interface ResourceLevelProps {
  level: number;
  resources: ResourceConfig[];
  selections: SelectionState;
  levelName?: string;
}

export default function ResourceLevel({
  level,
  resources,
  selections,
  levelName,
}: ResourceLevelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (resources.length === 0) {
    return null;
  }

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: 8,
          background: '#e8f4f8',
          borderRadius: 4,
          cursor: 'pointer',
        }}
        onClick={toggleCollapse}
      >
        <button
          style={{
            padding: '2px 6px',
            fontSize: '12px',
            cursor: 'pointer',
            background: 'transparent',
            border: '1px solid #4a90e2',
            borderRadius: 3,
          }}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
        <h3 style={{ margin: 0, fontSize: 16 }}>
          {levelName || `Level ${level} Resources`} ({resources.length})
        </h3>
      </div>

      {!isCollapsed && (
        <div className="grid2">
          {resources.map((resource) => (
            <DynamicResourceCard key={resource.id} resource={resource} selections={selections} />
          ))}
        </div>
      )}
    </div>
  );
}
