import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndownService.use(gfm);

/* ── Pass-through rules for blog-specific HTML blocks ──── */

// Chart containers (Chart.js canvases with data-* attributes)
turndownService.addRule('chartContainer', {
  filter: (node) =>
    node.nodeName === 'DIV' &&
    (node as HTMLElement).classList.contains('chart-container'),
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// Image carousels
turndownService.addRule('carousel', {
  filter: (node) =>
    node.nodeName === 'DIV' &&
    (node as HTMLElement).classList.contains('carousel'),
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// Figures with captions
turndownService.addRule('figure', {
  filter: 'figure',
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// Video embeds (iframes)
turndownService.addRule('iframe', {
  filter: 'iframe',
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// TOC and structural nav blocks
turndownService.addRule('nav', {
  filter: 'nav',
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// Headings with id attributes (used for TOC anchoring)
turndownService.addRule('headingWithId', {
  filter: (node) => {
    return (
      /^H[1-6]$/.test(node.nodeName) &&
      (node as HTMLElement).hasAttribute('id')
    );
  },
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// Superscript citations: <sup><a href="#source-...">[N]</a></sup>
turndownService.addRule('citation', {
  filter: (node) => {
    if (node.nodeName !== 'SUP') return false;
    const a = (node as HTMLElement).querySelector('a');
    return !!a && /^#source-/.test(a.getAttribute('href') || '');
  },
  replacement: (_content, node) => (node as HTMLElement).outerHTML,
});

// Ordered lists with id'd items (source lists)
turndownService.addRule('sourceList', {
  filter: (node) => {
    if (node.nodeName !== 'OL') return false;
    const items = (node as HTMLElement).querySelectorAll('li[id]');
    return items.length > 0;
  },
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

// Responsive HTML tables (div wrapper with overflow style + table with inline styles)
turndownService.addRule('htmlTable', {
  filter: (node) => {
    if (node.nodeName !== 'DIV') return false;
    const el = node as HTMLElement;
    const style = el.getAttribute('style') || '';
    return style.includes('overflow') && !!el.querySelector('table');
  },
  replacement: (_content, node) =>
    '\n\n' + (node as HTMLElement).outerHTML + '\n\n',
});

export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}
