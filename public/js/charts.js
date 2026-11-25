/* Chart.js wrappers with theme-aware rebuilds. */

const registry = new Map();
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PALETTE = ['#6d7cff', '#22d3ee', '#b06bff', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#f472b6'];

export function hasCharts() {
  return typeof window.Chart !== 'undefined';
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function chartPalette() {
  return {
    text: cssVar('--text') || '#eef2ff',
    soft: cssVar('--text-soft') || '#c7d2e8',
    muted: cssVar('--muted') || '#8b9bb8',
    border: cssVar('--border') || 'rgba(148,163,184,.16)',
    accent: cssVar('--accent') || '#6d7cff',
    accent2: cssVar('--accent-2') || '#22d3ee',
    success: cssVar('--success') || '#34d399',
    warning: cssVar('--warning') || '#fbbf24',
    danger: cssVar('--danger') || '#fb7185',
    info: cssVar('--info') || '#38bdf8'
  };
}

function defaults() {
  if (!hasCharts()) return;
  const palette = chartPalette();
  window.Chart.defaults.color = palette.muted;
  window.Chart.defaults.borderColor = palette.border;
  window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily || 'Inter, sans-serif';
  window.Chart.defaults.font.size = 11;
}

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduced() ? false : { duration: 850, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 16, 32, .94)',
        titleColor: '#fff',
        bodyColor: '#c7d2e8',
        borderColor: 'rgba(148, 163, 184, .25)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8
      },
      ...(extra.plugins || {})
    },
    scales: extra.scales || undefined,
    cutout: extra.cutout,
    ...extra
  };
}

export function renderChart(canvas, build) {
  if (!canvas || !hasCharts()) return null;
  defaults();
  if (registry.has(canvas)) {
    const existing = registry.get(canvas);
    try { existing.chart.destroy(); } catch { /* already gone */ }
  }
  const chart = build(window.Chart, chartPalette());
  if (!chart) return null;
  registry.set(canvas, { chart, build });
  return chart;
}

function destroyCanvas(canvas) {
  if (registry.has(canvas)) {
    try { registry.get(canvas).chart.destroy(); } catch { /* ignore */ }
    registry.delete(canvas);
  }
}

export function doughnutChart(canvas, { labels = [], values = [], colors = null, legend = false, tooltipLabel = '' } = {}) {
  return renderChart(canvas, (Chart, palette) => new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors || PALETTE,
        borderColor: 'transparent',
        borderWidth: 2,
        hoverOffset: 5,
        borderRadius: 4
      }]
    },
    options: baseOptions({
      cutout: '76%',
      plugins: {
        legend: {
          display: legend,
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14, color: palette.muted }
        },
        tooltip: {
          backgroundColor: 'rgba(10, 16, 32, .94)',
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.raw) || 0;
              const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
              const pct = total ? Math.round((value / total) * 100) : 0;
              return ` ${tooltipLabel || ctx.label}: ${value} (${pct}%)`;
            }
          }
        }
      }
    })
  }));
}

export function barChart(canvas, { labels = [], datasets = [], horizontal = false, stacked = false, legend = false, yMax = null } = {}) {
  return renderChart(canvas, (Chart, palette) => {
    const prepared = datasets.map((set, index) => ({
      borderRadius: 5,
      maxBarThickness: 34,
      backgroundColor: set.backgroundColor || PALETTE[index % PALETTE.length],
      borderColor: set.borderColor || 'transparent',
      ...set
    }));
    return new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: prepared },
      options: baseOptions({
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: {
            display: legend,
            position: 'bottom',
            labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14, color: palette.muted }
          }
        },
        scales: {
          x: {
            stacked,
            grid: { display: horizontal, color: palette.border, drawBorder: false },
            border: { display: false },
            ticks: { color: palette.muted, maxRotation: 0, autoSkip: true }
          },
          y: {
            stacked,
            beginAtZero: true,
            ...(yMax ? { max: yMax } : {}),
            grid: { display: !horizontal, color: palette.border, drawBorder: false },
            border: { display: false },
            ticks: { color: palette.muted, precision: 0 }
          }
        }
      })
    });
  });
}

export function lineChart(canvas, { labels = [], values = [], label = 'Predicted marks', yMax = 100, fill = true } = {}) {
  return renderChart(canvas, (Chart, palette) => {
    const ctx = canvas.getContext('2d');
    let gradient = palette.accent;
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement?.clientHeight || 260);
      gradient.addColorStop(0, 'rgba(109, 124, 255, .32)');
      gradient.addColorStop(1, 'rgba(109, 124, 255, 0)');
    }
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: palette.accent,
          backgroundColor: fill ? gradient : 'transparent',
          fill,
          tension: 0.38,
          borderWidth: 2,
          pointRadius: values.length > 12 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: palette.accent,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5
        }]
      },
      options: baseOptions({
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx2) => ` ${label}: ${Number(ctx2.raw).toFixed(1)}/100` }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: palette.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
          },
          y: {
            beginAtZero: false,
            min: 0,
            max: yMax,
            grid: { color: palette.border, drawBorder: false },
            border: { display: false },
            ticks: { color: palette.muted, stepSize: 20 }
          }
        }
      })
    });
  });
}

export function destroyCharts() {
  for (const canvas of Array.from(registry.keys())) destroyCanvas(canvas);
}

let themeBound = false;
if (!themeBound) {
  themeBound = true;
  window.addEventListener('sp:theme', () => {
    defaults();
    for (const [canvas, { build }] of Array.from(registry.entries())) {
      try {
        registry.get(canvas)?.chart.destroy();
      } catch { /* ignore */ }
      try {
        const chart = build(window.Chart, chartPalette());
        registry.set(canvas, { chart, build });
      } catch { /* canvas may have been removed */ }
    }
  });
  window.addEventListener('pagehide', destroyCharts);
}
