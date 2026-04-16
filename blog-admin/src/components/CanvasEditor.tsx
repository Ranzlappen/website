import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { htmlToMarkdown } from '../lib/turndownService';
import type { FrontMatter } from '../types';

interface Props {
  frontMatter: FrontMatter;
  body: string;
  onBodyChange: (md: string) => void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Iframe shell with contentEditable support ─────────── */

const CANVAS_SHELL_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/assets/css/style.css">
  <style>
    :root { --header-height: 0px; }
    body { margin: 0; padding: 0; background: var(--c-bg, #0b1210); color: var(--c-text, #dce8e2); }
    .canvas-wrapper { padding: 1.5rem 1rem; }
    .voting-sidebar, .voting-mobile-bar, .read-aloud, .tts-sticky-bar,
    .post-nav, .related-posts, .comments-section, .breadcrumb { display: none !important; }
    .carousel img { display: block; max-width: 100%; border-radius: 8px; margin-bottom: 0.5rem; }
    #canvas-empty { text-align: center; padding: 4rem 1rem; color: var(--c-text-muted, #7e948a); font-style: italic; }

    /* Editable element hover/focus states */
    .post-body [contenteditable="true"] {
      outline: none;
      border-radius: 4px;
      transition: box-shadow 0.15s ease;
    }
    .post-body [contenteditable="true"]:hover {
      box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.2);
    }
    .post-body [contenteditable="true"]:focus {
      box-shadow: inset 0 0 0 1.5px rgba(74, 222, 128, 0.4);
    }

    /* Non-editable block indicators */
    .canvas-locked {
      position: relative;
      opacity: 0.85;
    }
    .canvas-locked::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px dashed var(--c-border, #253830);
      border-radius: 0.5rem;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div id="canvas-root">
      <p id="canvas-empty">Start writing to edit on the canvas...</p>
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
              position: 'bottom',
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

    /* ── contentEditable setup ──────────────────────────── */

    var EDITABLE_TAGS = ['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','FIGCAPTION','BLOCKQUOTE'];
    var LOCKED_SELECTORS = ['pre','.chart-container','iframe','img','.carousel','nav','hr','canvas','figure img'];

    function setupEditable(root) {
      // Make text elements editable
      var postBody = root.querySelector('.post-body');
      if (!postBody) return;

      // Walk through direct and nested children
      postBody.querySelectorAll('*').forEach(function(el) {
        // Skip elements inside locked containers
        var inLocked = false;
        for (var i = 0; i < LOCKED_SELECTORS.length; i++) {
          if (el.closest(LOCKED_SELECTORS[i]) && el.closest(LOCKED_SELECTORS[i]) !== el) {
            inLocked = true;
            break;
          }
        }
        if (inLocked) return;

        // Check if this element should be locked
        var isLocked = false;
        for (var j = 0; j < LOCKED_SELECTORS.length; j++) {
          if (el.matches(LOCKED_SELECTORS[j])) {
            isLocked = true;
            break;
          }
        }

        if (isLocked) {
          el.setAttribute('contenteditable', 'false');
          el.classList.add('canvas-locked');
          return;
        }

        if (EDITABLE_TAGS.indexOf(el.tagName) !== -1) {
          // Don't mark as editable if it has an id attribute (source anchors, etc.)
          // Exception: let heading text still be editable even with id
          if (el.hasAttribute('id') && !/^H[1-6]$/.test(el.tagName)) {
            el.setAttribute('contenteditable', 'false');
            el.classList.add('canvas-locked');
            return;
          }
          el.setAttribute('contenteditable', 'true');
        }
      });
    }

    /* ── Keyboard handling ──────────────────────────────── */

    function handleKeydown(e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.getAttribute('contenteditable') !== 'true') return;

      // Enter in headings: create a new paragraph after the heading
      if (e.key === 'Enter' && !e.shiftKey && /^H[1-6]$/.test(el.tagName)) {
        e.preventDefault();
        var p = document.createElement('p');
        p.setAttribute('contenteditable', 'true');
        p.innerHTML = '<br>';
        el.parentNode.insertBefore(p, el.nextSibling);
        // Move cursor into the new paragraph
        var sel = window.getSelection();
        var range = document.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        notifyChange();
        return;
      }
    }

    /* ── Paste handling ──────────────────────────────────── */

    function handlePaste(e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.getAttribute('contenteditable') !== 'true') return;

      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
      notifyChange();
    }

    /* ── Change notification ────────────────────────────── */

    var debounceTimer = null;
    function notifyChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var postBody = document.querySelector('#canvas-root .post-body');
        if (!postBody) return;
        // Clone to strip contenteditable attributes before sending
        var clone = postBody.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(function(el) {
          el.removeAttribute('contenteditable');
        });
        clone.querySelectorAll('.canvas-locked').forEach(function(el) {
          el.classList.remove('canvas-locked');
        });
        parent.postMessage({ type: 'canvas-change', html: clone.innerHTML }, '*');
      }, 300);
    }

    /* ── Message handling ───────────────────────────────── */

    window.addEventListener('message', function(e) {
      if (!e.data) return;

      if (e.data.type === 'canvas-init') {
        var root = document.getElementById('canvas-root');
        if (!root) return;
        destroyCharts(root);
        root.innerHTML = e.data.html;
        setupEditable(root);
        initCharts(root);
      }

      if (e.data.type === 'canvas-flush') {
        // Immediate sync — send current HTML without debounce
        clearTimeout(debounceTimer);
        var postBody = document.querySelector('#canvas-root .post-body');
        if (!postBody) return;
        var clone = postBody.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(function(el) {
          el.removeAttribute('contenteditable');
        });
        clone.querySelectorAll('.canvas-locked').forEach(function(el) {
          el.classList.remove('canvas-locked');
        });
        parent.postMessage({ type: 'canvas-change', html: clone.innerHTML }, '*');
      }
    });

    // Input events for contenteditable changes
    document.addEventListener('input', function(e) {
      var el = e.target;
      if (el && el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        notifyChange();
      }
    });

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('paste', handlePaste);

    parent.postMessage({ type: 'canvas-ready' }, '*');
  })();
  </sc` + `ript>
</body>
</html>`;

/* ── Component ─────────────────────────────────────────── */

export default function CanvasEditor({ frontMatter, body, onBodyChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const lastSentBodyRef = useRef<string>('');
  const isDirtyRef = useRef(false);

  // Listen for iframe ready + canvas-change messages
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'canvas-ready') {
        setIframeReady(true);
      }
      if (e.data?.type === 'canvas-change') {
        isDirtyRef.current = false;
        const md = htmlToMarkdown(e.data.html);
        lastSentBodyRef.current = md;
        onBodyChange(md);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onBodyChange]);

  // Build content HTML from markdown (same pipeline as PostPreview)
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  const contentHtml = useMemo(() => {
    const bodyHtml = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {body || '*Start writing to edit on the canvas...*'}
      </ReactMarkdown>,
    );

    const title = escapeHtml(frontMatter.title || 'Untitled Post');
    const category = frontMatter.category ? escapeHtml(frontMatter.category) : '';
    const author = frontMatter.author ? escapeHtml(frontMatter.author) : '';
    const dateStr = escapeHtml(frontMatter.date);
    const tags = frontMatter.tags.map((t) => escapeHtml(t));

    const statusBanner =
      frontMatter.status === 'draft' || frontMatter.status === 'placeholder'
        ? '<div class="status-banner" role="status"><span class="status-banner__text">This article is a draft and may be incomplete or subject to change.</span></div>'
        : frontMatter.status === 'unpublished'
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
      Canvas mode &mdash; click any text to edit. Code blocks, charts, and embeds are locked.
    </p>`;
  }, [body, frontMatter, readTime]);

  // Send content to iframe — only when body changed externally (not from our own canvas-change)
  useEffect(() => {
    if (!iframeReady) return;
    // Don't re-push if this body update came from the canvas itself
    if (body === lastSentBodyRef.current) return;
    lastSentBodyRef.current = body;
    iframeRef.current?.contentWindow?.postMessage({ type: 'canvas-init', html: contentHtml }, '*');
  }, [contentHtml, iframeReady, body]);

  // Flush sync on unmount (tab switch away)
  const flush = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'canvas-flush' }, '*');
  }, []);

  useEffect(() => {
    return () => flush();
  }, [flush]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={CANVAS_SHELL_HTML}
      title="Canvas editor"
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
