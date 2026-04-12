/*
CHANGE: New Chart.js auto-initializer for declarative chart rendering
REASON: Chart system overhaul , replaces pure CSS charts with Chart.js for professional visuals
DATE: 2026-04-03
*/

/**
 * charts.js , Auto-initializes Chart.js charts from declarative HTML.
 *
 * Usage (in any .md post):
 *   <div class="chart-container" role="figure" aria-label="Description">
 *     <canvas data-chart="bar|pie|doughnut|line"
 *       data-title="Chart Title"
 *       data-labels='["A","B","C"]'
 *       data-datasets='[{"label":"Series","data":[10,20,30]}]'>
 *     </canvas>
 *   </div>
 *
 * Pie/Doughnut shorthand:
 *     <canvas data-chart="pie"
 *       data-labels='["A","B"]'
 *       data-values='[60,40]'
 *       data-colors='["#4ade80","#3b82f6"]'>
 *     </canvas>
 */
(function () {
  'use strict';

  var PALETTE = [
    '#4ade80', '#3b82f6', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#ef4444', '#64748b'
  ];

  function css(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  function theme() {
    return {
      text:      css('--c-text')       || '#dce8e2',
      muted:     css('--c-text-muted') || '#7e948a',
      border:    css('--c-border')     || '#253830',
      surface:   css('--c-surface')    || '#15201b',
      font:      css('--f-body')       || 'sans-serif'
    };
  }

  function init() {
    var els = document.querySelectorAll('canvas[data-chart]');
    if (!els.length) return;

    var t = theme();
    Chart.defaults.color = t.muted;
    Chart.defaults.borderColor = t.border;
    Chart.defaults.font.family = t.font;

    for (var i = 0; i < els.length; i++) {
      build(els[i], t);
    }
  }

  function build(canvas, t) {
    var type   = canvas.getAttribute('data-chart');
    var title  = canvas.getAttribute('data-title') || '';
    var labels = JSON.parse(canvas.getAttribute('data-labels') || '[]');
    var isPie  = type === 'pie' || type === 'doughnut';
    var datasets;

    if (isPie) {
      var vals   = JSON.parse(canvas.getAttribute('data-values') || '[]');
      var colors = canvas.getAttribute('data-colors');
      colors = colors ? JSON.parse(colors) : PALETTE.slice(0, labels.length);
      datasets = [{
        data: vals,
        backgroundColor: colors,
        borderColor: t.surface,
        borderWidth: 2,
        hoverBorderColor: t.text,
        hoverBorderWidth: 2
      }];
    } else {
      var raw = JSON.parse(canvas.getAttribute('data-datasets') || '[]');
      datasets = raw.map(function (ds, idx) {
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
          out.pointHoverRadius = 6;
          out.tension = 0.3;
          out.fill = !!ds.fill;
        }
        return out;
      });
    }

    var cfg = {
      type: type === 'doughnut' ? 'doughnut' : type,
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          title: {
            display: !!title,
            text: title,
            color: t.text,
            font: { size: 14, weight: 600 },
            padding: { bottom: 16 }
          },
          legend: {
            display: isPie || datasets.length > 1,
            position: isPie ? (window.innerWidth < 600 ? 'bottom' : 'right') : 'bottom',
            labels: {
              color: t.text,
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: t.surface,
            titleColor: t.text,
            bodyColor: t.muted,
            borderColor: t.border,
            borderWidth: 1,
            cornerRadius: 6,
            padding: 10,
            displayColors: true
          }
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

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cfg.options.animation = false;
    }

    new Chart(canvas, cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
