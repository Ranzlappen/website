/**
 * Minimal inline markup for translated prose (no dangerouslySetInnerHTML):
 *   **bold**   `code`   [label](/internal/route)   [label](https://external)
 * Used by the content pages so whole paragraphs live in the i18n dictionaries.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function rich(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return href.startsWith('/') ? (
        <Link key={i} to={href}>
          {label}
        </Link>
      ) : (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
