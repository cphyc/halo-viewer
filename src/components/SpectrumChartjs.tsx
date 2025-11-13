// src/components/SpectrumChartjs.tsx
import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  Decimation,
  Title,
} from 'chart.js';

import { SpecData } from '../types';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  Decimation,
  Title
);

type Props = {
  data: SpecData;
  height?: number;      // CSS height of the container
  xLabel?: string;      // default: 'λ'
  xUnit?: string;       // default: 'Å'
  yLabel?: string;      // default: 'fλ'
  yUnit?: string;       // default: 'arbitrary units'
  color?: string;       // CSS color for the line
  maxPoints?: number;   // decimation target
};

export default function SpectrumChartjs({
  data,
  height = 260,
  xLabel = 'λ',
  xUnit = 'Å',
  yLabel = 'fλ',
  yUnit = 'arbitrary units',
  color,
  maxPoints = 1500,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const { lambda, flux } = data;
    const n = Math.min(lambda.length, flux.length);

    // Chart.js accepts array of {x, y} when parsing=false
    const points: { x: number; y: number }[] = new Array(n);
    for (let i = 0; i < n; i++) {
      // Number() ensures typed arrays or numbers both work
      points[i] = { x: Number((lambda as any)[i]), y: Number((flux as any)[i]) };
    }

    // Clean any previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: `${yLabel} [${yUnit}]`,
            data: points,
            parsing: false,
            borderWidth: 1.5,
            pointRadius: 0,
            borderColor: color || 'rgba(33,150,243,1)',
            backgroundColor: color || 'rgba(33,150,243,0.15)',
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        spanGaps: true,
        plugins: {
          legend: { display: false },
          decimation: {
            enabled: true,
            algorithm: 'lttb',
            samples: maxPoints,
          },
          tooltip: {
            intersect: false,
            mode: 'index',
            callbacks: {
              title: (items) => `${xLabel} = ${items[0].parsed.x}`,
              label: (item) => `${yLabel}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: `${xLabel} [${xUnit}]` },
            ticks: { maxTicksLimit: 8 },
            grid: { color: 'rgba(0,0,0,0.08)' },
          },
          y: {
            type: 'linear',
            title: { display: true, text: `${yLabel} [${yUnit}]` },
            ticks: { maxTicksLimit: 6 },
            grid: { color: 'rgba(0,0,0,0.08)' },
          },
        },
        elements: { line: { tension: 0 } },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, xLabel, xUnit, yLabel, yUnit, color, maxPoints]);

  return (
    <div style={{ width: '100%', height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
