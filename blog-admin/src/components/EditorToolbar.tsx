import type { EditorView } from '@codemirror/view';

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

export default function EditorToolbar({ editorView, onImageUpload }: Props) {
  const btn =
    'px-2 py-1 rounded text-sm border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-30';

  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertAround(editorView, '**', '**')}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertAround(editorView, '*', '*')}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertAround(editorView, '`', '`')}
        title="Inline code"
      >
        {'</>'}
      </button>
      <div className="w-px bg-[var(--border)] mx-1" />
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertLine(editorView, '## ')}
        title="Heading 2"
      >
        H2
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertLine(editorView, '### ')}
        title="Heading 3"
      >
        H3
      </button>
      <div className="w-px bg-[var(--border)] mx-1" />
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertAround(editorView, '[', '](url)')}
        title="Link"
      >
        Link
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={onImageUpload}
        title="Upload image"
      >
        Image
      </button>
      <div className="w-px bg-[var(--border)] mx-1" />
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertLine(editorView, '> ')}
        title="Blockquote"
      >
        Quote
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertLine(editorView, '- ')}
        title="List item"
      >
        List
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertBlock(editorView, '\n```\ncode\n```\n')}
        title="Code block"
      >
        Code
      </button>
      <button
        className={btn}
        disabled={!editorView}
        onClick={() => editorView && insertBlock(editorView, '\n---\n')}
        title="Horizontal rule"
      >
        HR
      </button>
    </div>
  );
}
