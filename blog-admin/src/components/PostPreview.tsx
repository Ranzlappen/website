import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { FrontMatter } from '../types';

interface Props {
  frontMatter: FrontMatter;
  body: string;
}

export default function PostPreview({ frontMatter, body }: Props) {
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  return (
    <div className="h-full overflow-auto bg-[var(--bg)] p-6">
      <article className="max-w-[48rem] mx-auto">
        {/* Post header */}
        <header className="text-center mb-8">
          {frontMatter.category && (
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-[var(--accent)]/10 text-[var(--accent)] rounded mb-3">
              {frontMatter.category}
            </span>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight mb-3">
            {frontMatter.title || 'Untitled Post'}
          </h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
            <time>{frontMatter.date}</time>
            <span>&middot;</span>
            <span>{readTime} min read</span>
            {frontMatter.author && (
              <>
                <span>&middot;</span>
                <span>{frontMatter.author}</span>
              </>
            )}
          </div>
        </header>

        {/* Post body */}
        <div className="preview-body prose prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {body || '*Start writing to see a preview...*'}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {frontMatter.tags.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[var(--border)] flex flex-wrap gap-2">
            {frontMatter.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--text-muted)] text-center italic">
          Preview approximates the final post. Series navigation, related posts, and comments will appear on the live site.
        </p>
      </article>
    </div>
  );
}
