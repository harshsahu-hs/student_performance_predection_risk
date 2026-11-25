import { initShell } from './shell.js';
import { get, post, put, patch, del, errorMessage } from './api.js';
import {
  icon, escapeHtml, initials, formatNumber, formatDate, riskBadge, riskMeta,
  emptyStateHtml, errorStateHtml, openModal, confirmDialog, toast, setBusy,
  showFormErrors, clearFormErrors, formToObject, debounce, copyText
} from './ui.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;

const tableHost = document.getElementById('students-table');
const paginationHost = document.getElementById('students-pagination');
const countBadge = document.getElementById('student-count');
const searchInput = document.getElementById('student-search');
const statusTabs = Array.from(document.querySelectorAll('[data-status]'));

const state = {
  page: 1,
  pageSize: 10,
  search: '',
  status: 'all',
  rows: new Map(),
  pagination: null
};
let loadSequence = 0;

function setCount(total) {
  countBadge.textContent = `${formatNumber(total)} ${total === 1 ? 'student' : 'students'}`;
}

function rowActions(row) {
  const active = Boolean(row.is_active);
  return `<div class="table-actions">
    <button class="icon-btn" style="width:32px;height:32px" type="button" data-action="view" data-id="${row.student_id}" aria-label="View ${escapeHtml(row.full_name)}" title="View record">${icon('eye')}</button>
    <button class="icon-btn" style="width:32px;height:32px" type="button" data-action="edit" data-id="${row.student_id}" aria-label="Edit ${escapeHtml(row.full_name)}" title="Edit details">${icon('edit')}</button>
    <a class="icon-btn" style="width:32px;height:32px" href="/pages/reports.html?student=${encodeURIComponent(row.student_id)}" aria-label="Open report for ${escapeHtml(row.full_name)}" title="Report">${icon('file')}</a>
    <button class="icon-btn" style="width:32px;height:32px" type="button" data-action="toggle" data-id="${row.student_id}" aria-label="${active ? 'Deactivate' : 'Activate'} ${escapeHtml(row.full_name)}" title="${active ? 'Deactivate account' : 'Activate account'}">${icon(active ? 'user-x' : 'user-check')}</button>
    <button class="icon-btn" style="width:32px;height:32px;color:var(--danger)" type="button" data-action="delete" data-id="${row.student_id}" aria-label="Delete ${escapeHtml(row.full_name)}" title="Delete permanently">${icon('trash')}</button>
  </div>`;
}

function renderTable(data) {
  state.rows = new Map(data.students.map((row) => [row.student_id, row]));
  state.pagination = data.pagination;
  setCount(data.pagination.total);

  if (!data.students.length) {
    const filtered = Boolean(state.search) || state.status !== 'all';
    tableHost.innerHTML = emptyStateHtml({
      title: filtered ? 'No students match this view' : 'No students yet',
      message: filtered
        ? 'Try a different search term or switch the status filter.'
        : 'Add the first student account to start recording assessments.',
      iconName: 'users',
      actionHtml: filtered
        ? '<button class="btn btn--secondary btn--sm" type="button" id="empty-clear">Clear filters</button>'
        : '<button class="btn btn--primary btn--sm" type="button" id="empty-add">Add student</button>'
    });
    const clear = document.getElementById('empty-clear');
    if (clear) clear.addEventListener('click', clearFilters);
    const add = document.getElementById('empty-add');
    if (add) add.addEventListener('click', () => openStudentForm({ mode: 'create' }));
    renderPagination(data.pagination);
    return;
  }

  tableHost.innerHTML = `<div class="table-wrap">
    <table class="data-table">
      <caption class="sr-only">Student accounts, with latest estimate and support signal</caption>
      <thead>
        <tr>
          <th scope="col">Student</th>
          <th scope="col">Enrolment</th>
          <th scope="col">Course</th>
          <th scope="col">Status</th>
          <th scope="col">Latest estimate</th>
          <th scope="col">Signal</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        ${data.students.map((row) => `<tr>
          <td>
            <div class="user-cell">
              <span class="avatar">${escapeHtml(initials(row.full_name))}</span>
              <span style="min-width:0">
                <span class="user-cell__name truncate">${escapeHtml(row.full_name)}</span>
                <span class="user-cell__meta truncate">${escapeHtml(row.email)}</span>
              </span>
            </div>
          </td>
          <td class="font-mono nowrap">${escapeHtml(row.enrollment_no)}</td>
          <td>
            <div class="cell-strong">${escapeHtml(row.course)}</div>
            <div class="text-xs text-muted">Semester ${escapeHtml(row.semester)}${row.section ? ` · Section ${escapeHtml(row.section)}` : ''}</div>
          </td>
          <td><span class="status-pill ${row.is_active ? 'status-pill--active' : 'status-pill--inactive'}">${row.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>${row.predicted_marks == null
            ? '<span class="badge">No estimate</span>'
            : `<span class="cell-strong font-mono">${formatNumber(row.predicted_marks, 1)}</span><span class="text-muted text-xs"> /100</span>
               <div class="text-xs text-muted">${formatDate(row.latest_assessment_date)}</div>`}</td>
          <td>${row.risk_level ? riskBadge(row.risk_level) : '<span class="badge">Not assessed</span>'}</td>
          <td>${rowActions(row)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;

  renderPagination(data.pagination);
}

function renderPagination(pagination) {
  if (!pagination || !pagination.total) {
    paginationHost.innerHTML = '';
    return;
  }
  const start = (pagination.page - 1) * pagination.page_size + 1;
  const end = Math.min(pagination.page * pagination.page_size, pagination.total);
  const pages = [];
  let from = Math.max(1, pagination.page - 2);
  let to = Math.min(pagination.total_pages, from + 4);
  from = Math.max(1, to - 4);
  for (let i = from; i <= to; i += 1) pages.push(i);

  paginationHost.innerHTML = `<div class="pagination">
    <span class="pagination__info">Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(pagination.total)}</span>
    <div class="pagination__buttons">
      <button class="page-btn" type="button" data-page="${pagination.page - 1}" ${pagination.page <= 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevron-left')}</button>
      ${pages.map((page) => `<button class="page-btn ${page === pagination.page ? 'is-active' : ''}" type="button" data-page="${page}" ${page === pagination.page ? 'aria-current="page"' : ''}>${page}</button>`).join('')}
      <button class="page-btn" type="button" data-page="${pagination.page + 1}" ${pagination.page >= pagination.total_pages ? 'disabled' : ''} aria-label="Next page">${icon('chevron-right')}</button>
    </div>
  </div>`;

  paginationHost.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = Number(button.dataset.page);
      if (!page || page === state.page) return;
      state.page = page;
      loadStudents();
    });
  });
}

async function loadStudents({ quiet = false } = {}) {
  const sequence = ++loadSequence;
  if (!quiet) {
    tableHost.innerHTML = '<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading students…</div>';
    paginationHost.innerHTML = '';
  }
  try {
    const data = await get('/api/students', {
      query: {
        page: state.page,
        page_size: state.pageSize,
        search: state.search,
        status: state.status
      }
    });
    if (sequence !== loadSequence) return;
    renderTable(data);
  } catch (err) {
    if (sequence !== loadSequence) return;
    setCount(0);
    tableHost.innerHTML = errorStateHtml(errorMessage(err), 'students-retry');
    paginationHost.innerHTML = '';
    const retry = document.getElementById('students-retry');
    if (retry) retry.addEventListener('click', () => loadStudents());
  }
}

function clearFilters() {
  state.search = '';
  state.status = 'all';
  state.page = 1;
  searchInput.value = '';
  statusTabs.forEach((tab) => {
    const active = tab.dataset.status === 'all';
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  loadStudents();
}

/* --------------------------------------------------------------------------
   Create / edit modal
   -------------------------------------------------------------------------- */
function semesterOptions(selected) {
  return Array.from({ length: 12 }, (_, index) => {
    const value = index + 1;
    return `<option value="${value}" ${Number(selected) === value ? 'selected' : ''}>${value}</option>`;
  }).join('');
}

function formAlertHtml() {
  return `<div class="alert alert--danger hidden" data-modal-alert role="alert">
    ${icon('alert')}<div data-modal-alert-text></div>
  </div>`;
}

function setModalAlert(modal, message) {
  const alert = modal.body.querySelector('[data-modal-alert]');
  if (!alert) return;
  alert.classList.toggle('hidden', !message);
  const text = alert.querySelector('[data-modal-alert-text]');
  if (text) text.textContent = message || '';
}

function validateCreate(payload) {
  const details = [];
  if (!payload.full_name || payload.full_name.trim().length < 2) details.push({ field: 'full_name', message: 'Enter the student’s full name.' });
  if (!USERNAME_RE.test(payload.username || '')) details.push({ field: 'username', message: 'Username must be 3-50 letters, numbers, dots, dashes or underscores.' });
  if (!EMAIL_RE.test(payload.email || '')) details.push({ field: 'email', message: 'Enter a valid email address.' });
  if (!payload.enrollment_no || payload.enrollment_no.trim().length < 3) details.push({ field: 'enrollment_no', message: 'Enter an enrolment number (3-40 characters).' });
  if (!payload.course || payload.course.trim().length < 2) details.push({ field: 'course', message: 'Enter a course name.' });
  const semester = Number(payload.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) details.push({ field: 'semester', message: 'Select a semester between 1 and 12.' });
  if (payload.password) {
    if (payload.password.length < 8) details.push({ field: 'password', message: 'Password must be at least 8 characters.' });
    else if (!(/[A-Za-z]/.test(payload.password) && /\d/.test(payload.password))) {
      details.push({ field: 'password', message: 'Password must include at least one letter and one number.' });
    }
  }
  return details;
}

function validateEdit(payload) {
  const details = [];
  if (!payload.full_name || payload.full_name.trim().length < 2) details.push({ field: 'full_name', message: 'Enter the student’s full name.' });
  if (!payload.course || payload.course.trim().length < 2) details.push({ field: 'course', message: 'Enter a course name.' });
  const semester = Number(payload.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) details.push({ field: 'semester', message: 'Select a semester between 1 and 12.' });
  return details;
}

function openStudentForm({ mode = 'create', student = null } = {}) {
  const isEdit = mode === 'edit' && student;
  const title = isEdit ? 'Edit student details' : 'Add a student';
  const subtitle = isEdit
    ? `${student.full_name} · ${student.enrollment_no}`
    : 'Creates an active student account immediately. Share credentials securely.';

  const body = `<form id="student-form" novalidate>
    ${formAlertHtml()}
    ${isEdit ? `<div class="alert alert--info mb-4">${icon('info')}<div>Email, username and enrolment number are fixed after creation. Contact a database administrator if they must change.</div></div>` : ''}
    <div class="form-grid">
      <div class="field">
        <label for="sf-full-name">Full name</label>
        <input class="input" id="sf-full-name" name="full_name" type="text" autocomplete="name"
          value="${isEdit ? escapeHtml(student.full_name) : ''}" placeholder="Aarav Sharma" required maxlength="120">
        <span class="field__error" data-error-for="full_name"></span>
      </div>
      ${isEdit ? '' : `<div class="field">
        <label for="sf-username">Username</label>
        <input class="input" id="sf-username" name="username" type="text" autocomplete="off"
          placeholder="aarav.sharma" required minlength="3" maxlength="50">
        <span class="field__error" data-error-for="username"></span>
      </div>`}
    </div>
    ${isEdit ? '' : `<div class="form-grid">
      <div class="field">
        <label for="sf-email">Email address</label>
        <input class="input" id="sf-email" name="email" type="email" autocomplete="off"
          placeholder="student@institution.edu" required maxlength="255">
        <span class="field__error" data-error-for="email"></span>
      </div>
      <div class="field">
        <label for="sf-enrollment">Enrolment number</label>
        <input class="input" id="sf-enrollment" name="enrollment_no" type="text"
          placeholder="ENR-2026-014" required maxlength="40">
        <span class="field__error" data-error-for="enrollment_no"></span>
      </div>
    </div>`}
    <div class="form-grid">
      <div class="field">
        <label for="sf-course">Course</label>
        <input class="input" id="sf-course" name="course" type="text"
          value="${isEdit ? escapeHtml(student.course) : ''}" placeholder="B.Tech CSE" required maxlength="100">
        <span class="field__error" data-error-for="course"></span>
      </div>
      <div class="field">
        <label for="sf-semester">Semester</label>
        <select class="select" id="sf-semester" name="semester" required>
          <option value="">Select semester</option>
          ${semesterOptions(isEdit ? student.semester : '')}
        </select>
        <span class="field__error" data-error-for="semester"></span>
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="sf-section">Section <span class="text-muted">(optional)</span></label>
        <input class="input" id="sf-section" name="section" type="text"
          value="${isEdit && student.section ? escapeHtml(student.section) : ''}" placeholder="A" maxlength="20">
        <span class="field__error" data-error-for="section"></span>
      </div>
      ${isEdit ? '' : `<div class="field">
        <label for="sf-password">Initial password <span class="text-muted">(optional)</span></label>
        <input class="input" id="sf-password" name="password" type="password" autocomplete="new-password"
          placeholder="Leave blank to generate one" minlength="8" maxlength="72">
        <span class="field__hint">If blank, a one-time temporary password is generated and shown once.</span>
        <span class="field__error" data-error-for="password"></span>
      </div>`}
    </div>
  </form>`;

  const modal = openModal({
    title,
    subtitle,
    size: 'modal--lg',
    body,
    footer: `<button class="btn btn--secondary" type="button" data-cancel>Cancel</button>
      <button class="btn btn--primary" type="button" data-save>${isEdit ? 'Save changes' : 'Create student'}</button>`
  });

  const form = modal.body.querySelector('#student-form');
  const save = modal.footer.querySelector('[data-save]');
  modal.footer.querySelector('[data-cancel]').addEventListener('click', () => modal.close());

  save.addEventListener('click', () => form.requestSubmit());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    setModalAlert(modal, '');
    const raw = formToObject(form);
    const payload = { ...raw, semester: Number(raw.semester) };
    if (!payload.section) delete payload.section;
    if (!payload.password) delete payload.password;

    const details = isEdit ? validateEdit(payload) : validateCreate(payload);
    if (details.length) {
      showFormErrors(form, details);
      return;
    }

    setBusy(save, true);
    try {
      if (isEdit) {
        const updated = await put(`/api/students/${student.student_id}`, {
          full_name: payload.full_name,
          course: payload.course,
          semester: payload.semester,
          ...(payload.section !== undefined ? { section: payload.section } : {})
        });
        toast(`${updated.student.full_name} updated.`, 'success');
        modal.close();
        loadStudents({ quiet: true });
      } else {
        const created = await post('/api/students', {
          username: payload.username,
          email: payload.email,
          full_name: payload.full_name,
          enrollment_no: payload.enrollment_no,
          course: payload.course,
          semester: payload.semester,
          ...(payload.section ? { section: payload.section } : {}),
          ...(payload.password ? { password: payload.password } : {})
        });
        modal.close();
        loadStudents({ quiet: true });
        if (created.temporary_password) {
          showTemporaryPassword(created.temporary_password, created.student.full_name);
        } else {
          toast(`${created.student.full_name} created.`, 'success');
        }
      }
    } catch (err) {
      setBusy(save, false);
      if (Array.isArray(err.details) && err.details.length) showFormErrors(form, err.details);
      setModalAlert(modal, errorMessage(err));
    }
  });
}

function showTemporaryPassword(password, name) {
  const modal = openModal({
    title: 'Student created',
    subtitle: `${name} can sign in once you share this temporary password.`,
    size: 'modal--sm',
    body: `<div class="alert alert--warning mb-4">${icon('alert')}<div><strong>Shown once.</strong> This password is not stored in readable form and cannot be shown again. Ask the student to change it after signing in.</div></div>
      <div class="temp-password"><span style="flex:1">${escapeHtml(password)}</span>
        <button class="icon-btn" type="button" data-copy-password aria-label="Copy temporary password" title="Copy password">${icon('copy')}</button>
      </div>
      <p class="text-xs text-muted mt-3">Share it through a secure channel. Do not paste it into shared documents or chat groups.</p>`,
    footer: '<button class="btn btn--primary" type="button" data-done>Done</button>'
  });
  modal.footer.querySelector('[data-done]').addEventListener('click', () => modal.close());
  modal.body.querySelector('[data-copy-password]').addEventListener('click', () => copyText(password));
}

/* --------------------------------------------------------------------------
   View modal
   -------------------------------------------------------------------------- */
async function viewStudent(row) {
  const modal = openModal({
    title: 'Student record',
    subtitle: `${row.full_name} · ${row.enrollment_no}`,
    size: 'modal--lg',
    body: '<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading record…</div>',
    footer: `<button class="btn btn--secondary" type="button" data-close>Close</button>
      <a class="btn btn--secondary" href="/pages/reports.html?student=${encodeURIComponent(row.student_id)}">Open report</a>
      <button class="btn btn--primary" type="button" data-edit>Edit details</button>`
  });
  modal.footer.querySelector('[data-close]').addEventListener('click', () => modal.close());
  modal.footer.querySelector('[data-edit]').addEventListener('click', () => {
    modal.close();
    openStudentForm({ mode: 'edit', student: row });
  });

  try {
    const data = await get(`/api/students/${row.student_id}`);
    const student = data.student;
    const stats = data.stats;
    const meta = riskMeta(student.risk_level);
    modal.body.innerHTML = `
      <div class="student-view-grid">
        <div>
          <h3 class="panel__title" style="margin-bottom:10px">Account</h3>
          <div class="detail-list">
            <div class="detail-row"><span class="detail-row__label">Full name</span><span class="detail-row__value">${escapeHtml(student.full_name)}</span></div>
            <div class="detail-row"><span class="detail-row__label">Username</span><span class="detail-row__value font-mono">${escapeHtml(student.username)}</span></div>
            <div class="detail-row"><span class="detail-row__label">Email</span><span class="detail-row__value">${escapeHtml(student.email)}</span></div>
            <div class="detail-row"><span class="detail-row__label">Status</span><span class="detail-row__value"><span class="status-pill ${student.is_active ? 'status-pill--active' : 'status-pill--inactive'}">${student.is_active ? 'Active' : 'Inactive'}</span></span></div>
            <div class="detail-row"><span class="detail-row__label">Created</span><span class="detail-row__value">${formatDate(student.created_at)}</span></div>
          </div>
        </div>
        <div>
          <h3 class="panel__title" style="margin-bottom:10px">Enrolment</h3>
          <div class="detail-list">
            <div class="detail-row"><span class="detail-row__label">Enrolment no.</span><span class="detail-row__value font-mono">${escapeHtml(student.enrollment_no)}</span></div>
            <div class="detail-row"><span class="detail-row__label">Course</span><span class="detail-row__value">${escapeHtml(student.course)}</span></div>
            <div class="detail-row"><span class="detail-row__label">Semester</span><span class="detail-row__value">${escapeHtml(student.semester)}</span></div>
            <div class="detail-row"><span class="detail-row__label">Section</span><span class="detail-row__value">${student.section ? escapeHtml(student.section) : '—'}</span></div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="risk-stat-row">
        <div class="risk-stat"><div class="risk-stat__value">${formatNumber(stats.assessment_count)}</div><div class="risk-stat__label">Assessments</div></div>
        <div class="risk-stat"><div class="risk-stat__value">${formatNumber(stats.prediction_count)}</div><div class="risk-stat__label">Predictions</div></div>
        <div class="risk-stat"><div class="risk-stat__value">${stats.average_predicted_marks == null ? '--' : formatNumber(stats.average_predicted_marks, 1)}</div><div class="risk-stat__label">Avg estimate</div></div>
      </div>

      <div class="divider"></div>

      <div class="result-summary">
        <div>
          <span class="metric-card__label">Latest estimate</span>
          <div class="result-number" style="font-size:34px">${student.predicted_marks == null ? '--' : formatNumber(student.predicted_marks, 1)}<small>/100</small></div>
          <p class="text-xs text-muted">${student.latest_assessment_date ? `Assessment ${formatDate(student.latest_assessment_date)}` : 'No assessment recorded yet'}</p>
        </div>
        <div class="result-badges">
          ${student.risk_level ? riskBadge(student.risk_level) : '<span class="badge">Not assessed</span>'}
          <span class="text-xs text-muted">${escapeHtml(meta.description)}</span>
        </div>
      </div>`;
  } catch (err) {
    modal.body.innerHTML = errorStateHtml(errorMessage(err), 'view-retry');
    const retry = document.getElementById('view-retry');
    if (retry) retry.addEventListener('click', () => { modal.close(); viewStudent(row); });
  }
}

/* --------------------------------------------------------------------------
   Status + delete
   -------------------------------------------------------------------------- */
async function toggleStatus(row) {
  const activating = !row.is_active;
  const confirmed = await confirmDialog({
    title: activating ? 'Activate this account?' : 'Deactivate this account?',
    message: activating
      ? `${row.full_name} will be able to sign in again immediately.`
      : `${row.full_name} will be signed out immediately and blocked from signing in. Their assessments and predictions are retained.`,
    confirmLabel: activating ? 'Activate account' : 'Deactivate account',
    danger: !activating
  });
  if (!confirmed) return;
  try {
    const result = await patch(`/api/students/${row.student_id}/status`, { is_active: activating });
    toast(result.message || (activating ? 'Account activated.' : 'Account deactivated.'), 'success');
    loadStudents({ quiet: true });
  } catch (err) {
    toast(errorMessage(err), 'error');
  }
}

async function deleteStudent(row) {
  const confirmed = await confirmDialog({
    title: 'Delete this student permanently?',
    message: `This removes ${row.full_name}'s account, student profile, assessments, predictions, recommendations and progress records. This cannot be undone.`,
    confirmLabel: 'Delete permanently',
    danger: true
  });
  if (!confirmed) return;
  try {
    await del(`/api/students/${row.student_id}`);
    toast(`${row.full_name} deleted.`, 'success');
    if (state.rows.size === 1 && state.page > 1) state.page -= 1;
    loadStudents();
  } catch (err) {
    toast(errorMessage(err), 'error');
  }
}

/* --------------------------------------------------------------------------
   Wiring
   -------------------------------------------------------------------------- */
tableHost.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  const row = state.rows.get(id);
  if (!row) return;
  const action = button.dataset.action;
  if (action === 'view') viewStudent(row);
  else if (action === 'edit') openStudentForm({ mode: 'edit', student: row });
  else if (action === 'toggle') toggleStatus(row);
  else if (action === 'delete') deleteStudent(row);
});

searchInput.addEventListener('input', debounce(() => {
  const value = searchInput.value.trim();
  if (value === state.search) return;
  state.search = value;
  state.page = 1;
  loadStudents();
}, 350));

searchInput.addEventListener('search', () => {
  if (!searchInput.value && state.search) {
    state.search = '';
    state.page = 1;
    loadStudents();
  }
});

statusTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (tab.dataset.status === state.status) return;
    state.status = tab.dataset.status;
    state.page = 1;
    statusTabs.forEach((other) => {
      const active = other === tab;
      other.classList.toggle('is-active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    loadStudents();
  });
});

document.getElementById('add-student').addEventListener('click', () => openStudentForm({ mode: 'create' }));
document.getElementById('refresh-students').addEventListener('click', () => loadStudents());

async function boot() {
  const user = await initShell({
    pageKey: 'students',
    title: 'Students',
    eyebrow: 'Admin workspace',
    roles: ['admin']
  });
  if (!user) return;
  loadStudents();
}

boot();
