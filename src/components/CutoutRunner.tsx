// src/components/CutoutRunner.tsx
import { useEffect, useRef, useState } from 'react';

export default function CutoutRunner({
  cutoutUrl,
  wheelUrls = [
    '/wheels/yt_experiments-0.3.0-cp312-cp312-pyodide_2024_0_wasm32.whl',
    'lzma', // Required for pooch
    'pooch',
    'scipy',
  ],
  pyCode = '',
}: {
  cutoutUrl: string;
  wheelUrls?: string[];  // relative or absolute URLs to your .whl files
  pyCode?: string;    // your Python code (blank by default)
}) {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [img, setImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('../pyodide/pyWorker.ts', import.meta.url), { type: 'classic' });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      const { type, ...rest } = e.data || {};
      if (type === 'status') setStatus(rest.status);
      if (type === 'error') { setStatus('error'); setError(rest.error); }
      if (type === 'done')   setStatus('done');
      if (type === 'image')  setImg(rest.dataUrl);
    };
    return () => { w.terminate(); };
  }, []);

  function run() {
    setStatus('starting');
    setError(null);
    workerRef.current?.postMessage({ cmd: 'runCutout', cutoutUrl, wheelUrls, pyCode });
  }

  return (
    <div className="card">
      <div className="card-title">Cutout (Pyodide)</div>
      <div className="muted" style={{ marginBottom: 8 }}>Status: {status}</div>
      {error && <div className="error">Error: {error}</div>}
      <button onClick={run} >
        Run Python on Cutout
      </button>
      {img && (
          <img
            src={img}
            alt="spectrum"
            style={{ width: '100%', height: '400px', objectFit: 'contain', borderRadius: 8 }}
          />
        )}
    </div>
  );
}
