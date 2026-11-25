import { initShell } from './shell.js';
import { get, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskMeta, riskBadge,
  emptyStateHtml, errorStateHtml, toast
} from './ui.js';
import { doughnutChart, hasCharts } from './charts.js';

const LEVEL_ORDER = { high: 0, medium: 1, low: 2 };

async function load() {
  const [riskResult] = await Promise.allSettled([
    get('/api/analytics/risk', { query: { level: 'all' } })
  ]);

  if (riskResult.status !== 'fulfilled') {
    throw riskResult.reason;
  }

  const data = riskResult.value;
  const students = data.students || [];
  const distribution = data.risk_distribution || { low: 0, medium: 0, high: 0, total: 0 };

  renderDistribution(distribution);
  renderStatRow(distribution);
  renderAtRisk(students, distribution);
}

function renderDistribution(distribution) {
  const low = Number(distribution.low) || 0;
  const medium = Number(distribution.medium) || 0;
  const high = Number(distribution.high) || 0;
  const total = Number(distribution.total) || (low + medium + high);

  const legend = document.getElementById('risk-legend');
  const rows = [
    { label: 'Low', value: low, color: getComputedStyle(document.documentElement).getPropertyValue('--success') || '#34d399' },
    { label: 'Moderate', value: medium, color: getComputedStyle(document.documentElement).getPropertyValue('--warning') || '#fbbf24' },
    { label: 'High', value: high, color: getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#fb7185' }
  ];

  legend.innerHTML = rows.map((row) => `<div class="legend__item">
    <span class="legend__swatch" style="background:${row.color}"></span>
    <span class="legend__label">${row.label}</span>
    <span class="legend__value">${total ? Math.round((row.value / total) * 100) : 0}%</span>
  </div>`).join('');

  const canvas = document.getElementById('risk-chart');
  if (!hasCharts()) {
    const wrap = canvas?.parentElement;
    if (wrap) {
      wrap.innerHTML = total
        ? `<p class="text-sm text-muted">Low ${low} · Moderate ${medium} · High ${high} of ${total} students.</p>`
        : emptyStateHtml({ title: 'No predictions yet', message: 'Run assessments to generate support signals.', iconName: 'shield' });
    }
    return;
  }

  if (total === 0) {
    const wrap = canvas?.parentElement;
    if (wrap) {
      wrap.innerHTML = emptyStateHtml({
        title: 'No predictions yet',
        message: 'Run assessments to generate support signals.',
        iconName: 'shield'
      });
    }
    return;
  }

  doughnutChart(canvas, {
    labels: rows.map((r) => r.label),
    values: rows.map((r) => r.value),
    colors: rows.map((r) => r.color)
  });
}

function renderStatRow(distribution) {
  const wrap = document.getElementById('risk-stat-row');
  const low = Number(distribution.low) || 0;
  const medium = Number(distribution.medium) || 0;
  const high = Number(distribution.high) || 0;

  wrap.innerHTML = `
    <div class="risk-stat risk-stat--low">
      <div class="risk-stat__value">${formatNumber(low)}</div>
      <div class="risk-stat__label">Low signal</div>
    </div>
    <div class="risk-stat risk-stat--medium">
      <div class="risk-stat__value">${formatNumber(medium)}</div>
      <div class="risk-stat__label">Moderate signal</div>
    </div>
    <div class="risk-stat risk-stat--high">
      <div class="risk-stat__value">${formatNumber(high)}</div>
      <div class="risk-stat__label">High signal</div>
    </div>`;
}

function renderAtRisk(students, distribution) {
  const countBadge = document.getElementById('at-risk-count');
  countBadge.textContent = `${formatNumber(students.length)} student${students.length === 1 ? '' : 's'} with a medium or high signal`;

  if (!students || !students.length) {
    document.getElementById('at-risk-list').innerHTML = emptyStateHtml({
      title: 'No students currently at risk',
      message: 'That is encouraging, not a guarantee. Re-check after the next round of assessments.',
      iconName: 'shield-check'
    });
    return;
  }

  const sorted = [...students].sort((a, b) => {
    const la = LEVEL_ORDER[a.risk_level] ?? 3;
    const lb = LEVEL_ORDER[b.risk_level] ?? 3;
    if (la !== lb) return la - lb;
    return Number(b.risk_score || 0) - Number(a.risk_score || 0);
  });

  document.getElementById('at-risk-list').innerHTML = `<div class="table-wrap">
    <table class="data-table">
      <caption class="sr-only">Students with medium or high support signals</caption>
      <thead>
        <tr>
          <th scope="col">Student</th>
          <th scope="col">Enrolment</th>
          <th scope="col">Course</th>
          <th scope="col">Estimate</th>
          <th scope="col">Signal</th>
          <th scope="col">Level</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((student) => {
          const meta = riskMeta(student.risk_level);
          return `<tr class="${student.risk_level === 'high' ? 'risk-card--high' : student.risk_level === 'medium' ? 'risk-card--medium' : ''}">
            <td>
              <div class="user-cell">
                <span class="avatar">${escapeHtml(initials(student.full_name))}</span>
                <span style="min-width:0">
                  <span class="user-cell__name truncate">${escapeHtml(student.full_name)}</span>
                  <span class="user-cell__meta truncate">${escapeHtml(student.email || '')}</span>
                </span>
              </div>
            </td>
            <td class="font-mono nowrap">${escapeHtml(student.enrollment_no)}</td>
            <td class="truncate">${escapeHtml(student.course || '')}</td>
            <td class="font-mono">${student.predicted_marks == null ? '--' : formatNumber(student.predicted_marks, 1)}</td>
            <td class="font-mono">${student.risk_score == null ? '--' : formatNumber(student.risk_score, 1)}</td>
            <td>${metaBadge(student.risk_level)}</td>
            <td class="table-actions">
              <a class="icon-btn" style="width:34px;height:34px" href="/pages/reports.html?student=${encodeURIComponent(student.student_id)}" aria-label="Open report for ${escapeHtml(student.full_name)}" title="Report">${icon('file')}</a>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;

  document.querySelectorAll('[data-level]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const level = tab.dataset.level;
      document.querySelectorAll('[data-level]').forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-pressed', String(active));
      });
      const filtered = level === 'all'
        ? sorted
        : sorted.filter((s) => s.risk_level === level);
      document.getElementById('at-risk-list').innerHTML = renderTableBody(filtered);
    });
  });
}

function metaBadge(level) {
  const meta = riskMeta(level);
  return `<span class="badge risk-badge ${meta.className}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>`;
}

function renderTableBody(filtered) {
  if (!filtered.length) return emptyStateHtml({ title: 'No students at this level', message: 'Try a different filter.', iconName: 'shield' });
  return `<div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Student</th>
          <th scope="col">Enrolment</th>
          <th scope="col">Course</th>
          <th scope="col">Estimate</th>
          <th scope="col">Signal</th>
          <th scope="col">Level</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((student) => {
          const meta = riskMeta(student.risk_level);
          return `<tr class="${student.risk_level === 'high' ? 'risk-card--high' : student.risk_level === 'medium' ? 'risk-card--medium' : ''}">
            <td>
              <div class="user-cell">
                <span class="avatar">${escapeHtml(initials(student.full_name))}</span>
                <span style="min-width:0">
                  <span class="user-cell__name truncate">${escapeHtml(student.full_name)}</span>
                  <span class="user-cell__meta truncate">${escapeHtml(student.email || '')}</span>
                </span>
              </div>
            </td>
            <td class="font-mono nowrap">${escapeHtml(student.enrollment_no)}</td>
            <td class="truncate">${escapeHtml(student.course || '')}</td>
            <td class="font-mono">${student.predicted_marks == null ? '--' : formatNumber(student.predicted_marks, 1)}</td>
            <td class="font-mono">${student.risk_score == null ? '--' : formatNumber(student.risk_score, 1)}</td>
            <td>${metaBadge(student.risk_level)}</td>
            <td class="table-actions">
              <a class="icon-btn" style="width:34px;height:34px" href="/pages/reports.html?student=${encodeURIComponent(student.student_id)}" aria-label="Open report for ${escapeHtml(student.full_name)}" title="Report">${icon('file')}</a>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

async function boot() {
  const user = await initShell({
    pageKey: 'risk',
    title: 'Risk analysis',
    eyebrow: 'Admin workspace',
    roles: ['admin']
  });
  if (!user) return;

  try {
    await load();
  } catch (err) {
    document.getElementById('risk-stat-row').innerHTML = errorStateHtml(errorMessage(err), 'risk-retry');
    const retry = document.getElementById('risk-retry');
    if (retry) retry.addEventListener('click', () => window.location.reload());
    document.getElementById('at-risk-list').innerHTML = errorStateHtml(errorMessage(err), 'atrisk-retry');
    const retry2 = document.getElementById('atrisk-retry');
    if (retry2) retry2.addEventListener('click', () => window.location.reload());
  }
}

boot();
