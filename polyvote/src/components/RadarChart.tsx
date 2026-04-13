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

  // Build accessible summary of vote distribution
  const totalVotes = metric.choices.reduce((s, c) => s + c.votes, 0);
  const summary = metric.choices
    .map((c) => `${c.label}: ${c.votes} vote${c.votes !== 1 ? 's' : ''} (${totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0}%)`)
    .join(', ');

  // Truncate long labels for mobile readability
  const truncatedLabels = labels.map((l) => (l.length > 18 ? l.slice(0, 16) + '…' : l));

  return (
    <div className="mx-auto max-w-[14rem] sm:max-w-xs" role="img" aria-label={`Radar chart for ${metric.label}: ${summary}`}>
      <Radar
        data={{
          labels: truncatedLabels,
          datasets: [
            {
              data,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.3)',
              borderWidth: 2,
              pointRadius: typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 5,
              pointBackgroundColor: pointColors,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                // Show full label in tooltip
                title: (items) => labels[items[0]?.dataIndex ?? 0] || '',
              },
            },
          },
          scales: {
            r: {
              angleLines: { color: 'rgba(255,255,255,0.06)' },
              grid: { color: 'rgba(255,255,255,0.06)' },
              pointLabels: {
                color: '#d1d5db',
                font: { size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 12 },
              },
              ticks: { display: false },
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
}
