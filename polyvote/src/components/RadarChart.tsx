import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import type { Metric } from '../types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

interface Props {
  metric: Metric;
}

export default function RadarChart({ metric }: Props) {
  if (!metric || metric.choices.length < 2) return null;

  const labels = metric.choices.map((c) => c.label);
  const data = metric.choices.map((c) => c.votes);
  const pointColors = metric.choices.map((c) => c.color);

  // Radar needs at least 3 axes to render properly
  if (labels.length === 2) {
    labels.push('');
    data.push(0);
    pointColors.push('transparent');
  }

  return (
    <div className="mx-auto max-w-[16rem] sm:max-w-xs">
      <Radar
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.3)',
              borderWidth: 2,
              pointRadius: 5,
              pointBackgroundColor: pointColors,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: false } },
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
