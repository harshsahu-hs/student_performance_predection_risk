import { initShell } from './shell.js';
import { get, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskMeta, riskBadge,
  emptyStateHtml, errorStateHtml, animateCounter, toast
} from './ui.js';
import { doughnutChart, lineChart, hasCharts } from './charts.js';
import { initRingGauge } from './three-scenes.js';

const statGrid = document.getElementById('stat-grid');
const riskCanvas = document.getElementById('risk-chart');
const categoryCanvas = document.getElementById('category-chart');
const trendCanvas = document.getElementById('trend-chart');
const trendWrap = document.getElementById('trend-wrap');
const trendEmpty = document.getElementById('trend-empty');
const atRiskList = document.getElementById('at-risk-list');
const recentWrap = document.getElementById('recent-wrap');
const modelSnapshot = document.getElementById('model-snapshot');
const gaugeStage = document.getElementById('avg-gauge');
const gaugeValue = document.getElementById('avg-gauge-value');

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function monthLabel(value) {
  if (!value) return '';
  const [year, month] = String(value).split('-').map(Number);
  if (!year || !month) return String(value);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function statCard({ label, value, iconName, foot, iconClass = '' }) {
  return `<article class="card stat-card" data-tilt>
    <div class="stat-card__top">
      <span class="stat-card__label">${escapeHtml(label)}</span>
      <span class="stat-card__icon ${iconClass}">${icon(iconName)}</span>
    </div>
    <div class="stat-card__value" data-count="${Number(value) || 0}">0</div>
    <div class="stat-card__foot">${foot}</div>
  </article>`;
}

function renderStats(totals) {
  statGrid.innerHTML = [
    statCard({
      label: 'Students',
      value: totals.total_students,
      iconName: 'users',
      foot: `<span class="status-pill status-pill--active">${formatNumber(totals.active_students)} active</span>
        <span aria-hidden="true">·</span><span>${formatNumber(totals.inactive_students)} awaiting activation</span>`
    }),
    statCard({
      label: 'Assessments',
      value: totals.total_assessments,
      iconName: 'clipboard',
      iconClass: 'stat-card__icon--success',
      foot: '<span>Records with attendance and internal marks</span>'
    }),
    statCard({
      label: 'Predictions',
      value: totals.total_predictions,
      iconName: 'brain',
      foot: `<span>${formatNumber(totals.students_with_predictions)} students with a current estimate</span>`
    }),
    statCard({
      label: 'Average estimate',
      value: totals.average_predicted_marks || 0,
      iconName: 'gauge',
      iconClass: 'stat-card__icon--warn',
      foot: `<span>Latest estimate per student · out of 100</span>`
    })
  ].join('');

  statGrid.querySelectorAll('[data-count]').forEach((el) => {
    const raw = el.dataset.count;
    const isAverage = el.closest('.stat-card')?.querySelector('.stat-card__label')?.textContent === 'Average estimate';
    if (isAverage && !totals.average_predicted_marks) {
      el.textContent = '--';
      return;
    }
    animateCounter(el, Number(raw), { digits: isAverage ? 1 : 0 });
  });

  if (gaugeValue) {
    gaugeValue.textContent = totals.average_predicted_marks == null
      ? '--'
      : formatNumber(totals.average_predicted_marks, 1);
  }

  initRingGauge(gaugeStage, {
    value: totals.average_predicted_marks || 0,
    color: css('--accent', '#6d7cff'),
    secondary: totals.students_with_predictions
      ? Math.min(100, (totals.students_with_predictions / Math.max(1, totals.active_students)) * 100)
      : null,
    secondaryColor: css('--accent-2', '#22d3ee')
  }).catch(() => {
    gaugeStage?.classList.add('scene-stage--fallback');
  });
}

function renderRisk(distribution) {
  const low = Number(distribution.low) || 0;
  const medium = Number(distribution.medium) || 0;
  const high = Number(distribution.high) || 0;
  const total = low + medium + high;
  const legend = document.getElementById('risk-legend');
  const rows = [
    { label: 'Low', value: low, color: css('--success', '#34d399') },
    { label: 'Moderate', value: medium, color: css('--warning', '#fbbf24') },
    { label: 'High', value: high, color: css('--danger', '#fb7185') }
  ];

  legend.innerHTML = rows.map((row) => `<div class="legend__item">
    <span class="legend__swatch" style="background:${row.color}"></span>
    <span class="legend__label">${row.label}</span>
    <span class="legend__value">${total ? Math.round((row.value / total) * 100) : 0}%</span>
  </div>`).join('');

  if (!hasCharts() || total === 0) {
    const box = riskCanvas?.parentElement;
    if (!total && box) {
      box.innerHTML = emptyStateHtml({
        title: 'No predictions yet',
        message: 'Run an assessment to create the first support signal.',
        iconName: 'shield',
        actionHtml: '<a class="btn btn--primary btn--sm" href="/pages/assessments.html">Create assessment</a>'
      });
    } else if (box) {
      box.innerHTML = `<p class="text-sm text-muted">Chart library unavailable. Low ${low} · Moderate ${medium} · High ${high}.</p>`;
    }
    return;
  }

  doughnutChart(riskCanvas, {
    labels: rows.map((r) => r.label),
    values: rows.map((r) => r.value),
    colors: rows.map((r) => r.color)
  });
}

function renderCategories(list) {
  const rows = (list || []).filter((r) => r.category);
  const legend = document.getElementById('category-legend');
  const colors = {
    Excellent: css('--success', '#34d399'),
    Good: css('--info', '#38bdf8'),
    Average: css('--accent', '#6d7cff'),
    'Below Average': css('--warning', '#fbbf24'),
    'Needs Support': css('--danger', '#fb7185')
  };

  if (!rows.length) {
    const box = categoryCanvas?.parentElement;
    if (box) {
      box.innerHTML = emptyStateHtml({
        title: 'No bands to show',
        message: 'Performance bands appear after the first prediction.',
        iconName: 'chart'
      });
    }
    legend.innerHTML = '';
    return;
  }

  legend.innerHTML = rows.map((row) => `<div class="legend__item">
    <span class="legend__swatch" style="background:${colors[row.category] || css('--muted', '#8b9bb8')}"></span>
    <span class="legend__label">${escapeHtml(row.category)}</span>
    <span class="legend__value">${formatNumber(row.count)}</span>
  </div>`).join('');

  if (!hasCharts()) return;
  doughnutChart(categoryCanvas, {
    labels: rows.map((r) => r.category),
    values: rows.map((r) => r.count),
    colors: rows.map((r) => colors[r.category] || css('--muted', '#8b9bb8'))
  });
}

function renderTrend(trend) {
  if (!trend || !trend.length) {
    if (trendWrap) trendWrap.classList.add('hidden');
    if (trendEmpty) {
      trendEmpty.classList.remove('hidden');
      trendEmpty.innerHTML = emptyStateHtml({
        title: 'No trend yet',
        message: 'Monthly averages appear once predictions have been saved.',
        iconName: 'trend'
      });
    }
    return;
  }
  if (!hasCharts()) {
    if (trendWrap) trendWrap.classList.add('hidden');
    if (trendEmpty) {
      trendEmpty.classList.remove('hidden');
      trendEmpty.innerHTML = `<p class="text-sm text-muted">Chart library unavailable. Monthly averages: ${trend.map((t) => `${monthLabel(t.month)} ${formatNumber(t.average_predicted_marks, 1)}`).join(' · ')}</p>`;
    }
    return;
  }
  lineChart(trendCanvas, {
    labels: trend.map((t) => monthLabel(t.month)),
    values: trend.map((t) => t.average_predicted_marks),
    label: 'Average predicted marks'
  });
}

function renderAtRisk(students) {
  if (!students || !students.length) {
    atRiskList.innerHTML = emptyStateHtml({
      title: 'No current medium or high signals',
      message: 'That is good news, not a guarantee. Re-check after the next round of assessments.',
      iconName: 'shield-check'
    });
    return;
  }

  atRiskList.innerHTML = students.map((student) => {
    const meta = riskMeta(student.risk_level);
    return `<a class="mini-item" href="/pages/reports.html?student=${encodeURIComponent(student.student_id)}">
      <span class="avatar">${escapeHtml(initials(student.full_name))}</span>
      <span class="mini-item__main">
        <span class="mini-item__title">${escapeHtml(student.full_name)}</span>
        <span class="mini-item__meta">${escapeHtml(student.enrollment_no)} · ${escapeHtml(student.course || '')}</span>
        <span class="mini-item__meta">Signal ${formatNumber(student.risk_score, 1)}/100 · ${escapeHtml(meta.description)}</span>
      </span>
      <span class="badge risk-badge ${meta.className}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>
    </a>`;
  }).join('');
}

function renderRecent(rows) {
  if (!rows || !rows.length) {
    recentWrap.innerHTML = emptyStateHtml({
      title: 'No assessments yet',
      message: 'Create the first assessment to generate a prediction and support plan.',
      iconName: 'clipboard',
      actionHtml: '<a class="btn btn--primary btn--sm" href="/pages/assessments.html">New assessment</a>'
    });
    return;
  }

  recentWrap.innerHTML = `<div class="table-wrap">
    <table class="data-table">
      <caption class="sr-only">Most recent assessments</caption>
      <thead><tr>
        <th scope="col">Student</th>
        <th scope="col">Date</th>
        <th scope="col">Attendance</th>
        <th scope="col">Internal</th>
        <th scope="col">Estimate</th>
        <th scope="col">Signal</th>
      </tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>
          <td>
            <a class="user-cell" href="/pages/reports.html?student=${encodeURIComponent(row.student_id)}" style="color:inherit">
              <span class="avatar">${escapeHtml(initials(row.full_name))}</span>
              <span>
                <span class="user-cell__name">${escapeHtml(row.full_name)}</span>
                <span class="user-cell__meta">${escapeHtml(row.enrollment_no)}</span>
              </span>
            </a>
          </td>
          <td class="nowrap">${formatDate(row.assessment_date)}</td>
          <td class="font-mono">${formatNumber(row.attendance, 1)}%</td>
          <td class="font-mono">${formatNumber(row.internal_marks, 1)}%</td>
          <td>${row.predicted_marks == null
            ? '<span class="badge">Pending</span>'
            : `<strong class="font-mono">${formatNumber(row.predicted_marks, 1)}</strong><span class="text-muted text-xs"> /100</span>`}</td>
          <td>${row.risk_level ? riskBadge(row.risk_level) : '<span class="badge">Not assessed</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderModel(metricsData) {
  if (!metricsData || !metricsData.metrics || !metricsData.metrics.length) {
    modelSnapshot.innerHTML = emptyStateHtml({
      title: 'No stored metrics',
      message: 'Train the model, then store its evaluation metrics. Nothing is fabricated here.',
      iconName: 'database'
    });
    return;
  }
  const active = metricsData.metrics.find((m) => m.is_active) || metricsData.metrics[0];
  modelSnapshot.innerHTML = `<div class="detail-list">
    <div class="detail-row"><span class="detail-row__label">Active model</span><span class="detail-row__value">${escapeHtml(active.model_name)}</span></div>
    <div class="detail-row"><span class="detail-row__label">MAE</span><span class="detail-row__value font-mono">${formatNumber(active.mae, 2)} marks</span></div>
    <div class="detail-row"><span class="detail-row__label">RMSE</span><span class="detail-row__value font-mono">${formatNumber(active.rmse, 2)} marks</span></div>
    <div class="detail-row"><span class="detail-row__label">R²</span><span class="detail-row__value font-mono">${formatNumber(active.r2, 4)}</span></div>
    <div class="detail-row"><span class="detail-row__label">Dataset</span><span class="detail-row__value">${formatNumber(active.dataset_rows)} UCI records</span></div>
    <div class="detail-row"><span class="detail-row__label">Held-out test</span><span class="detail-row__value">${formatNumber(active.test_rows)} records</span></div>
    <div class="detail-row"><span class="detail-row__label">Trained</span><span class="detail-row__value">${formatDate(active.trained_at)}</span></div>
  </div>
  <a class="btn btn--secondary btn--sm btn--block mt-4" href="/pages/analytics.html">See model comparison</a>
  <p class="disclaimer-note mt-3">${icon('info')}<span>Evaluation is on held-out secondary-school data. Accuracy for university students has not been validated.</span></p>`;
}

function showError(message) {
  statGrid.innerHTML = `<div class="span-12">${errorStateHtml(message, 'dashboard-retry')}</div>`;
  atRiskList.innerHTML = errorStateHtml(message, 'risk-retry');
  recentWrap.innerHTML = errorStateHtml(message, 'recent-retry');
  modelSnapshot.innerHTML = errorStateHtml(message, 'model-retry');
  ['dashboard-retry', 'risk-retry', 'recent-retry', 'model-retry'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => window.location.reload());
  });
}

async function load() {
  const [overviewResult, metricsResult] = await Promise.allSettled([
    get('/api/analytics/overview'),
    get('/api/models/metrics')
  ]);

  if (overviewResult.status !== 'fulfilled') {
    showError(errorMessage(overviewResult.reason));
    return;
  }

  const data = overviewResult.value;
  renderStats(data.totals);
  renderRisk(data.risk_distribution);
  renderCategories(data.category_distribution);
  renderTrend(data.trend);
  renderAtRisk(data.at_risk_students);
  renderRecent(data.recent_assessments);

  if (metricsResult.status === 'fulfilled') {
    renderModel(metricsResult.value);
  } else {
    modelSnapshot.innerHTML = emptyStateHtml({
      title: 'Metrics unavailable',
      message: errorMessage(metricsResult.reason),
      iconName: 'database'
    });
  }

  if (data.empty) {
    toast('No predictions yet. Create an assessment to start the trend.', 'info');
  }
}

async function boot() {
  const user = await initShell({
    pageKey: 'overview',
    title: 'Admin dashboard',
    eyebrow: 'Admin workspace',
    roles: ['admin']
  });
  if (!user) return;

  try {
    await load();
  } catch (err) {
    showError(errorMessage(err));
  }
}

boot();
