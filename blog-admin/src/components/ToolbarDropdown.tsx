import { useState, useRef, useEffect } from 'react';

interface DropdownItem {
  label: string;
  title: string;
  onClick: () => void;
}

interface Props {
  label: string;
  items: DropdownItem[];
  disabled: boolean;
  btnClass: string;
}

export default function ToolbarDropdown({ label, items, disabled, btnClass }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={btnClass}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        title={label}
      >
        {label} <span className="text-[10px] ml-0.5">&#9662;</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.label}
              className="block w-full text-left px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
              title={item.title}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
