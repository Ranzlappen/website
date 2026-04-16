import { useMemo, useState, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { FrontMatter } from '../types';

interface Props {
  frontMatter: FrontMatter;
  body: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function PostPreview({ frontMatter, body }: Props) {
  const [debouncedBody, setDebouncedBody] = useState(body);
  const [debouncedFm, setDebouncedFm] = useState(frontMatter);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedBody(body);
      setDebouncedFm(frontMatter);
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [body, frontMatter]);

  const wordCount = debouncedBody.split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  const bodyHtml = useMemo(
    () =>
      renderToStaticMarkup(
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {debouncedBody || '*Start writing to see a preview...*'}
        </ReactMarkdown>,
      ),
    [debouncedBody],
  );

  const srcdoc = useMemo(() => {
    const title = escapeHtml(debouncedFm.title || 'Untitled Post');
    const category = debouncedFm.category ? escapeHtml(debouncedFm.category) : '';
    const author = debouncedFm.author ? escapeHtml(debouncedFm.author) : '';
    const dateStr = escapeHtml(debouncedFm.date);
    const tags = debouncedFm.tags.map((t) => escapeHtml(t));

    const statusBanner =
      debouncedFm.status === 'draft' || debouncedFm.status === 'placeholder'
        ? `<div class="status-banner" role="status"><span class="status-banner__text">This article is a draft and may be incomplete or subject to change.</span></div>`
        : debouncedFm.status === 'unpublished'
          ? `<div class="status-banner" role="status"><span class="status-banner__text">This article is unpublished.</span></div>`
          : '';

    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></` + `script>
  <style>
    :root { --header-height: 0px; }
    body { margin: 0; padding: 0; background: var(--c-bg); color: var(--c-text); }
    .preview-wrapper { padding: 1.5rem 1rem; }
    /* Hide elements that need Firebase / full site context */
    .voting-sidebar, .voting-mobile-bar, .read-aloud, .tts-sticky-bar,
    .post-nav, .related-posts, .comments-section, .breadcrumb { display: none !important; }
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <article class="post">
      ${statusBanner}
      <header class="post-header">
        ${category ? `<span class="post-header__category">${category}</span>` : ''}
        <h1>${title}</h1>
        <div class="post-meta">
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <time>${dateStr}</time>
          </span>
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            ${readTime} min read
          </span>
          ${author ? `<span>${author}</span>` : ''}
        </div>
      </header>

      <div class="post-body">${bodyHtml}</div>

      ${
        tags.length > 0
          ? `<div class="post-body"><div class="post-tags">${tags.map((t) => `<a>#${t}</a>`).join('')}</div></div>`
          : ''
      }
    </article>

    <p style="margin-top:2rem;text-align:center;font-size:0.75rem;color:var(--c-text-faint);font-style:italic;">
      Live preview &mdash; series nav, related posts, voting, and comments appear on the published site.
    </p>
  </div>

  <script src="/assets/js/carousel.js"></` + `script>
  <script src="/assets/js/charts.js"></` + `script>
</body>
</html>`;
  }, [bodyHtml, debouncedFm, readTime]);

  return (
    <iframe
      srcDoc={srcdoc}
      title="Post preview"
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
