/*
 * CHANGE: New file – Full-size radar chart for topic detail page
 * REASON: Visualises vote distribution across all metrics in a radar/spider chart
 * DATE: 2026-04-02
 */
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { Metric } from '../types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface Props {
  metrics: Metric[];
}

/** Pre-defined palette for datasets (one per unique choice label across metrics) */
const COLORS = [
  { bg: 'rgba(74, 222, 128, 0.15)', border: '#4ade80' },
  { bg: 'rgba(96, 165, 250, 0.15)', border: '#60a5fa' },
  { bg: 'rgba(251, 146, 60, 0.15)', border: '#fb923c' },
  { bg: 'rgba(248, 113, 113, 0.15)', border: '#f87171' },
  { bg: 'rgba(192, 132, 252, 0.15)', border: '#c084fc' },
  { bg: 'rgba(250, 204, 21, 0.15)', border: '#facc15' },
];

export default function RadarChart({ metrics }: Props) {
  if (!metrics || metrics.length === 0) return null;

  const labels = metrics.map((m) => m.label);

  // Collect unique choice labels across all metrics for dataset grouping
  const choiceLabels = Array.from(
    new Set(metrics.flatMap((m) => m.choices.map((c) => c.label))),
  );

  const datasets = choiceLabels.map((cl, i) => {
    const c = COLORS[i % COLORS.length];
    return {
      label: cl,
      data: metrics.map((m) => {
        const choice = m.choices.find((ch) => ch.label === cl);
        return choice ? choice.votes : 0;
      }),
      backgroundColor: c.bg,
      borderColor: c.border,
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: c.border,
    };
  });

  return (
    <div className="mx-auto max-w-md">
      <Radar
        data={{ labels, datasets }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#9ca3af', font: { size: 12 } },
            },
          },
          scales: {
            r: {
              angleLines: { color: 'rgba(255,255,255,0.06)' },
              grid: { color: 'rgba(255,255,255,0.06)' },
              pointLabels: { color: '#d1d5db', font: { size: 12 } },
              ticks: { display: false },
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
}
