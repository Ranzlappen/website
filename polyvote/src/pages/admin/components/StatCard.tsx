interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}

export default function StatCard({ label, value, icon, color = 'text-brand-400' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
