import { initShell } from './shell.js';
import { get, downloadFile, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskBadge, categoryBadge,
  emptyStateHtml, errorStateHtml, toast, openModal, setBusy
} from './ui.js';

const FORM_WRAP = document.getElementById('report-form-wrap');
const SUBTITLE = document.getElementById('report-subtitle');
const PREVIEW = document.getElementById('report-preview');
const QUICK = document.getElementById('quick-reports');
const BREADCRUMB = document.getElementById('report-breadcrumb');

let selectedStudentId = null;

async function load() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselected = urlParams.get('student');

  FORM_WRAP.innerHTML = '<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading students…</div>';

  try {
    const data = await get('/api/students', { query: { page: 1, page_size: 200, status: 'all' } });
    const students = data.students || [];
    renderStudentSelector(students, preselected);
    await loadQuickReports(students);
  } catch (err) {
    FORM_WRAP.innerHTML = errorStateHtml(errorMessage(err), 'students-retry');
    const retry = document.getElementById('students-retry');
    if (retry) retry.addEventListener('click', () => window.location.reload());
  }
}

function renderStudentSelector(students, preselectedId) {
  if (!students.length) {
    FORM_WRAP.innerHTML = emptyStateHtml({
      title: 'No students available',
      message: 'No student accounts exist yet. Create one in Student management.',
      iconName: 'users',
      actionHtml: '<button class="btn btn--primary btn--sm" type="button" id="goto-students">Go to student management</button>'
    });
    const goto = document.getElementById('goto-students');
    if (goto) goto.addEventListener('click', () => { window.location.href = '/pages/students.html'; });
    return;
  }

  const meOnly = document.body.dataset.role === 'student';
  const options = students.map((s) => {
    const active = s.is_active ? '' : ' (inactive)';
    const selected = s.student_id === preselectedId ? 'selected' : '';
    return `<option value="${s.student_id}" ${selected}>${escapeHtml(s.full_name)} — ${escapeHtml(s.enrollment_no)}${active}</option>`;
  }).join('');

  FORM_WRAP.innerHTML = `
    <form id="report-form" novalidate>
      <div class="field field--full">
        <label class="field__label">Student</label>
        <select class="select" id="sf-student" name="student_id" required ${meOnly ? 'disabled' : ''}>
          <option value="">Select a student</option>
          ${options}
        </select>
        <span class="field__error" data-error-for="student_id"></span>
        ${meOnly ? '<span class="field__hint">Students can only download their own report.</span>' : ''}
      </div>
      <div class="auth-card__meta mt-3" style="color:var(--muted);font-size:11px">
        Students may only download their own report. Administrators may download any student's report.
      </div>
      <button class="btn btn--primary btn--block btn--lg mt-5" type="button" id="preview-report">Preview report</button>
    </form>`;

  const select = document.getElementById('sf-student');
  if (preselectedId) selectedStudentId = Number(preselectedId);
  select.addEventListener('change', () => {
    selectedStudentId = Number(select.value) || null;
    PREVIEW.innerHTML = '<div class="report-preview"><div class="empty-state"><div class="empty-state__icon">' + icon('file') + '</div><h3>No report selected</h3><p>Choose a student to see a preview.</p></div></div>';
  });

  document.getElementById('preview-report').addEventListener('click', async () => {
    if (!selectedStudentId) {
      toast('Select a student first.', 'error');
      return;
    }
    await previewStudent(selectedStudentId);
  });
}

async function previewStudent(studentId) {
  const button = document.getElementById('preview-report');
  setBusy(button, true);
  PREVIEW.innerHTML = '<div class="report-preview"><div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading report data…</div></div>';

  try {
    const [studentResult, progressResult] = await Promise.allSettled([
      get(`/api/students/${studentId}`),
      get(`/api/students/${studentId}/progress`)
    ]);

    if (studentResult.status !== 'fulfilled') throw studentResult.reason;
    const student = studentResult.value.student;

    const progress = progressResult.status === 'fulfilled' ? (progressResult.value.progress || []) : [];
    const latest = progress[progress.length - 1] || null;
    const hasPrediction = latest && latest.predicted_marks != null;

    PREVIEW.innerHTML = `
      <div class="report-preview">
        <div class="report-preview__header">
          <div>
            <div class="report-preview__title">Student performance report</div>
            <div class="report-preview__sub">${escapeHtml(student.full_name)} · ${escapeHtml(student.enrollment_no)}</div>
          </div>
          <span class="model-badge" title="Prototype model trained on public UCI data"><span class="badge-dot"></span> UCI prototype</span>
        </div>

        <div class="report-preview__section">
          <h3>Student profile</h3>
          <div class="report-stat-grid">
            <div class="report-stat">
              <span class="report-stat__label">Course</span>
              <div class="report-stat__value">${escapeHtml(student.course)}</div>
            </div>
            <div class="report-stat">
              <span class="report-stat__label">Semester</span>
              <div class="report-stat__value">${escapeHtml(student.semester)}</div>
            </div>
            <div class="report-stat">
              <span class="report-stat__label">Section</span>
              <div class="report-stat__value">${student.section ? escapeHtml(student.section) : '—'}</div>
            </div>
          </div>
        </div>

        ${latest
          ? `
          <div class="report-preview__section">
            <h3>Latest assessment</h3>
            <div class="report-stat-grid">
              <div class="report-stat">
                <span class="report-stat__label">Date</span>
                <div class="report-stat__value">${formatDate(latest.assessment_date)}</div>
              </div>
              <div class="report-stat">
                <span class="report-stat__label">Estimate</span>
                <div class="report-stat__value">${latest.predicted_marks == null ? '—' : formatNumber(latest.predicted_marks, 1)}/100</div>
              </div>
              <div class="report-stat">
                <span class="report-stat__label">Signal</span>
                <div class="report-stat__value">${latest.risk_level ? riskBadge(latest.risk_level) : '<span class="badge">Pending</span>'}</div>
              </div>
            </div>
            <div class="report-stat-grid" style="margin-top:8px">
              <div class="report-stat">
                <span class="report-stat__label">Attendance</span>
                <div class="report-stat__value">${latest.attendance == null ? '—' : formatNumber(latest.attendance, 1)}%</div>
              </div>
              <div class="report-stat">
                <span class="report-stat__label">Internal marks</span>
                <div class="report-stat__value">${latest.internal_marks == null ? '—' : formatNumber(latest.internal_marks, 1)}</div>
              </div>
              <div class="report-stat">
                <span class="report-stat__label">Previous marks</span>
                <div class="report-stat__value">${latest.previous_marks == null ? '—' : formatNumber(latest.previous_marks, 1)}</div>
              </div>
            </div>
          </div>
          ${latest.explanation ? `<div class="report-preview__section" style="margin-top:14px"><h3>Why this signal</h3><p style="font-size:11px;line-height:1.55;color:var(--text-soft)">${escapeHtml(latest.explanation)}</p></div>` : ''}
          `
          : `<div class="report-preview__section">
            <h3>Latest assessment</h3>
            <p style="font-size:11px;color:var(--muted)">No assessment has been recorded for this student yet.</p>
          </div>`
        }

        <div class="report-preview__footer">
          Generated on ${formatDate(new Date().toISOString().slice(0, 10))} · Prototype model (UCI dataset) · Predictions are estimates, not guarantees · Accuracy for university students not yet validated
        </div>
      </div>
      <div class="mt-4">
        <button class="btn btn--primary btn--block btn--lg" type="button" id="download-pdf">
          ${icon('download')} Download PDF report
        </button>
        <p class="text-xs text-muted mt-2">The PDF includes the prediction, triggered rules and recommendations.</p>
      </div>`;

    document.getElementById('download-pdf').addEventListener('click', async () => {
      const dl = document.getElementById('download-pdf');
      setBusy(dl, true);
      try {
        const filename = await downloadFile(`/api/reports/student/${studentId}`, `student-report-${escapeHtml(student.enrollment_no || studentId)}.pdf`);
        toast(`Report saved as ${escapeHtml(filename)}.`, 'success');
      } catch (err) {
        toast(errorMessage(err), 'error');
      } finally {
        setBusy(dl, false);
      }
    });

    toast('Report preview loaded.', 'success');
  } catch (err) {
    PREVIEW.innerHTML = '<div class="report-preview">' + errorStateHtml(errorMessage(err), 'preview-retry') + '</div>';
    const retry = document.getElementById('preview-retry');
    if (retry) retry.addEventListener('click', () => previewStudent(studentId));
  } finally {
    setBusy(button, false);
  }
}

function setBusy(button, busy) {
  if (!button) return;
  if (busy) {
    button.classList.add('is-loading');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

async function loadQuickReports(allStudents) {
  // Show up to 6 students with the most recent assessments as quick links
  const withProgress = allStudents.filter((s) => s.latest_assessment_date).slice(0, 6);
  if (!withProgress.length) {
    QUICK.innerHTML = emptyStateHtml({
      title: 'No recent assessments',
      message: 'Run assessments first to generate quick reports.',
      iconName: 'calendar'
    });
    return;
  }

  QUICK.innerHTML = `<div class="quick-report-list">
    ${withProgress.map((s) => {
      const meta = riskMeta(s.risk_level);
      return `<div class="quick-report-item">
        <div class="quick-report-item__main">
          <div class="user-cell">
            <span class="avatar">${escapeHtml(initials(s.full_name))}</span>
            <span>
              <span class="user-cell__name">${escapeHtml(s.full_name)}</span>
              <span class="user-cell__meta">${escapeHtml(s.enrollment_no)} · ${escapeHtml(s.course || '')}</span>
            </span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${s.risk_level ? riskBadge(s.risk_level) : '<span class="badge">Pending</span>'}
          <button class="btn btn--ghost btn--sm" type="button" data-quick="${s.student_id}" aria-label="Report for ${escapeHtml(s.full_name)}">${icon('download')}</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  QUICK.querySelectorAll('[data-quick]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.quick);
      const select = document.getElementById('sf-student');
      if (select) {
        select.value = String(id);
        selectedStudentId = id;
      }
      previewStudent(id);
      PREVIEW.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

async function boot() {
  const user = await initShell({
    pageKey: 'reports',
    title: 'Reports',
    eyebrow: user.role === 'admin' ? 'Admin workspace' : 'Student workspace',
    roles: null
  });
  if (!user) return;
  if (user.role === 'student') {
    document.body.dataset.role = 'student';
    BREADCRUMB.textContent = 'Student workspace';
  }
  load();
}

boot();
