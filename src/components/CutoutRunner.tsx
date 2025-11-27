// src/components/CutoutRunner.tsx
import { useEffect, useRef, useState } from 'react';
import QuadtreeViewer from './QuadtreeViewer';
import { QuadData } from '../types';

export const BASE = import.meta.env.VITE_DATA_BASE_URL as string | undefined;

// Shared worker singleton
let sharedWorker: Worker | null = null;

const defaultWheelUrls = [
  'https://files.pythonhosted.org/packages/e0/1f/f370c32eab50b45271c4929665caeb49e55ed6ae14706595f2b192825148/pyneb-1.1.28-py3-none-any.whl',
  `${BASE}/wheels/yt_experiments-0.3.0-cp312-cp312-pyodide_2024_0_wasm32.whl`,
  `${BASE}/wheels/yt_derived_fields-0.1.0-py3-none-any.whl`,
  'scipy',
];

function getSharedWorker(): Worker {
  if (!sharedWorker) {
    console.log('CutoutRunner: creating shared pyodide worker');
    sharedWorker = new Worker(new URL('../pyodide/pyWorker.ts', import.meta.url), {
      type: 'classic',
    });
  }
  sharedWorker.postMessage({ cmd: 'initialize', wheelUrls: defaultWheelUrls });
  return sharedWorker;
}

enum ProjectionOperation {
  ProjectionWeighted = 'projection-weighted',
  Projection = 'projection',
  Slice = 'slice',
}

export default function CutoutRunner({
  cutoutUrl,
  pyCode = '',
}: {
  cutoutUrl: string;
  pyCode?: string; // your Python code (blank by default)
}) {
  const [status, setStatus] = useState<string>('idle');
  const [loaded, setLoaded] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [img, setImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field_list, setFields] = useState<string[] | null>(null);
  const [field, setField] = useState<string>('');
  const [axis, setAxis] = useState<string>('x');
  const [operation, setOperation] = useState<ProjectionOperation>(
    ProjectionOperation.ProjectionWeighted
  );
  const [weightField, setWeightField] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(1);
  const [center, setCenter] = useState<[number, number]>([0.5, 0.5]);

  const [quadData, setQuadData] = useState<QuadData | null>(null);

  useEffect(() => {
    const w = getSharedWorker();

    const handleMessage = async (e: MessageEvent) => {
      const { type, ...rest } = e.data || {};
      if (type === 'status') setStatus(rest.status);
      if (type === 'error') {
        setStatus('error');
        setError(rest.error);
      }
      if (type === 'loaded') {
        setLoaded(true);
        setStatus('loaded');
      }
      if (type === 'initialized') {
        setInitialized(rest.value);
        setStatus('initialized');
      }
      if (type === 'plotting-done') setStatus('plotting-done');
      if (type === 'set-fields') {
        setFields(rest.fields);
        setField('gas__density');
      }
      if (type === 'quadtree-data') {
        console.log(
          'Got quadtree data',
          Math.min(...rest.value),
          Math.max(...rest.value),
          rest.center,
          rest.width
        );

        setQuadData({
          px: rest.px,
          py: rest.py,
          pdx: rest.pdx,
          pdy: rest.pdy,
          value: rest.value,
        });
        setCenter(rest.center);
        setWidth(rest.width);
      }
    };

    w.postMessage({ cmd: 'isInitialized' });

    w.addEventListener('message', handleMessage);

    return () => {
      w.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(getQuadTree, [field, axis, field, operation]);

  async function loadCutout() {
    setStatus('starting');
    setError(null);
    getSharedWorker().postMessage({ cmd: 'runCutout', cutoutUrl, pyCode });
    getQuadTree();
  }

  function getQuadTree() {
    if (!field || !axis) return;
    setStatus('plotting');
    setError(null);
    getSharedWorker().postMessage({
      cmd: 'getQuadTree',
      field: field,
      axis: axis,
      operation: operation as string,
    });
  }

  return (
    <div className="card">
      <div className="card-title">Cutout</div>
      <div className="muted" style={{ marginBottom: 8 }}>
        Status: {status}
      </div>
      {error && (
        <div className="error">
          Error:{' '}
          {error.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
        </div>
      )}
      {initialized && !loaded && <button onClick={loadCutout}>Load cutout</button>}
      {loaded && (
        <div>
          {!quadData && <button onClick={getQuadTree}>Plot cutout</button>}
          <div style={{ marginBottom: 8 }}>
            <select value={field} onChange={(e) => setField(e.target.value)}>
              <option value="" disabled>
                Select field...
              </option>
              {field_list?.map((field: string) => (
                <option key={field} value={field}>
                  {field.replace('__', ', ')}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <select value={axis} onChange={(e) => setAxis(e.target.value)}>
              <option value="">Select axis...</option>
              <option value="x">x</option>
              <option value="y">y</option>
              <option value="z">z</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value as ProjectionOperation)}
            >
              {Object.values(ProjectionOperation).map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="width-input">Width (kpc): </label>
            <input
              id="width-input"
              type="number"
              min="0"
              step="0.1"
              placeholder="Enter width in kpc"
              style={{ marginLeft: 4 }}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </div>
        </div>
      )}
      {quadData && <QuadtreeViewer quadData={quadData} center={center} width={width} />}
    </div>
  );
}
