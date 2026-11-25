import { initShell } from './shell.js';
import { get, post, put, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskBadge,
  emptyStateHtml, errorStateHtml, toast, setBusy, showFormErrors,
  clearFormErrors, formToObject, debounce, animateCounter
} from './ui.js';
import { initRingGauge } from './three-scenes.js';

const FORM_WRAP = document.getElementById('assessment-form-wrap');
const SUBTITLE = document.getElementById('form-subtitle');
const BADGE = document.getElementById('metadata-badge');
const RESULT_PANEL = document.getElementById('result-panel');
const RESULT_STATE = document.getElementById('result-state');
const RESULT_BODY = document.getElementById('result-body');
const RECENT_COUNT = document.getElementById('recent-count');
const RECENT_LIST = document.getElementById('recent-assessments');

let modelMetadata = null;
let selectedAssessmentId = null;
let formSubmitSequence = 0;

/* --------------------------------------------------------------------------
   Form builder from model metadata
   -------------------------------------------------------------------------- */
function buildInput(field, value = '') {
  const key = field.key;
  const label = field.label || key;
  const min = Number.isFinite(field.min) ? field.min : 0;
  const max = Number.isFinite(field.max) ? field.max : 100;
  const step = Number.isFinite(field.step) ? field.step : 0.1;
  const unit = field.unit || '';
  const help = field.help || '';

  return `<div class="field feature-field">
    <label class="field__label">${escapeHtml(label)} <span class="text-xs text-muted" style="font-weight:500">(${escapeHtml(unit)})</span></label>
    <input class="input" type="number" name="${escapeHtml(key)}" min="${min}" max="${max}" step="${step}"
      value="${escapeHtml(String(value))}" required autocomplete="off">
    <span class="field__error" data-error-for="${escapeHtml(key.split('.').pop())}"></span>
    <div class="field__hint">${escapeHtml(help)} Min ${min} · max ${max}.</div>
  </div>`;
}

function renderForm(fields, selectedStudentId, today) {
  if (!fields || !fields.length) {
    FORM_WRAP.innerHTML = errorStateHtml('The model did not return any input fields.', 'form-load-retry');
    const button = document.getElementById('form-load-retry');
    if (button) button.addEventListener('click', loadMetadata);
    return;
  }

  const recordedFields = [
    { key: 'assignment_completion', label: 'Assignment completion', unit: '%', min: 0, max: 100, step: 1, help: 'Share of coursework completed. Used by the risk rules, not the model.' },
    { key: 'participation', label: 'Participation', unit: '%', min: 0, max: 100, step: 1, help: 'Class participation share. Used by the risk rules, not the model.' }
  ];

  const modelInputs = fields.map((field) => buildInput(field)).join('');
  const recordedInputs = recordedFields.map(buildInput).join('');

  const studentOptions = [...window.studentOptions || []].map((student) => {
    const active = student.is_active ? '' : ' (inactive)';
    return `<option value="${student.student_id}">${escapeHtml(student.full_name)} (${escapeHtml(student.enrollment_no)})${active}</option>`;
  }).join('');

  const assessmentDate = today || new Date().toISOString().slice(0, 10);

  FORM_WRAP.innerHTML = `
    <form id="prediction-form" novalidate>
      <div class="alert alert--info mb-4">
        ${icon('info')}
        <div>
          <strong>Four inputs drive the estimate.</strong> The model predicts marks from ${fields.map((f) => escapeHtml(f.label)).join(', ')}.
          ${escapeHtml(modelMetadata && modelMetadata.dataset ? `Training data: ${escapeHtml(modelMetadata.dataset.name)}.` : '')}
        </div>
      </div>

      <div class="form-grid">
        <div class="field field--full">
          <label class="field__label">Student <span class="text-danger">*</span></label>
          <select class="select" id="sf-student" name="student_id" required>
            <option value="">Select a student</option>
            ${studentOptions}
          </select>
          <span class="field__error" data-error-for="student_id"></span>
        </div>
        <div class="field">
          <label class="field__label">Assessment date</label>
          <input class="input" id="sf-date" name="assessment_date" type="date" value="${escapeHtml(assessmentDate)}" required>
          <span class="field__error" data-error-for="assessment_date"></span>
        </div>
        ${modelInputs}
      </div>

      <div class="recorded-fields" aria-labelledby="recorded-label">
        <div class="recorded-fields__head" role="group" aria-labelledby="recorded-label">
          <span id="recorded-label" class="sr-only">Recorded inputs</span>
          ${icon('sliders')}
          <div>
            <strong>Also recorded (risk rules only)</strong>
            <p class="text-xs text-muted" style="margin-top:4px">Assignment completion and participation are saved but are not sent to the model. They feed the transparent risk rules below.</p>
          </div>
        </div>
        <div class="form-grid">
          ${recordedInputs}
        </div>
      </div>

      <button class="btn btn--primary btn--block btn--lg mt-5" type="submit" id="run-predict">
        Run prediction and save assessment
      </button>
      <p class="auth-card__meta mt-4" style="color:var(--muted);font-size:11px">Assessment and prediction are saved together in one transaction. If the model service is unavailable nothing is written.</p>
    </form>`;

  document.getElementById('sf-student').value = String(selectedStudentId || '');
  document.getElementById('prediction-form').addEventListener('submit', onPredictSubmit);
}

async function loadMetadata() {
  FORM_WRAP.innerHTML = '<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading model fields…</div>';
  SUBTITLE.textContent = 'Loading model metadata…';
  try {
    const data = await get('/api/ml/metadata');
    modelMetadata = data.metadata;
    const fields = modelMetadata.features;
    SUBTITLE.textContent = `${fields.length} model input${fields.length === 1 ? '' : 's'} plus two recorded inputs.`;
    if (BADGE) BADGE.title = modelMetadata.disclaimer || 'Prototype model trained on public UCI data';
    renderForm(fields, null, new Date().toISOString().slice(0, 10));
    await loadStudentsForDropdown();
  } catch (err) {
    SUBTITLE.textContent = 'Metadata unavailable.';
    FORM_WRAP.innerHTML = errorStateHtml(errorMessage(err), 'form-load-retry');
    const button = document.getElementById('form-load-retry');
    if (button) button.addEventListener('click', loadMetadata);
  }
}

async function loadStudentsForDropdown() {
  try {
    const data = await get('/api/students', { query: { page: 1, page_size: 200, status: 'active' } });
    window.studentOptions = data.students || [];
    renderForm(modelMetadata.features, null, new Date().toISOString().slice(0, 10));
  } catch (err) {
    // Non-fatal; the student selector will be empty until it works.
  }
}

/* --------------------------------------------------------------------------
   Prediction submit
   -------------------------------------------------------------------------- */
async function onPredictSubmit(event) {
  event.preventDefault();
  clearFormErrors(document.getElementById('prediction-form'));
  const sequence = ++formSubmitSequence;
  const form = event.target;

  const raw = formToObject(form);
  const payload = {
    student_id: Number(raw.student_id),
    attendance: Number(raw.attendance),
    internal_marks: Number(raw.internal_marks),
    study_hours: Number(raw.study_hours),
    assignment_completion: Number(raw.assignment_completion),
    participation: Number(raw.participation),
    previous_marks: Number(raw.previous_marks),
    assessment_date: raw.assessment_date
  };

  const errors = [];
  if (!payload.student_id || !Number.isFinite(payload.student_id)) errors.push({ field: 'student_id', message: 'Select a student.' });
  if (payload.attendance < 0 || payload.attendance > 100) errors.push({ field: 'attendance', message: 'Attendance must be between 0 and 100.' });
  if (payload.internal_marks < 0 || payload.internal_marks > 100) errors.push({ field: 'internal_marks', message: 'Internal marks must be between 0 and 100.' });
  if (payload.study_hours < 0 || payload.study_hours > 168) errors.push({ field: 'study_hours', message: 'Study hours must be between 0 and 168.' });
  if (payload.assignment_completion < 0 || payload.assignment_completion > 100) errors.push({ field: 'assignment_completion', message: 'Assignment completion must be between 0 and 100.' });
  if (payload.participation < 0 || payload.participation > 100) errors.push({ field: 'participation', message: 'Participation must be between 0 and 100.' });
  if (payload.previous_marks < 0 || payload.previous_marks > 100) errors.push({ field: 'previous_marks', message: 'Previous marks must be between 0 and 100.' });
  if (errors.length) {
    showFormErrors(form, errors);
    return;
  }

  const button = document.getElementById('run-predict');
  setBusy(button, true);
  RESULT_STATE.textContent = 'Running…';
  RESULT_STATE.className = 'badge';
  RESULT_BODY.innerHTML = '<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Calling model…</div>';

  try {
    const result = await post('/api/predict', payload);
    if (sequence !== formSubmitSequence) return;

    const { assessment, prediction, risk, recommendations, model, student, mock_warning, disclaimer } = result;
    selectedAssessmentId = assessment.assessment_id;

    const level = risk.level || 'low';
    const metaBadge = riskBadge(level);
    const classMap = { high: 'stat-card__icon--danger', medium: 'stat-card__icon--warn', low: 'stat-card__icon--success' };
    const color = level === 'high' ? 'var(--danger)' : level === 'medium' ? 'var(--warning)' : 'var(--success)';

    RESULT_STATE.textContent = (level.charAt(0).toUpperCase() + level.slice(1)) + ' signal';
    RESULT_STATE.className = `badge risk-badge--${level}`;
    RESULT_STATE.style.color = color;

    RESULT_BODY.innerHTML = `
      <div class="result-summary">
        <div>
          <span class="metric-card__label">Predicted marks</span>
          <div class="result-number">${formatNumber(prediction.predicted_marks, 1)}<small>/100</small></div>
          <div class="text-xs text-muted mt-1">${escapeHtml(prediction.performance_category || 'Estimate')} · ${escapeHtml(model.name || 'Model')}</div>
        </div>
        <div class="result-badges">
          ${metaBadge}
          ${classMap[level] ? `<span class="badge" style="color:${color};border-color:var(--border-strong)">Risk ${formatNumber(risk.score, 1)}/100</span>` : ''}
          <span class="badge">${mock_warning ? 'MOCK - not real' : 'Live model'}</span>
        </div>
      </div>

      <div class="panel__footer mt-4">
        <p class="disclaimer-note mt-2">${icon('info')}<span>${escapeHtml(disclaimer || 'Predictions are estimates, not guarantees.')}</span></p>
        ${mock_warning ? `<p class="disclaimer-note mt-2 text-danger">${icon('alert')}<strong>${escapeHtml(mock_warning)}</strong></p>` : ''}
      </div>

      <div class="detail-list mt-4">
        <div class="detail-row"><span class="detail-row__label">Risk score</span><span class="detail-row__value font-mono">${formatNumber(risk.score, 1)}</span></div>
        <div class="detail-row"><span class="detail-row__label">Explanation</span><span class="detail-row__value">${escapeHtml(risk.explanation || 'No explanation stored.')}</span></div>
      </div>

      <h3 class="panel__title" style="font-size:14px;margin:16px 0 8px">Triggered rules</h3>
      ${risk.rules && risk.rules.length
        ? `<div class="rules-list">
           ${risk.rules.map((rule) => `<div class="rule-item rule-item--${rule.severity || 'low'}">
             <span class="rule-item__dot" aria-hidden="true"></span>
             <div><div class="rule-item__title">${escapeHtml(rule.label)}</div><div class="rule-item__meta">${escapeHtml(rule.explanation || '')}</div></div></div>`).join('')}
         </div>`
        : `<div class="alert alert--success">${icon('check-circle')}<div><strong>No early-warning thresholds were crossed.</strong></div></div>`}

      <h3 class="panel__title" style="font-size:14px;margin:16px 0 8px">Recommendations</h3>
      ${recommendations && recommendations.length
        ? `<div class="rec-grid">
           ${recommendations.map((rec) => `<article class="rec-card">
             <div class="rec-card__head"><span class="rec-card__area">${escapeHtml(rec.area)}</span>${priorityBadge(rec.priority)}</div>
             <p>${escapeHtml(rec.recommendation_text)}</p>
           </article>`).join('')}
         </div>`
        : emptyStateHtml({ title: 'No recommendations', message: 'Keep current routines consistent.', iconName: 'lightbulb' })}

      <div class="mt-5">
        <button class="btn btn--secondary btn--sm" type="button" id="view-report">Open report</button>
        <button class="btn btn--ghost btn--sm" type="button" id="run-again">Run another</button>
      </div>`;

    RESULT_BODY.querySelector('#view-report')?.addEventListener('click', () => {
      window.location.href = `/pages/reports.html?student=${encodeURIComponent(student.student_id)}`;
    });
    RESULT_BODY.querySelector('#run-again')?.addEventListener('click', () => {
      RESULT_STATE.textContent = 'Waiting';
      RESULT_STATE.className = 'badge';
      RESULT_BODY.innerHTML = '<div class="result-empty"><div class="result-empty__orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 4A3.5 3.5 0 0 0 6 7.5c-1.7.5-3 2-3 3.9 0 1.4.7 2.6 1.8 3.3A3.5 3.5 0 0 0 8 20a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 9.5 4Z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5c1.7.5 3 2 3 3.9 0 1.4-.7 2.6-1.8 3.3A3.5 3.5 0 0 1 16 20a3.5 3.5 0 0 1-3.5-3.5v-9A3.5 3.5 0 0 0 14.5 4Z"/></svg></div><h3>No prediction in this session</h3><p>Run another assessment to generate a new estimate.</p></div>';
      selectedAssessmentId = null;
    });

    toast(`Prediction saved: ${formatNumber(prediction.predicted_marks, 1)}/100 · ${level} signal.`, 'success');
    await loadRecentAssessments();
  } catch (err) {
    if (sequence !== formSubmitSequence) return;
    setBusy(button, false);
    RESULT_STATE.textContent = 'Failed';
    RESULT_STATE.className = 'badge risk-badge--high';
    const details = Array.isArray(err.details) ? err.details : null;
    if (details && details.length) showFormErrors(form, details);
    RESULT_BODY.innerHTML = errorStateHtml(errorMessage(err), 'predict-retry');
    const retry = document.getElementById('predict-retry');
    if (retry) retry.addEventListener('click', () => form.requestSubmit());
    toast(errorMessage(err), 'error');
  } finally {
    if (sequence === formSubmitSequence) setBusy(button, false);
  }
}

function priorityBadge(priority) {
  const map = { high: 'badge--danger', medium: 'badge--warning', low: 'badge--success' };
  return `<span class="badge ${map[priority] || ''}">${escapeHtml(priority || 'info')} priority</span>`;
}

/* --------------------------------------------------------------------------
   Recent assessments list
   -------------------------------------------------------------------------- */
async function loadRecentAssessments() {
  RECENT_LIST.innerHTML = '<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading…</div>';
  try {
    const data = await get('/api/assessments', { query: { page: 1, page_size: 10 } });
    RECENT_COUNT.textContent = `${formatNumber(data.pagination.total)} recent`;
    renderRecentAssessments(data.assessments);
  } catch (err) {
    RECENT_LIST.innerHTML = errorStateHtml(errorMessage(err), 'recent-retry');
    const retry = document.getElementById('recent-retry');
    if (retry) retry.addEventListener('click', loadRecentAssessments);
  }
}

function renderRecentAssessments(rows) {
  if (!rows || !rows.length) {
    RECENT_LIST.innerHTML = emptyStateHtml({
      title: 'No recent assessments',
      message: 'Run your first assessment and it will appear here.',
      iconName: 'clipboard'
    });
    return;
  }

  RECENT_LIST.innerHTML = `<div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Student</th>
          <th scope="col">Date</th>
          <th scope="col">Estimate</th>
          <th scope="col">Signal</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>
          <td>
            <div class="user-cell">
              <span class="avatar">${escapeHtml(initials(row.full_name || 'Student'))}</span>
              <span>
                <span class="user-cell__name truncate">${escapeHtml(row.full_name || 'Student')}</span>
                <span class="user-cell__meta truncate">${escapeHtml(row.enrollment_no || '')}</span>
              </span>
            </div>
          </td>
          <td class="nowrap font-mono">${formatDate(row.assessment_date)}</td>
          <td>${row.predicted_marks == null
            ? '<span class="badge">Pending</span>'
            : `<span class="cell-strong font-mono">${formatNumber(row.predicted_marks, 1)}</span>`}</td>
          <td>${row.risk_level ? riskBadge(row.risk_level) : '<span class="badge">Not assessed</span>'}</td>
          <td class="table-actions">
            <button class="icon-btn" style="width:34px;height:34px" type="button" data-action="reopen" data-id="${row.assessment_id}" aria-label="Reopen assessment ${row.assessment_id}" title="Reopen">${icon('edit')}</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;

  RECENT_LIST.querySelectorAll('[data-action="reopen"]').forEach((button) => {
    button.addEventListener('click', () => reopenAssessment(Number(button.dataset.id)));
  });
}

async function reopenAssessment(assessmentId) {
  try {
    const data = await get(`/api/assessments/${assessmentId}`);
    const row = data.assessment;
    selectedAssessmentId = row.assessment_id;

    const form = document.getElementById('prediction-form');
    if (!form) {
      await loadMetadata();
      setTimeout(() => fillFormFromAssessment(row), 50);
      return;
    }
    fillFormFromAssessment(row);

    RESULT_STATE.textContent = 'Reopened';
    RESULT_STATE.className = 'badge';
    RESULT_BODY.innerHTML = `<p class="text-xs text-muted">Assessment ${escapeHtml(assessmentId)} reopened. Update inputs and run again to regenerate the prediction.</p>`;
    toast('Assessment reopened. Edit inputs and run prediction again.', 'info');
  } catch (err) {
    toast(errorMessage(err), 'error');
  }
}

function fillFormFromAssessment(row) {
  const form = document.getElementById('prediction-form');
  if (!form) return;
  const map = {
    student_id: row.student_id,
    assessment_date: row.assessment_date,
    attendance: row.attendance,
    internal_marks: row.internal_marks,
    study_hours: row.study_hours,
    assignment_completion: row.assignment_completion,
    participation: row.participation,
    previous_marks: row.previous_marks
  };
  for (const [key, value] of Object.entries(map)) {
    const input = form.elements[key];
    if (input) input.value = value == null ? '' : String(value);
  }
  window.scrollTo({ top: form.offsetTop - 140, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
async function boot() {
  const user = await initShell({
    pageKey: 'assessments',
    title: 'Academic assessment',
    eyebrow: 'Admin workspace',
    roles: ['admin']
  });
  if (!user) return;

  loadMetadata();
  loadRecentAssessments();
}

boot();
