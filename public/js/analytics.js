import { initShell } from './shell.js';
import { get, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskBadge, categoryBadge,
  emptyStateHtml, errorStateHtml, toast
} from './ui.js';
import { doughnutChart, barChart, lineChart, hasCharts } from './charts.js';

const KPI = {
  mae: document.getElementById('kpi-mae').querySelector('.kpi-card__value'),
  rmse: document.getElementById('kpi-rmse').querySelector('.kpi-card__value'),
  r2: document.getElementById('kpi-r2').querySelector('.kpi-card__value'),
  dataset: document.getElementById('kpi-dataset').querySelector('.kpi-card__value')
};

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function safeValue(value, digits = 0, fallback = '--') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
  return Number(value).toFixed(digits);
}

function renderKPIs(active) {
  if (!active) {
    KPI.mae.textContent = '--';
    KPI.rmse.textContent = '--';
    KPI.r2.textContent = '--';
    KPI.dataset.textContent = '--';
    return;
  }
  KPI.mae.textContent = safeValue(active.mae, 3);
  KPI.rmse.textContent = safeValue(active.rmse, 3);
  KPI.r2.textContent = safeValue(active.r2, 4);
  KPI.dataset.textContent = active.dataset_rows ? formatNumber(active.dataset_rows) : '--';
}

function renderCharts(metrics) {
  if (!hasCharts()) {
    document.getElementById('chart-grid').innerHTML = `<p class="text-sm text-muted">Chart library is unavailable. Models: ${(metrics || []).map((m) => `${m.model_name} (MAE ${safeValue(m.mae, 3)})`).join(' · ')}</p>`;
    return;
  }

  const names = metrics.map((m) => m.model_name);
  const maes = metrics.map((m) => m.mae);
  const rmses = metrics.map((m) => m.rmse);
  const r2s = metrics.map((m) => m.r2);

  const activeModel = metrics.find((m) => m.is_active) || metrics[0];

  barChart(document.getElementById('mae-chart'), {
    labels: names,
    datasets: [{ label: 'MAE (lower is better)', data: maes }],
    yMax: Math.max(...maes.filter((v) => Number.isFinite(v))) * 1.25 || 10
  });

  barChart(document.getElementById('rmse-chart'), {
    labels: names,
    datasets: [{ label: 'RMSE (lower is better)', data: rmses }],
    yMax: Math.max(...rmses.filter((v) => Number.isFinite(v))) * 1.25 || 10
  });

  barChart(document.getElementById('r2-chart'), {
    labels: names,
    datasets: [{ label: 'R² (higher is better)', data: r2s }],
    yMax: 1
  });

  const active = metrics.find((m) => m.is_active) || metrics[0];
  const importance = active && active.feature_importance && active.feature_importance.length
    ? active.feature_importance
    : [];
  if (importance.length) {
    const sorted = [...importance].sort((a, b) => a.importance - b.importance);
    barChart(document.getElementById('importance-chart'), {
      labels: sorted.map((f) => f.label || f.feature),
      datasets: [{ label: 'Importance', data: sorted.map((f) => f.importance) }],
      horizontal: true,
      yMax: 1
    });
  } else {
    const wrap = document.getElementById('importance-chart')?.parentElement;
    if (wrap) {
      wrap.innerHTML = emptyStateHtml({
        title: 'No feature importance stored',
        message: 'The active model did not expose per-feature importance values.',
        iconName: 'sliders'
      });
    }
  }
}

function renderTable(metrics) {
  const wrap = document.getElementById('metrics-table-wrap');
  if (!metrics || !metrics.length) {
    wrap.innerHTML = emptyStateHtml({
      title: 'No stored metrics',
      message: 'Run ml-service/train_model.py, then npm run seed:metrics to store evaluation results.',
      iconName: 'database'
    });
    return;
  }

  const activeName = metrics.find((m) => m.is_active)?.model_name || metrics[0].model_name;
  wrap.innerHTML = `<div class="table-wrap">
    <table class="data-table model-table">
      <caption class="sr-only">Stored held-out model evaluation metrics</caption>
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col">MAE</th>
          <th scope="col">RMSE</th>
          <th scope="col">R²</th>
          <th scope="col">Dataset rows</th>
          <th scope="col">Test rows</th>
          <th scope="col">Trained</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        ${metrics.map((m) => `<tr class="${m.is_active ? 'is-active-row' : ''}">
          <td><strong class="cell-strong">${escapeHtml(m.model_name)}</strong></td>
          <td class="font-mono">${safeValue(m.mae, 3)}</td>
          <td class="font-mono">${safeValue(m.rmse, 3)}</td>
          <td class="font-mono">${safeValue(m.r2, 4)}</td>
          <td class="font-mono">${formatNumber(m.dataset_rows)}</td>
          <td class="font-mono">${formatNumber(m.test_rows)}</td>
          <td class="nowrap font-mono">${formatDate(m.trained_at)}</td>
          <td><span class="badge ${m.is_active ? 'badge--solid' : 'badge'}">${m.is_active ? 'Active' : ''}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <p class="text-xs text-muted mt-3">${icon('info')}<span>Active model: <strong>${escapeHtml(activeName)}</strong>. MAE, RMSE and R² are the stored held-out evaluation results — not live accuracy guarantees.</span></p>`;
}

function renderDataset(info) {
  const wrap = document.getElementById('dataset-info');
  if (!info) {
    wrap.innerHTML = emptyStateHtml({
      title: 'Dataset info unavailable',
      message: 'Stored metrics do not include dataset details.',
      iconName: 'database'
    });
    return;
  }

  wrap.innerHTML = `<div class="dataset-grid">
    <div class="dataset-item">
      <span class="dataset-item__label">Name</span>
      <span class="dataset-item__value truncate" title="${escapeHtml(info.name || 'UCI Student Performance')}">${escapeHtml(info.name || 'UCI Student Performance')}</span>
    </div>
    <div class="dataset-item">
      <span class="dataset-item__label">Rows</span>
      <span class="dataset-item__value">${formatNumber(info.rows)}</span>
    </div>
    <div class="dataset-item">
      <span class="dataset-item__label">Train rows</span>
      <span class="dataset-item__value">${formatNumber(info.train_rows)}</span>
    </div>
    <div class="dataset-item">
      <span class="dataset-item__label">Test rows</span>
      <span class="dataset-item__value">${formatNumber(info.test_rows)}</span>
    </div>
    <div class="dataset-item">
      <span class="dataset-item__label">Population</span>
      <span class="dataset-item__value text-sm" style="max-width:120px">${escapeHtml(info.population || 'Secondary-school students')}</span>
    </div>
    <div class="dataset-item">
      <span class="dataset-item__label">Target</span>
      <span class="dataset-item__value text-sm">${escapeHtml(info.target || 'Final grade scaled to 0-100')}</span>
    </div>
    <div class="dataset-item">
      <span class="dataset-item__label">Split</span>
      <span class="dataset-item__value text-xs">${escapeHtml(info.split || 'Group-held-out')}</span>
    </div>
  </div>`;
}

async function load() {
  const [metricsResult] = await Promise.allSettled([
    get('/api/models/metrics')
  ]);

  if (metricsResult.status !== 'fulfilled') {
    throw metricsResult.reason;
  }

  const data = metricsResult.value;
  const metrics = data.metrics || [];

  renderKPIs(data.active_metadata ? { mae: data.active_metadata.mae, rmse: data.active_metadata.rmse, r2: data.active_metadata.r2, dataset_rows: data.active_metadata.dataset_rows } : metrics.find((m) => m.is_active) || metrics[0]);
  renderCharts(metrics);
  renderTable(metrics);
  renderDataset(data.active_metadata?.dataset || null);

  if (data.empty) {
    toast('No stored model evaluation metrics yet.', 'info');
  }
}

async function boot() {
  const user = await initShell({
    pageKey: 'analytics',
    title: 'Performance analytics',
    eyebrow: 'Admin workspace',
    roles: ['admin']
  });
  if (!user) return;

  try {
    await load();
  } catch (err) {
    document.getElementById('chart-grid').innerHTML = errorStateHtml(errorMessage(err), 'analytics-retry');
    const retry = document.getElementById('analytics-retry');
    if (retry) retry.addEventListener('click', () => window.location.reload());
    document.getElementById('metrics-table-wrap').innerHTML = errorStateHtml(errorMessage(err), 'metrics-retry');
    const retry2 = document.getElementById('metrics-retry');
    if (retry2) retry2.addEventListener('click', () => window.location.reload());
  }
}

boot();
