import { requireUser, logout, dashboardPath } from './auth.js';
import {
  icon, escapeHtml, initials, openModal, initReveals, initTilt, initThemeToggle,
  toast, prefersReducedMotion
} from './ui.js';

const NAV = {
  admin: [
    { key: 'overview', label: 'Dashboard', href: '/pages/admin-dashboard.html', icon: 'dashboard' },
    { key: 'students', label: 'Students', href: '/pages/students.html', icon: 'users' },
    { key: 'assessments', label: 'Assessments', href: '/pages/assessments.html', icon: 'clipboard' },
    { key: 'analytics', label: 'Analytics', href: '/pages/analytics.html', icon: 'chart' },
    { key: 'risk', label: 'Risk analysis', href: '/pages/risk.html', icon: 'shield' },
    { key: 'reports', label: 'Reports', href: '/pages/reports.html', icon: 'file' }
  ],
  student: [
    { key: 'overview', label: 'My dashboard', href: '/pages/student-dashboard.html', icon: 'dashboard' },
    { key: 'risk', label: 'My risk analysis', href: '/pages/risk.html', icon: 'shield' },
    { key: 'reports', label: 'My report', href: '/pages/reports.html', icon: 'file' }
  ]
};

function navHtml(user, pageKey) {
  const items = NAV[user.role] || [];
  return `<nav aria-label="Main navigation">
    <div class="nav-section">
      <p class="nav-section__label">${user.role === 'admin' ? 'Administration' : 'My progress'}</p>
      ${items.map((item) => `<a class="nav-link ${item.key === pageKey ? 'is-active' : ''}"
        href="${item.href}" ${item.key === pageKey ? 'aria-current="page"' : ''}>
        ${icon(item.icon)}<span>${escapeHtml(item.label)}</span>
      </a>`).join('')}
    </div>
    <div class="nav-section">
      <p class="nav-section__label">Model honesty</p>
      <div class="sidebar__note">
        <strong>Prototype model (UCI dataset)</strong>
        Trained on secondary-school data. Accuracy for university students is not yet validated.
      </div>
    </div>
  </nav>`;
}

function sidebarHtml(user, pageKey) {
  return `
    <a class="brand" href="${dashboardPath(user.role)}" aria-label="Student Performance home">
      <span class="brand__mark">${icon('cap')}</span>
      <span class="brand__text">
        <span class="brand__name">Student Signal</span>
        <span class="brand__tag">Performance &amp; risk</span>
      </span>
    </a>
    ${navHtml(user, pageKey)}
    <div class="sidebar__spacer"></div>
    <div class="user-card">
      <span class="avatar">${escapeHtml(initials(user.student ? user.student.full_name : user.username))}</span>
      <span class="user-card__info">
        <span class="user-card__name">${escapeHtml(user.student ? user.student.full_name : user.username)}</span>
        <span class="user-card__role">${escapeHtml(user.role)} account</span>
      </span>
    </div>
    <div class="sidebar__actions">
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle theme"></button>
      <button class="icon-btn" type="button" data-logout aria-label="Sign out" title="Sign out">${icon('logout')}</button>
    </div>`;
}

function topbarHtml(user, title, eyebrow) {
  return `
    <button class="icon-btn topbar__menu" id="nav-toggle" type="button" aria-label="Open navigation"
      aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>
    <div class="topbar__titles">
      <p class="topbar__eyebrow">${escapeHtml(eyebrow)}</p>
      <p class="topbar__title" id="topbar-title">${escapeHtml(title)}</p>
    </div>
    <div class="topbar__actions">
      <button class="model-badge" type="button" data-model-info title="About the prototype model">
        <span class="badge-dot"></span> Prototype model (UCI dataset)
      </button>
      <span class="topbar__divider" aria-hidden="true"></span>
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle theme"></button>
      <div class="topbar__user" title="${escapeHtml(user.student ? user.student.full_name : user.username)}">
        <span class="topbar__user-name">${escapeHtml(user.student ? user.student.full_name : user.username)}</span>
        <span class="avatar topbar__avatar">${escapeHtml(initials(user.student ? user.student.full_name : user.username))}</span>
      </div>
    </div>`;
}

function showModelInfo() {
  openModal({
    title: 'Prototype model (UCI dataset)',
    subtitle: 'What this model is, and what it is not',
    size: 'modal--lg',
    body: `
      <div class="alert alert--warning" style="margin-bottom:16px">
        ${icon('alert')}
        <div><strong>Accuracy for university students is not yet validated.</strong><br>
        This prototype is trained on the public UCI Student Performance dataset of secondary-school students in Portugal. It has not been retrained or evaluated on this institution's students.</div>
      </div>
      <div class="detail-list">
        <div class="detail-row"><span class="detail-row__label">Model task</span><span class="detail-row__value">Regression estimate of marks out of 100</span></div>
        <div class="detail-row"><span class="detail-row__label">Training data</span><span class="detail-row__value">UCI student-mat + student-por (1,044 records)</span></div>
        <div class="detail-row"><span class="detail-row__label">Evaluation</span><span class="detail-row__value">Held-out group split; MAE, RMSE and R2 stored in the database</span></div>
        <div class="detail-row"><span class="detail-row__label">Model inputs</span><span class="detail-row__value">Attendance, internal marks, study hours, previous marks</span></div>
        <div class="detail-row"><span class="detail-row__label">Recorded, not modelled</span><span class="detail-row__value">Assignment completion and participation (used by transparent risk rules)</span></div>
      </div>
      <div class="divider"></div>
      <p class="text-sm text-muted" style="line-height:1.65">
        Predictions are estimates, not guarantees. Explanations describe associations in the training data, not causes.
        Risk levels are early-warning signals for supportive intervention and are never a permanent label for a student.
        All displayed evaluation numbers come from the stored model metrics, not from fabricated examples.
      </p>`,
    footer: `<a class="btn btn--secondary" href="${window.location.pathname.startsWith('/pages/analytics') ? '#' : '/pages/analytics.html'}">View model analytics</a>
      <button class="btn btn--primary" type="button" data-close-modal>Understood</button>`
  }).footer.querySelector('[data-close-modal]').closest('.modal-backdrop').querySelector('.modal__close').addEventListener('click', () => {});
}

function wireModelInfo() {
  const button = document.querySelector('[data-model-info]');
  if (!button) return;
  button.addEventListener('click', () => {
    const modal = openModal({
      title: 'Prototype model (UCI dataset)',
      subtitle: 'What this model is, and what it is not',
      size: 'modal--lg',
      body: `
        <div class="alert alert--warning" style="margin-bottom:16px">
          ${icon('alert')}
          <div><strong>Accuracy for university students is not yet validated.</strong><br>
          This prototype is trained on the public UCI Student Performance dataset of secondary-school students in Portugal. It has not been retrained or evaluated on this institution's students.</div>
        </div>
        <div class="detail-list">
          <div class="detail-row"><span class="detail-row__label">Model task</span><span class="detail-row__value">Regression estimate of marks out of 100</span></div>
          <div class="detail-row"><span class="detail-row__label">Training data</span><span class="detail-row__value">UCI student-mat + student-por (1,044 records)</span></div>
          <div class="detail-row"><span class="detail-row__label">Evaluation</span><span class="detail-row__value">Held-out group split; MAE, RMSE and R2 stored in the database</span></div>
          <div class="detail-row"><span class="detail-row__label">Model inputs</span><span class="detail-row__value">Attendance, internal marks, study hours, previous marks</span></div>
          <div class="detail-row"><span class="detail-row__label">Recorded, not modelled</span><span class="detail-row__value">Assignment completion and participation (used by transparent risk rules)</span></div>
        </div>
        <div class="divider"></div>
        <p class="text-sm text-muted" style="line-height:1.65">
          Predictions are estimates, not guarantees. Explanations describe associations in the training data, not causes.
          Risk levels are early-warning signals for supportive intervention and are never a permanent label for a student.
          All displayed evaluation numbers come from the stored model metrics, not from fabricated examples.
        </p>`,
      footer: `<button class="btn btn--primary" type="button" data-close-modal>Understood</button>`
    });
    modal.footer.querySelector('[data-close-modal]').addEventListener('click', () => modal.close());
  });
}

function wireMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('nav-toggle');
  if (!sidebar || !toggle) return;
  let scrim = document.querySelector('.nav-scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    scrim.addEventListener('click', () => close());
    document.body.appendChild(scrim);
  }
  const open = () => {
    sidebar.classList.add('is-open');
    scrim.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close navigation');
  };
  const close = () => {
    sidebar.classList.remove('is-open');
    scrim.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  };
  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) close(); else open();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
}

function wireLogout(user) {
  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      toast('Signing out...', 'info', 1200);
      await logout();
    });
  });
}

function wirePageTransitions() {
  if (prefersReducedMotion() || !window.gsap) return;
  const gsap = window.gsap;
  const targets = ['.page-head', '.stat-grid > *', '.dashboard-grid > *', '.assessment-layout > *', '.reports-layout > *', '.analytics-top > *'];
  const elements = targets.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  if (elements.length) {
    gsap.from(elements, {
      opacity: 0, y: 18, duration: .6, ease: 'power3.out', stagger: .045,
      clearProps: 'transform,opacity'
    });
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href').startsWith('#')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    if (!url.pathname.endsWith('.html') && url.pathname !== '/') return;
    event.preventDefault();
    const shell = document.querySelector('.shell');
    if (!shell) { window.location.assign(url.href); return; }
    gsap.to(shell, {
      opacity: 0, y: -6, duration: .2, ease: 'power2.in',
      onComplete: () => window.location.assign(url.href)
    });
  });
}

export async function initShell({ pageKey = 'overview', title = 'Dashboard', eyebrow = null, roles = null, subtitle = null } = {}) {
  const user = await requireUser({ roles });
  if (!user) return null;

  const finalEyebrow = eyebrow || (user.role === 'admin' ? 'Admin workspace' : 'Student workspace');
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  if (sidebar) sidebar.innerHTML = sidebarHtml(user, pageKey);
  if (topbar) topbar.innerHTML = topbarHtml(user, title, finalEyebrow);
  if (subtitle) {
    const sub = document.createElement('p');
    sub.className = 'topbar__eyebrow';
    sub.textContent = subtitle;
  }

  document.title = `${title} · Student Signal`;
  initThemeToggle();
  initReveals();
  initTilt();
  wireMobileNav();
  wireLogout(user);
  wireModelInfo();
  wirePageTransitions();

  const boot = document.querySelector('.boot-overlay');
  if (boot) {
    boot.classList.add('is-hidden');
    setTimeout(() => boot.remove(), 350);
  }

  document.querySelectorAll('[data-current-date]').forEach((el) => {
    el.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  });

  return user;
}

export { NAV, icon, escapeHtml };
