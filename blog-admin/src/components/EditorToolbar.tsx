import type { EditorView } from '@codemirror/view';
import ToolbarDropdown from './ToolbarDropdown';

interface Props {
  editorView: EditorView | null;
  onImageUpload: () => void;
}

function insertAround(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected || 'text'}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + (selected.length || 4) },
  });
  view.focus();
}

function insertLine(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  view.focus();
}

function insertBlock(view: EditorView, block: string) {
  const { from } = view.state.selection.main;
  view.dispatch({
    changes: { from, insert: block },
    selection: { anchor: from + block.length },
  });
  view.focus();
}

function insertBlockWithSelection(view: EditorView, block: string, selectText: string) {
  const { from } = view.state.selection.main;
  const selectStart = from + block.indexOf(selectText);
  const selectEnd = selectStart + selectText.length;
  view.dispatch({
    changes: { from, insert: block },
    selection: { anchor: selectStart, head: selectEnd },
  });
  view.focus();
}

/* ── Snippet templates ─────────────────────────────────── */

const SNIPPET_CAROUSEL = `
<div class="carousel">
  <img src="/assets/images/image-1.webp" alt="Description of first image">
  <img src="/assets/images/image-2.webp" alt="Description of second image">
  <img src="/assets/images/image-3.webp" alt="Description of third image">
</div>
`;

const SNIPPET_FIGURE = `
<figure>
  <img src="/assets/images/image.webp" alt="Description">
  <figcaption>Caption text here</figcaption>
</figure>
`;

const SNIPPET_VIDEO = `
<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" title="Video title" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
`;

const SNIPPET_TOC = `
<nav>
  <strong>Table of Contents</strong>
  <ol>
    <li><a href="#section-1">Section 1</a></li>
    <li><a href="#section-2">Section 2</a></li>
    <li><a href="#section-3">Section 3</a></li>
  </ol>
</nav>
`;

const SNIPPET_TABLE = `
<div style="overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%;">
  <table style="width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.4; min-width: 640px; table-layout: auto;">
    <thead>
      <tr>
        <th style="text-align: left; padding: 11px 10px; width: 50%;">Column A</th>
        <th style="text-align: center; padding: 11px 8px; width: 50%;">Column B</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 11px 10px; font-weight: 500;">Row 1</td>
        <td style="text-align: center; padding: 11px 8px; font-weight: 500;">Value</td>
      </tr>
    </tbody>
  </table>
</div>
`;

const SNIPPET_BAR_CHART = `
<div class="chart-container" role="figure" aria-label="Chart title">
  <canvas data-chart="bar"
    data-title="Chart Title"
    data-labels='["Label 1","Label 2","Label 3"]'
    data-datasets='[{"label":"Series","data":[10,20,30]}]'>
  </canvas>
</div>
`;

const SNIPPET_LINE_CHART = `
<div class="chart-container" role="figure" aria-label="Chart title">
  <canvas data-chart="line"
    data-title="Chart Title"
    data-labels='["Jan","Feb","Mar","Apr"]'
    data-datasets='[{"label":"Series","data":[10,25,18,40]}]'>
  </canvas>
</div>
`;

const SNIPPET_PIE_CHART = `
<div class="chart-container" role="figure" aria-label="Chart title">
  <canvas data-chart="pie"
    data-title="Chart Title"
    data-labels='["Slice 1","Slice 2","Slice 3"]'
    data-values='[40,35,25]'
    data-colors='["#4ade80","#3b82f6","#f59e0b"]'>
  </canvas>
</div>
`;

const SNIPPET_DOUGHNUT_CHART = `
<div class="chart-container" role="figure" aria-label="Chart title">
  <canvas data-chart="doughnut"
    data-title="Chart Title"
    data-labels='["Slice 1","Slice 2","Slice 3"]'
    data-values='[40,35,25]'
    data-colors='["#4ade80","#3b82f6","#f59e0b"]'>
  </canvas>
</div>
`;

const SNIPPET_CITATION = '<sup><a href="#source-1">[1]</a></sup>';

const SNIPPET_SOURCES = `
<h2 id="sources">Sources</h2>

<ol>
  <li id="source-1"><a href="https://example.com" target="_blank" rel="noopener">Author (Year). Title.</a></li>
  <li id="source-2"><a href="https://example.com" target="_blank" rel="noopener">Author (Year). Title.</a></li>
</ol>
`;

const SNIPPET_H2_ID = '\n<h2 id="section-name">Section Title</h2>\n';

/* ── Component ─────────────────────────────────────────── */

export default function EditorToolbar({ editorView, onImageUpload }: Props) {
  const btn =
    'px-2 py-1 rounded text-sm border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-30';

  const disabled = !editorView;

  const insertItems = [
    {
      label: 'Image Carousel',
      title: 'Swipeable image gallery',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_CAROUSEL),
    },
    {
      label: 'Figure + Caption',
      title: 'Image with caption',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_FIGURE),
    },
    {
      label: 'Video Embed',
      title: 'YouTube iframe embed',
      onClick: () => editorView && insertBlockWithSelection(editorView, SNIPPET_VIDEO, 'VIDEO_ID'),
    },
    {
      label: 'Table of Contents',
      title: 'Navigation list linking to sections',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_TOC),
    },
    {
      label: 'Data Table',
      title: 'Responsive HTML table',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_TABLE),
    },
  ];

  const chartItems = [
    {
      label: 'Bar Chart',
      title: 'Chart.js bar chart',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_BAR_CHART),
    },
    {
      label: 'Line Chart',
      title: 'Chart.js line chart',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_LINE_CHART),
    },
    {
      label: 'Pie Chart',
      title: 'Chart.js pie chart',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_PIE_CHART),
    },
    {
      label: 'Doughnut Chart',
      title: 'Chart.js doughnut chart',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_DOUGHNUT_CHART),
    },
  ];

  const refItems = [
    {
      label: 'Inline Citation',
      title: 'Superscript source reference',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_CITATION),
    },
    {
      label: 'Sources Section',
      title: 'Numbered sources list at end of article',
      onClick: () => editorView && insertBlock(editorView, SNIPPET_SOURCES),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
      {/* Text formatting */}
      <button className={btn} disabled={disabled} onClick={() => editorView && insertAround(editorView, '**', '**')} title="Bold">
        <strong>B</strong>
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertAround(editorView, '*', '*')} title="Italic">
        <em>I</em>
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertAround(editorView, '`', '`')} title="Inline code">
        {'</>'}
      </button>

      <div className="w-px h-6 bg-[var(--border)] mx-1" />

      {/* Headings */}
      <button className={btn} disabled={disabled} onClick={() => editorView && insertLine(editorView, '## ')} title="Heading 2">
        H2
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertLine(editorView, '### ')} title="Heading 3">
        H3
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertBlockWithSelection(editorView, SNIPPET_H2_ID, 'section-name')} title="H2 with ID (for TOC linking)">
        H2#
      </button>

      <div className="w-px h-6 bg-[var(--border)] mx-1" />

      {/* Links & media */}
      <button className={btn} disabled={disabled} onClick={() => editorView && insertAround(editorView, '[', '](url)')} title="Link">
        Link
      </button>
      <button className={btn} disabled={disabled} onClick={onImageUpload} title="Upload image">
        Image
      </button>

      <div className="w-px h-6 bg-[var(--border)] mx-1" />

      {/* Block elements */}
      <button className={btn} disabled={disabled} onClick={() => editorView && insertLine(editorView, '> ')} title="Blockquote">
        Quote
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertLine(editorView, '- ')} title="Bullet list">
        UL
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertLine(editorView, '1. ')} title="Numbered list">
        OL
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertBlock(editorView, '\n```\ncode\n```\n')} title="Code block">
        Code
      </button>
      <button className={btn} disabled={disabled} onClick={() => editorView && insertBlock(editorView, '\n---\n')} title="Horizontal rule">
        HR
      </button>

      <div className="w-px h-6 bg-[var(--border)] mx-1" />

      {/* Dropdown menus for complex snippets */}
      <ToolbarDropdown label="Insert" items={insertItems} disabled={disabled} btnClass={btn} />
      <ToolbarDropdown label="Chart" items={chartItems} disabled={disabled} btnClass={btn} />
      <ToolbarDropdown label="Ref" items={refItems} disabled={disabled} btnClass={btn} />
    </div>
  );
}
