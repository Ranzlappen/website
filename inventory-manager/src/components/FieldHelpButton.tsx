import { useEffect, useState } from 'react';
import { fieldHelpSections } from '../platformHelp';

/**
 * The "(e)" explain button — sits next to the "(i)" column-name popover. Opens a
 * modal documenting the required syntax/format/args for the given field on every
 * platform that uses it. `fieldKey` is a canonical field key (title, category, …)
 * or a synthetic 'ebay-*' key for the eBay listing-setting inputs.
 */
export default function FieldHelpButton({ fieldKey }: { fieldKey: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const doc = open ? fieldHelpSections(fieldKey) : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-[var(--border)] text-[9px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        title="Explain syntax / format per platform"
        aria-label="Explain syntax and format per platform"
      >
        e
      </button>

      {open && doc && (
        <div
          className="fixed inset-0 z-40 bg-black/70 flex items-start justify-center px-4 py-8 overflow-auto normal-case"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 max-w-lg w-full max-h-[85vh] overflow-auto text-[var(--text)] text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold">
                <span className="text-[var(--text-muted)] font-normal text-sm">Field · </span>
                {doc.title}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none shrink-0"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {doc.intro && <p className="text-sm text-[var(--text-muted)] mb-4">{doc.intro}</p>}

            {doc.sections.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No platform uses this field, so there is nothing to format.
              </p>
            ) : (
              <ul className="space-y-3">
                {doc.sections.map((s, i) => (
                  <li
                    key={`${s.platformName}-${i}`}
                    className="border border-[var(--border)] rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className={`inline-block text-[10px] leading-none px-1.5 py-0.5 rounded border ${
                          s.badge ?? 'border-[var(--border)] text-[var(--text-muted)]'
                        }`}
                      >
                        {s.platformName}
                      </span>
                      {s.column && (
                        <code className="font-mono text-[11px] text-[var(--text-muted)]">
                          {s.column}
                          {s.required && <span className="text-[var(--accent)]"> *</span>}
                        </code>
                      )}
                    </div>

                    <p className="text-sm">{s.help.format}</p>

                    {s.help.args && s.help.args.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.help.args.map((a) => (
                          <code
                            key={a}
                            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]"
                          >
                            {a}
                          </code>
                        ))}
                      </div>
                    )}

                    {s.help.example && (
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        Example:{' '}
                        <code className="font-mono text-[var(--text)]">{s.help.example}</code>
                      </p>
                    )}

                    {s.help.notes && (
                      <p className="text-xs text-[var(--text-muted)] mt-2">{s.help.notes}</p>
                    )}

                    {s.help.link && (
                      <a
                        href={s.help.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent)] hover:underline mt-2 inline-block"
                      >
                        {s.help.link.label} ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
