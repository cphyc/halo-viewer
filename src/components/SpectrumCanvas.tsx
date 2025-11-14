import { useEffect, useRef } from 'react';

export type SpecData = {
  lambda: Float64Array; // wavelengths (any unit)
  flux: Float64Array; // fluxes (arbitrary units)
};

function scale(arr: Float64Array) {
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  return { min, max, span };
}

export default function SpectrumCanvas({
  data,
  height = 220,
}: {
  data: SpecData;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = canvas.clientWidth * dpr;
    const H = canvas.clientHeight * dpr;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();

    const { lambda, flux } = data;
    const sx = scale(lambda);
    const sy = scale(flux);

    for (let i = 0; i < lambda.length; i++) {
      const x = (lambda[i] - sx.min) / sx.span;
      const y = (flux[i] - sy.min) / sy.span;
      const px = x * (W - 2 * dpr) + dpr;
      const py = (1 - y) * (H - 2 * dpr) + dpr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }, [data]);

  return (
    <div style={{ width: '100%', height }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
