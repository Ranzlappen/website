import { PLATFORMS } from '../platforms';

/** Toggle chips for the folder's platform tags. */
export default function PlatformTagSelector({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {PLATFORMS.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(p.id)}
            className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
              on
                ? p.badge
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'
            }`}
            aria-pressed={on}
          >
            {on ? '✓ ' : ''}
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
