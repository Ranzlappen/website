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

/* ── Persistent iframe shell (loaded once) ─────────────── */

const SHELL_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/assets/css/style.css">
  <style>
    :root { --header-height: 0px; }
    body { margin: 0; padding: 0; background: var(--c-bg, #0b1210); color: var(--c-text, #dce8e2); }
    .preview-wrapper { padding: 1.5rem 1rem; }
    .voting-sidebar, .voting-mobile-bar, .read-aloud, .tts-sticky-bar,
    .post-nav, .related-posts, .comments-section, .breadcrumb { display: none !important; }
    .carousel img { display: block; max-width: 100%; border-radius: 8px; margin-bottom: 0.5rem; }
    #preview-empty { text-align: center; padding: 4rem 1rem; color: var(--c-text-muted, #7e948a); font-style: italic; }
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <div id="preview-root">
      <p id="preview-empty">Start writing to see a preview...</p>
    </div>
  </div>

  <sc` + `ript src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></sc` + `ript>
  <sc` + `ript>
  (function() {
    var PALETTE = ['#4ade80','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#64748b'];

    function css(prop) {
      return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    }

    function getTheme() {
      return {
        text:    css('--c-text')       || '#dce8e2',
        muted:   css('--c-text-muted') || '#7e948a',
        border:  css('--c-border')     || '#253830',
        surface: css('--c-surface')    || '#15201b',
        font:    css('--f-body')       || 'sans-serif'
      };
    }

    function buildChart(canvas, t) {
      var type   = canvas.getAttribute('data-chart');
      var title  = canvas.getAttribute('data-title') || '';
      var labels = JSON.parse(canvas.getAttribute('data-labels') || '[]');
      var isPie  = type === 'pie' || type === 'doughnut';
      var datasets;

      if (isPie) {
        var vals   = JSON.parse(canvas.getAttribute('data-values') || '[]');
        var colors = canvas.getAttribute('data-colors');
        colors = colors ? JSON.parse(colors) : PALETTE.slice(0, labels.length);
        datasets = [{ data: vals, backgroundColor: colors, borderColor: t.surface, borderWidth: 2 }];
      } else {
        var raw = JSON.parse(canvas.getAttribute('data-datasets') || '[]');
        datasets = raw.map(function(ds, idx) {
          var c = ds.color || PALETTE[idx % PALETTE.length];
          var out = { label: ds.label || '', data: ds.data || [] };
          if (type === 'bar') {
            out.backgroundColor = ds.colors || c;
            out.borderColor = 'transparent';
            out.borderRadius = 4;
            out.borderSkipped = false;
            out.maxBarThickness = 60;
          } else {
            out.borderColor = c;
            out.backgroundColor = c + '1a';
            out.pointBackgroundColor = c;
            out.pointBorderColor = t.surface;
            out.pointBorderWidth = 2;
            out.pointRadius = 4;
            out.tension = 0.3;
            out.fill = !!ds.fill;
          }
          return out;
        });
      }

      var cfg = {
        type: type,
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          animation: { duration: 400 },
          plugins: {
            title: { display: !!title, text: title, color: t.text, font: { size: 14, weight: 600 }, padding: { bottom: 16 } },
            legend: {
              display: isPie || datasets.length > 1,
              position: isPie ? 'bottom' : 'bottom',
              labels: { color: t.text, padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
            },
            tooltip: { backgroundColor: t.surface, titleColor: t.text, bodyColor: t.muted, borderColor: t.border, borderWidth: 1, cornerRadius: 6, padding: 10 }
          }
        }
      };

      if (type === 'bar') {
        cfg.options.scales = {
          x: { grid: { display: false }, ticks: { color: t.muted, font: { size: 11 } } },
          y: { grid: { color: t.border + '80' }, ticks: { color: t.muted, font: { size: 11 } }, beginAtZero: true }
        };
      } else if (type === 'line') {
        cfg.options.scales = {
          x: { grid: { color: t.border + '40' }, ticks: { color: t.muted, font: { size: 11 } } },
          y: { grid: { color: t.border + '80' }, ticks: { color: t.muted, font: { size: 11 } }, beginAtZero: canvas.getAttribute('data-zero') !== 'false' }
        };
        cfg.options.interaction = { mode: 'index', intersect: false };
      }

      new Chart(canvas, cfg);
    }

    function initCharts(root) {
      if (typeof Chart === 'undefined') return;
      var t = getTheme();
      Chart.defaults.color = t.muted;
      Chart.defaults.borderColor = t.border;
      Chart.defaults.font.family = t.font;
      root.querySelectorAll('canvas[data-chart]').forEach(function(c) {
        try { buildChart(c, t); } catch(e) { console.warn('Chart init failed:', e); }
      });
    }

    function destroyCharts(root) {
      if (typeof Chart === 'undefined') return;
      root.querySelectorAll('canvas').forEach(function(c) {
        var existing = Chart.getChart(c);
        if (existing) existing.destroy();
      });
    }

    window.addEventListener('message', function(e) {
      if (!e.data || e.data.type !== 'preview-update') return;
      var root = document.getElementById('preview-root');
      if (!root) return;
      destroyCharts(root);
      root.innerHTML = e.data.html;
      initCharts(root);
    });

    parent.postMessage({ type: 'preview-ready' }, '*');
  })();
  </sc` + `ript>
</body>
</html>`;

/* ── Component ─────────────────────────────────────────── */

export default function PostPreview({ frontMatter, body }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [debouncedBody, setDebouncedBody] = useState(body);
  const [debouncedFm, setDebouncedFm] = useState(frontMatter);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce content updates
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedBody(body);
      setDebouncedFm(frontMatter);
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [body, frontMatter]);

  // Listen for iframe ready
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'preview-ready') setIframeReady(true);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Build content HTML
  const wordCount = debouncedBody.split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  const contentHtml = useMemo(() => {
    const bodyHtml = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {debouncedBody || '*Start writing to see a preview...*'}
      </ReactMarkdown>,
    );

    const title = escapeHtml(debouncedFm.title || 'Untitled Post');
    const category = debouncedFm.category ? escapeHtml(debouncedFm.category) : '';
    const author = debouncedFm.author ? escapeHtml(debouncedFm.author) : '';
    const dateStr = escapeHtml(debouncedFm.date);
    const tags = debouncedFm.tags.map((t) => escapeHtml(t));

    const statusBanner =
      debouncedFm.status === 'draft' || debouncedFm.status === 'placeholder'
        ? '<div class="status-banner" role="status"><span class="status-banner__text">This article is a draft and may be incomplete or subject to change.</span></div>'
        : debouncedFm.status === 'unpublished'
          ? '<div class="status-banner" role="status"><span class="status-banner__text">This article is unpublished.</span></div>'
          : '';

    return `<article class="post">
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
    </p>`;
  }, [debouncedBody, debouncedFm, readTime]);

  // Send content to iframe via postMessage
  useEffect(() => {
    if (!iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'preview-update', html: contentHtml }, '*');
  }, [contentHtml, iframeReady]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={SHELL_HTML}
      title="Post preview"
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
