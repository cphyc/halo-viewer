// src/components/CutoutRunner.tsx
import { useEffect, useRef, useState } from 'react';
import QuadtreeViewer from './QuadtreeViewer';
import { QuadData } from '../types';
import { resolve } from '../api';

export const BASE = import.meta.env.VITE_DATA_BASE_URL as string | undefined;

export default function CutoutRunner({
  cutoutUrl,
  wheelUrls = [
    'https://files.pythonhosted.org/packages/e0/1f/f370c32eab50b45271c4929665caeb49e55ed6ae14706595f2b192825148/pyneb-1.1.28-py3-none-any.whl',
    `${BASE}/wheels/yt_experiments-0.3.0-cp312-cp312-pyodide_2024_0_wasm32.whl`,
    `${BASE}/wheels/yt_derived_fields-0.1.0-py3-none-any.whl`,
    'scipy',
  ],
  pyCode = '',
}: {
  cutoutUrl: string;
  wheelUrls?: string[]; // relative or absolute URLs to your .whl files
  pyCode?: string; // your Python code (blank by default)
}) {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [loaded, setLoaded] = useState<boolean>(false);
  const [img, setImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field_list, setFields] = useState<string[] | null>(null);
  const [field, setField] = useState<string>('');
  const [axis, setAxis] = useState<string>('x');
  const [width, setWidth] = useState<number>(20);

  const [quadData, setQuadData] = useState<QuadData | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('../pyodide/pyWorker.ts', import.meta.url), { type: 'classic' });
    workerRef.current = w;
    w.onmessage = async (e: MessageEvent) => {
      const { type, ...rest } = e.data || {};
      if (type === 'status') setStatus(rest.status);
      if (type === 'error') {
        setStatus('error');
        setError(rest.error);
      }
      if (type === 'loaded') setLoaded(true);
      if (type === 'plotting-done') setStatus('plotting-done');
      if (type === 'image') setImg(rest.dataUrl);
      if (type === 'set-fields') {
        setFields(rest.fields);
        setField('gas__density');
      }
      if (type === 'quadtree-data') {
        console.log('Got quadtree data', Math.min(...rest.value), Math.max(...rest.value));

        setQuadData({
          px: rest.px,
          py: rest.py,
          pdx: rest.pdx,
          pdy: rest.pdy,
          value: rest.value.map((v: number) => Math.log10(v + 1e-6)),
        });
      }
    };
    return () => {
      w.terminate();
    };
  }, []);

  async function loadCutout() {
    setStatus('starting');
    setError(null);
    workerRef.current?.postMessage({ cmd: 'runCutout', cutoutUrl, wheelUrls, pyCode });
  }

  async function loadNow() {
    const rep = await fetch(resolve('data.json'));
    if (!rep.ok) throw new Error(`Fetch failed ${rep.status}: data.json`);

    const tmp = (await rep.json()) as QuadData;
    setQuadData(tmp);
  }

  loadNow();
  function plotCutout() {
    setStatus('starting');
    setError(null);
    workerRef.current?.postMessage({
      cmd: 'plotCutout',
      field: field,
      axis: axis,
      width: width,
    });
  }

  function plotQuadtree() {
    setStatus('starting quadtree plot');
    setError(null);
    workerRef.current?.postMessage({
      cmd: 'plotQuadMesh',
      field: field,
      axis: axis,
      width: width,
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
      <button onClick={loadCutout}>Load cutout</button>
      {loaded && (
        <div>
          <button onClick={plotQuadtree}>Plot cutout</button>
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
      {quadData && (
        <QuadtreeViewer
          px={quadData.px}
          py={quadData.py}
          pdx={quadData.pdx}
          pdy={quadData.pdy}
          value={quadData.value}
          colormap="viridis"
        />
      )}
    </div>
  );

  // return (
  //   <div className="card">
  //     <div className="card-title">Cutout</div>
  //     <div className="muted" style={{ marginBottom: 8 }}>
  //       Status: {status}
  //     </div>
  //     {error && (
  //       <div className="error">
  //         Error:{' '}
  //         {error.split('\n').map((line, i) => (
  //           <span key={i}>
  //             {line}
  //             <br />
  //           </span>
  //         ))}
  //       </div>
  //     )}
  //     <button onClick={loadCutout}>Load cutout</button>
  //     {loaded && (
  //       <div>
  //         <button onClick={plotCutout}>Plot cutout</button>
  //         <div style={{ marginBottom: 8 }}>
  //           <select value={field} onChange={(e) => setField(e.target.value)}>
  //             <option value="" disabled>
  //               Select field...
  //             </option>
  //             {field_list?.map((field: string) => (
  //               <option key={field} value={field}>
  //                 {field.replace('__', ', ')}
  //               </option>
  //             ))}
  //           </select>
  //         </div>
  //         <div style={{ marginBottom: 8 }}>
  //           <select value={axis} onChange={(e) => setAxis(e.target.value)}>
  //             <option value="">Select axis...</option>
  //             <option value="x">x</option>
  //             <option value="y">y</option>
  //             <option value="z">z</option>
  //           </select>
  //         </div>
  //         <div style={{ marginBottom: 8 }}>
  //           <label htmlFor="width-input">Width (kpc): </label>
  //           <input
  //             id="width-input"
  //             type="number"
  //             min="0"
  //             step="0.1"
  //             placeholder="Enter width in kpc"
  //             style={{ marginLeft: 4 }}
  //             value={width}
  //             onChange={(e) => setWidth(Number(e.target.value))}
  //           />
  //         </div>
  //       </div>
  //     )}
  //     {img && (
  //       <img
  //         src={img}
  //         alt="spectrum"
  //         style={{ width: '100%', height: '400px', objectFit: 'contain', borderRadius: 8 }}
  //       />
  //     )}
  //   </div>
  // );
}
