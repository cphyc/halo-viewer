import { useEffect, useRef, useState } from 'react';

/**
 * SpectrumPyodide
 * 
 * Displays a matplotlib-rendered spectrum generated inside a Pyodide Web Worker.
 * The worker fetches the spectrum JSON, runs Python code to produce a PNG,
 * and returns the PNG as a data URL to display in React.
 */
export default function SpectrumPyodide({
  specUrl,
  width = 0,
  height = 260,
}: {
  specUrl: string;
  width?: number;
  height?: number;
}) {
  const workerRef = useRef<Worker | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Create the Pyodide worker once
  useEffect(() => {
    const w = new Worker(new URL('../pyodide/pyWorker.ts', import.meta.url), { type: 'classic' });
    workerRef.current = w;

    w.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'status') {
        setStatus(msg.status);
      } else if (msg.type === 'image') {
        setImg(msg.dataUrl);
        setStatus('ready');
      } else if (msg.type === 'error') {
        setStatus('error');
        setError(msg.error || 'Unknown error');
      }
    };

    return () => {
      w.terminate();
    };
  }, []);

  // Send plotting command when the spectrum URL changes
  useEffect(() => {
    if (!workerRef.current || !specUrl) return;
    setImg(null);
    setError(null);
    setStatus('loading');
    workerRef.current.postMessage({ cmd: 'plot', specUrl, width, height });
  }, [specUrl, width, height]);

  return (
    <div>
      {status !== 'ready' && (
        <div className="muted" style={{ marginBottom: 8 }}>
          {status === 'loading'
            ? 'Loading Pyodide & plotting…'
            : status === 'error'
            ? `Error: ${error}`
            : 'Idle'}
        </div>
      )}
      {img && (
        <img
          src={img}
          alt="spectrum"
          style={{ width: '100%', height, objectFit: 'contain', borderRadius: 8 }}
        />
      )}
    </div>
  );
}
