/*
 * CHANGE: New file – Tiny radar chart preview for topic cards
 * REASON: Shows a compact visual summary of votes on each topic card
 * DATE: 2026-04-02
 */
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import type { Metric } from '../types';

// Register Chart.js components once
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler);

interface Props {
  metrics: Metric[];
}

export default function MiniRadar({ metrics }: Props) {
  if (!metrics || metrics.length === 0) return null;

  // For each metric, pick the choice with the most votes as the "winning" value
  const labels = metrics.map((m) => m.label);
  const maxVotes = Math.max(
    ...metrics.flatMap((m) => m.choices.map((c) => c.votes)),
    1,
  );
  const data = metrics.map((m) => {
    const top = m.choices.reduce((a, b) => (a.votes >= b.votes ? a : b));
    return top.votes / maxVotes;
  });

  return (
    <div className="h-16 w-16 sm:h-20 sm:w-20">
      <Radar
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: 'rgba(74, 222, 128, 0.15)',
              borderColor: 'rgba(74, 222, 128, 0.6)',
              borderWidth: 1.5,
              pointRadius: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              display: false,
              min: 0,
              max: 1,
            },
          },
        }}
      />
    </div>
  );
}
