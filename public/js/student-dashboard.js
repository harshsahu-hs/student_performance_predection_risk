import { initShell } from './shell.js';
import { get, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskMeta, riskBadge,
  categoryBadge, priorityBadge, emptyStateHtml, errorStateHtml, animateCounter, toast
} from './ui.js';
import { lineChart, hasCharts } from './charts.js';
import { initRingGauge } from './three-scenes.js';

const profileHero = document.getElementById('profile-hero');
const statsGrid = document.getElementById('student-stats');
const content = document.getElementById('student-content');

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function renderProfile(student) {
  const section = student.section ? ` · Section ${escapeHtml(student.section)}` : '';
  profileHero.innerHTML = `
    <div class="profile-hero__main">
      <span class="avatar avatar--lg">${escapeHtml(initials(student.full_name))}</span>
      <div>
        <h2>${escapeHtml(student.full_name)}</h2>
        <p class="profile-hero__meta">
          <span>${icon('cap')} ${escapeHtml(student.course)} · Semester ${escapeHtml(student.semester)}${section}</span>
          <span>${icon('file')} ${escapeHtml(student.enrollment_no)}</span>
          <span>${icon('mail')} ${escapeHtml(student.email)}</span>
        </p>
      </div>
    </div>
    <div class="profile-hero__side">
      <div class="profile-mini">
        <span class="profile-mini__label">Latest estimate</span>
        <span class="profile-mini__value">${student.predicted_marks == null ? '--' : `${formatNumber(student.predicted_marks, 1)}`}</span>
      </div>
      <div class="profile-mini">
        <span class="profile-mini__label">Assessments</span>
        <span class="profile-mini__value">${formatNumber(student.stats?.assessment_count)}</span>
      </div>
      <div class="profile-mini">
        <span class="profile-mini__label">Current signal</span>
        <span class="profile-mini__value" style="font-size:14px;margin-top:3px">${student.risk_level ? riskBadge(student.risk_level) : '<span class="badge">Not assessed</span>'}</span>
      </div>
    </div>`;
}

function renderStats(student, latest) {
  const cards = [
    {
      label: 'Latest estimate',
      value: latest ? latest.predicted_marks : null,
      digits: 1,
      icon: 'gauge',
      foot: latest ? `Recorded ${formatDate(latest.assessment_date)}` : 'No prediction yet',
      cls: ''
    },
    {
      label: 'Average estimate',
      value: student.stats?.average_predicted_marks ?? null,
      digits: 1,
      icon: 'trend',
      foot: `${formatNumber(student.stats?.prediction_count)} predictions saved`,
      cls: 'stat-card__icon--success'
    },
    {
      label: 'Assessments',
      value: student.stats?.assessment_count ?? 0,
      digits: 0,
      icon: 'clipboard',
      foot: 'Records staff have added for you',
      cls: ''
    },
    {
      label: 'Current signal',
      value: null,
      icon: 'shield',
      foot: latest ? riskMeta(latest.risk_level).description : 'No current assessment',
      cls: latest && latest.risk_level === 'high'
        ? 'stat-card__icon--danger'
        : latest && latest.risk_level === 'medium' ? 'stat-card__icon--warn' : 'stat-card__icon--success'
    }
  ];

  statsGrid.innerHTML = cards.map((card) => `<article class="card stat-card" data-tilt>
    <div class="stat-card__top">
      <span class="stat-card__label">${escapeHtml(card.label)}</span>
      <span class="stat-card__icon ${card.cls}">${icon(card.icon)}</span>
    </div>
    <div class="stat-card__value">${card.value == null ? '--' : `<span data-count="${Number(card.value)}" data-digits="${card.digits}">0</span>`}</div>
    <div class="stat-card__foot">${card.label === 'Current signal' && latest ? riskBadge(latest.risk_level) : escapeHtml(card.foot)}</div>
  </article>`).join('');

  statsGrid.querySelectorAll('[data-count]').forEach((el) => {
    animateCounter(el, Number(el.dataset.count), { digits: Number(el.dataset.digits) });
  });
}

function rulesHtml(rules) {
  if (!rules || !rules.length) {
    return `<div class="alert alert--success">
      ${icon('check-circle')}
      <div><strong>No early-warning thresholds were crossed in this assessment.</strong><br>
      That is encouraging, but it is not a guarantee. Keep the routines that are working and revisit after the next assessment.</div>
    </div>`;
  }
  return `<div class="rules-list">
    ${rules.map((rule) => {
      const severity = ['high', 'medium', 'low'].includes(rule.severity) ? rule.severity : 'low';
      const value = Number(rule.value);
      const threshold = Number(rule.threshold);
      return `<div class="rule-item rule-item--${severity}">
        <span class="rule-item__dot" aria-hidden="true"></span>
        <div>
          <div class="rule-item__title">${escapeHtml(rule.label || rule.code)}</div>
          <div class="rule-item__meta">
            ${escapeHtml(rule.area || 'Support')} ·
            ${Number.isFinite(value) ? `current ${formatNumber(value, 1)}` : 'current value'} ·
            ${Number.isFinite(threshold) ? `threshold ${formatNumber(threshold, 1)}` : 'rule threshold'}
          </div>
          ${rule.explanation ? `<p class="text-sm text-muted" style="margin-top:5px">${escapeHtml(rule.explanation)}</p>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function recommendationsHtml(recs) {
  if (!recs || !recs.length) {
    return emptyStateHtml({
      title: 'No suggestions attached',
      message: 'Your next assessment will generate a fresh support plan.',
      iconName: 'lightbulb'
    });
  }
  return `<div class="rec-grid">
    ${recs.map((rec) => `<article class="rec-card">
      <div class="rec-card__head">
        <span class="rec-card__area">${escapeHtml(rec.area)}</span>
        ${priorityBadge(rec.priority)}
      </div>
      <p>${escapeHtml(rec.recommendation_text)}</p>
    </article>`).join('')}
  </div>`;
}

function renderLatest(latest, progress) {
  const isMock = Boolean(latest.is_mock);
  const marks = formatNumber(latest.predicted_marks, 1);
  const risk = riskMeta(latest.risk_level);
  const gaugeColor = latest.risk_level === 'high'
    ? css('--danger', '#fb7185')
    : latest.risk_level === 'medium' ? css('--warning', '#fbbf24') : css('--success', '#34d399');

  const withPrediction = (progress || []).filter((row) => row.predicted_marks != null);
  const trendValues = withPrediction.map((row) => Number(row.predicted_marks));
  const trendLabels = withPrediction.map((row) => formatDate(row.assessment_date, { day: 'numeric', month: 'short' }));

  content.innerHTML = `
    ${isMock ? `<div class="alert alert--danger mb-4" role="alert">${icon('alert')}<div><strong>MOCK - not real model output.</strong> The Python service is running a development stub. Do not use this result for any decision.</div></div>` : ''}

    <div class="dashboard-grid">
      <section class="panel span-8" data-reveal>
        <div class="panel__header">
          <div>
            <h2 class="panel__title">Your current estimate</h2>
            <p class="panel__subtitle">Assessment dated ${formatDate(latest.assessment_date)} · saved ${formatDate(latest.created_at)}</p>
          </div>
          <span class="model-badge" title="Prototype model trained on public UCI data"><span class="badge-dot"></span> UCI prototype</span>
        </div>
        <div class="panel__body">
          <div class="prediction-hero">
            <div class="prediction-hero__main">
              <span class="metric-card__label">Predicted marks</span>
              <div class="prediction-hero__marks">${marks}<small>/100</small></div>
              <div class="prediction-hero__badges">
                ${categoryBadge(latest.performance_category)}
                ${riskBadge(latest.risk_level)}
                <span class="badge">${escapeHtml(latest.model_used || 'Model unknown')}</span>
              </div>
              <p class="text-sm text-soft" style="line-height:1.65">${escapeHtml(latest.explanation || '')}</p>
              <div class="prediction-hero__meta">
                <span>${icon('calendar')} ${formatDate(latest.assessment_date)}</span>
                <span>${icon('activity')} Support signal ${formatNumber(latest.risk_score, 1)}/100</span>
                <span>${icon('book')} ${escapeHtml(risk.description)}</span>
              </div>
            </div>
            <div class="prediction-hero__side" style="display:flex;flex-direction:column;justify-content:center;gap:10px">
              <div class="metric-card card card--solid">
                <span class="metric-card__label">Attendance</span>
                <span class="metric-card__value">${formatNumber(latest.attendance, 1)}<small>%</small></span>
                <span class="metric-card__note">Recorded for this assessment</span>
              </div>
              <div class="metric-card card card--solid">
                <span class="metric-card__label">Internal marks</span>
                <span class="metric-card__value">${formatNumber(latest.internal_marks, 1)}<small>/100</small></span>
                <span class="metric-card__note">Current internal assessment</span>
              </div>
            </div>
          </div>
          <p class="disclaimer-note mt-4">${icon('info')}<span>This is an estimate from a prototype model, not a guarantee. Accuracy for university students has not yet been validated.</span></p>
        </div>
      </section>

      <section class="panel span-4" data-reveal>
        <div class="panel__header">
          <div>
            <h2 class="panel__title">Estimate at a glance</h2>
            <p class="panel__subtitle">Out of 100 · higher is stronger</p>
          </div>
        </div>
        <div class="panel__body" style="padding-top:0">
          <div class="scene-stage scene-stage--sm" id="student-gauge">
            <div class="scene-overlay">
              <span class="scene-overlay__label">Predicted marks</span>
              <span class="scene-overlay__value">${marks}</span>
              <span class="scene-overlay__sub">${escapeHtml(latest.performance_category || 'Estimate')}</span>
            </div>
          </div>
          <div class="detail-list mt-3">
            <div class="detail-row"><span class="detail-row__label">Study hours / week</span><span class="detail-row__value font-mono">${formatNumber(latest.study_hours, 1)} h</span></div>
            <div class="detail-row"><span class="detail-row__label">Previous marks</span><span class="detail-row__value font-mono">${formatNumber(latest.previous_marks, 1)}/100</span></div>
            <div class="detail-row"><span class="detail-row__label">Assignment completion</span><span class="detail-row__value font-mono">${formatNumber(latest.assignment_completion, 1)}%</span></div>
            <div class="detail-row"><span class="detail-row__label">Participation</span><span class="detail-row__value font-mono">${formatNumber(latest.participation, 1)}%</span></div>
          </div>
        </div>
      </section>

      <section class="panel span-6" data-reveal>
        <div class="panel__header">
          <div>
            <h2 class="panel__title">What shaped the signal</h2>
            <p class="panel__subtitle">Transparent rules, not a hidden score</p>
          </div>
          <span class="badge badge--accent">${latest.triggered_rules?.length || 0} triggered</span>
        </div>
        <div class="panel__body">
          ${rulesHtml(latest.triggered_rules)}
        </div>
      </section>

      <section class="panel span-6" data-reveal>
        <div class="panel__header">
          <div>
            <h2 class="panel__title">Suggested next steps</h2>
            <p class="panel__subtitle">Small, realistic actions to discuss with staff</p>
          </div>
        </div>
        <div class="panel__body">
          ${recommendationsHtml(latest.recommendations)}
        </div>
      </section>

      <section class="panel span-7" data-reveal>
        <div class="panel__header">
          <div>
            <h2 class="panel__title">Estimate history</h2>
            <p class="panel__subtitle">${withPrediction.length} saved prediction${withPrediction.length === 1 ? '' : 's'}</p>
          </div>
          <span class="badge">Marks / 100</span>
        </div>
        <div class="panel__body">
          <div class="chart-box chart-box--tall" id="student-trend-wrap">
            <canvas id="student-trend" role="img" aria-label="Predicted marks across your assessments"></canvas>
          </div>
          <p class="text-xs text-muted mt-3">${withPrediction.length < 2
            ? 'A second assessment will make the trend easier to read. One estimate is a snapshot, not a direction.'
            : 'Estimates move with the inputs recorded for each assessment. A single change does not establish a trend.'}</p>
        </div>
      </section>

      <section class="panel span-5" data-reveal>
        <div class="panel__header">
          <div>
            <h2 class="panel__title">Assessment timeline</h2>
            <p class="panel__subtitle">Most recent first</p>
          </div>
        </div>
        <div class="panel__body">
          ${timelineHtml(progress)}
        </div>
      </section>
    </div>`;

  const gaugeStage = document.getElementById('student-gauge');
  if (gaugeStage) {
    initRingGauge(gaugeStage, {
      value: Number(latest.predicted_marks) || 0,
      color: gaugeColor,
      secondary: Number(latest.attendance) || 0,
      secondaryColor: css('--accent-2', '#22d3ee')
    }).catch(() => gaugeStage.classList.add('scene-stage--fallback'));
  }

  if (hasCharts() && trendValues.length) {
    lineChart(document.getElementById('student-trend'), {
      labels: trendLabels,
      values: trendValues,
      label: 'Predicted marks'
    });
  } else if (!hasCharts()) {
    const wrap = document.getElementById('student-trend-wrap');
    if (wrap) {
      wrap.innerHTML = `<p class="text-sm text-muted">Chart library unavailable. Saved estimates: ${withPrediction.map((row) => `${formatDate(row.assessment_date)} ${formatNumber(row.predicted_marks, 1)}`).join(' · ')}</p>`;
    }
  }
}

function timelineHtml(progress) {
  const rows = [...(progress || [])].reverse();
  if (!rows.length) {
    return emptyStateHtml({
      title: 'No assessments yet',
      message: 'Your assessment timeline will appear here once staff record your first check-in.',
      iconName: 'calendar'
    });
  }
  return `<div class="timeline">
    ${rows.slice(0, 12).map((row) => {
      const level = row.risk_level || 'unknown';
      const dotClass = ['high', 'medium', 'low'].includes(level) ? `timeline-item__dot--${level}` : '';
      return `<div class="timeline-item">
        <span class="timeline-item__dot ${dotClass}" aria-hidden="true"></span>
        <div class="timeline-item__body">
          <div class="timeline-item__head">
            <span class="timeline-item__title">${formatDate(row.assessment_date)}</span>
            ${row.risk_level ? riskBadge(row.risk_level) : '<span class="badge">Pending</span>'}
          </div>
          <div class="timeline-item__meta">${row.predicted_marks == null
            ? 'Assessment recorded — prediction pending'
            : `Estimate ${formatNumber(row.predicted_marks, 1)}/100 · ${escapeHtml(row.performance_category || '')}`}</div>
          <div class="timeline-item__metrics">
            <span class="timeline-item__metric">Attendance <strong>${formatNumber(row.attendance, 1)}%</strong></span>
            <span class="timeline-item__metric">Internal <strong>${formatNumber(row.internal_marks, 1)}</strong></span>
            <span class="timeline-item__metric">Study <strong>${formatNumber(row.study_hours, 1)} h</strong></span>
            <span class="timeline-item__metric">Previous <strong>${formatNumber(row.previous_marks, 1)}</strong></span>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderEmpty(progress) {
  const pending = (progress || []).filter((row) => row.predicted_marks == null);
  content.innerHTML = `<section class="panel" data-reveal>
    <div class="panel__body">
      ${emptyStateHtml({
        title: 'No estimate yet',
        message: 'When staff record your first assessment, an estimate and a support plan will appear here. You will see the inputs that were used and the rules that fired.',
        iconName: 'sparkles'
      })}
      ${pending.length ? `<div class="alert alert--info mt-4">${icon('info')}<div>You have ${pending.length} assessment${pending.length === 1 ? '' : 's'} recorded. The prediction has not been generated yet.</div></div>` : ''}
    </div>
  </section>`;
  toast('No predictions yet. Your first assessment will appear here.', 'info');
}

function showError(message) {
  content.innerHTML = errorStateHtml(message, 'student-retry');
  const button = document.getElementById('student-retry');
  if (button) button.addEventListener('click', () => window.location.reload());
}

async function load() {
  const studentResponse = await get('/api/students/me');
  const student = studentResponse.student;
  const stats = studentResponse.stats;
  const studentId = student.student_id;

  renderProfile({ ...student, stats });

  const [predictionsResult, progressResult] = await Promise.allSettled([
    get(`/api/students/${studentId}/predictions`),
    get(`/api/students/${studentId}/progress`)
  ]);

  if (predictionsResult.status !== 'fulfilled') {
    throw predictionsResult.reason;
  }

  const predictions = predictionsResult.value.predictions || [];
  const progress = progressResult.status === 'fulfilled' ? (progressResult.value.progress || []) : [];
  const latest = predictions[0] || null;

  renderStats({ ...student, stats }, latest);

  if (!latest) {
    renderEmpty(progress);
    return;
  }
  renderLatest(latest, progress);
}

async function boot() {
  const user = await initShell({
    pageKey: 'overview',
    title: 'My dashboard',
    eyebrow: 'Student workspace',
    roles: ['student']
  });
  if (!user) return;
  if (!user.student) {
    showError('This account has no student profile. Please contact an administrator.');
    return;
  }

  try {
    await load();
  } catch (err) {
    showError(errorMessage(err));
  }
}

boot();
