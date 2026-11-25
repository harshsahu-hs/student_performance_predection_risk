/* Shared UI helpers, icons, toasts and accessible modals. */

const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6M9 8h2"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.3M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1"/><path d="m2 2 20 20"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/><path d="M5 3l.7 1.8L7.5 5.5 5.7 6.2 5 8l-.7-1.8L2.5 5.5l1.8-.7Z"/>',
  cap: '<path d="M22 9 12 4 2 9l10 5 10-5Z"/><path d="M6 11.5V17c0 1 2.7 3 6 3s6-2 6-3v-5.5"/><path d="M22 9v6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  brain: '<path d="M9.5 4A3.5 3.5 0 0 0 6 7.5c-1.7.5-3 2-3 3.9 0 1.4.7 2.6 1.8 3.3A3.5 3.5 0 0 0 8 20a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 9.5 4Z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5c1.7.5 3 2 3 3.9 0 1.4-.7 2.6-1.8 3.3A3.5 3.5 0 0 1 16 20a3.5 3.5 0 0 1-3.5-3.5v-9A3.5 3.5 0 0 1 14.5 4Z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="m8.2 13-1.7 8L12 18l5.5 3-1.7-8"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8M16 3l5 5M14 5l3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  lightbulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4.2 12.6c.6.5 1.2 1.4 1.2 2.4h6c0-1 .6-1.9 1.2-2.4A7 7 0 0 0 12 2Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  gauge: '<path d="M12 14 17 9"/><path d="M4.5 19a9 9 0 1 1 15 0"/><circle cx="12" cy="14" r="1.5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5.5 5.5 0 0 1 7 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>'
};

export function icon(name, className = '') {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const numberFormatters = new Map();
function numberFormatter(digits) {
  if (!numberFormatters.has(digits)) {
    numberFormatters.set(digits, new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }));
  }
  return numberFormatters.get(digits);
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return numberFormatter(digits).format(n);
}

export function formatDate(value, options = undefined) {
  if (!value) return '--';
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...(options || {})
    }).format(date);
  }
  date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('en-US', options || { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function riskMeta(level) {
  switch (level) {
    case 'high':
      return { key: 'high', label: 'High', description: 'Prioritise a supportive check-in', className: 'risk-badge--high', color: 'var(--danger)' };
    case 'medium':
      return { key: 'medium', label: 'Moderate', description: 'Monitor and offer early support', className: 'risk-badge--medium', color: 'var(--warning)' };
    case 'low':
      return { key: 'low', label: 'Low', description: 'No thresholds crossed in this assessment', className: 'risk-badge--low', color: 'var(--success)' };
    default:
      return { key: 'unknown', label: 'Not assessed', description: 'No prediction available', className: '', color: 'var(--muted)' };
  }
}

export function riskBadge(level) {
  const meta = riskMeta(level);
  return `<span class="badge risk-badge ${meta.className}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>`;
}

export function categoryBadge(category) {
  const map = {
    Excellent: 'badge--success',
    Good: 'badge--info',
    Average: 'badge--accent',
    'Below Average': 'badge--warning',
    'Needs Support': 'badge--danger'
  };
  if (!category) return '<span class="badge">No prediction</span>';
  return `<span class="badge ${map[category] || ''}">${escapeHtml(category)}</span>`;
}

export function priorityBadge(priority) {
  const map = { high: 'badge--danger', medium: 'badge--warning', low: 'badge--success' };
  return `<span class="badge ${map[priority] || ''}">${escapeHtml(priority || 'info')} priority</span>`;
}

export function emptyStateHtml({ title = 'Nothing here yet', message = '', iconName = 'sparkles', actionHtml = '' } = {}) {
  return `<div class="empty-state">
    <div class="empty-state__icon">${icon(iconName)}</div>
    <h3>${escapeHtml(title)}</h3>
    ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    ${actionHtml}
  </div>`;
}

export function errorStateHtml(message = 'These values could not be loaded.', retryId = 'retry-load') {
  return `<div class="empty-state">
    <div class="empty-state__icon" style="color:var(--danger)">${icon('alert')}</div>
    <h3>Something went wrong</h3>
    <p>${escapeHtml(message)}</p>
    <button class="btn btn--secondary btn--sm" id="${escapeHtml(retryId)}" type="button">${icon('refresh')} Try again</button>
  </div>`;
}

export function toast(message, type = 'info', timeout = 5200) {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
  }
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');
  node.innerHTML = `${icon(iconName)}<div class="flex-1">${escapeHtml(message)}</div>
    <button class="toast__close" type="button" aria-label="Dismiss notification">${icon('x')}</button>`;
  region.appendChild(node);

  const remove = () => {
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 260);
  };
  node.querySelector('.toast__close').addEventListener('click', remove);
  setTimeout(remove, timeout);
  return node;
}

let openModalCount = 0;

export function openModal({ title, subtitle = '', body = '', footer = '', size = '', onClose = null, closeOnBackdrop = true }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  backdrop.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    <div class="modal__header">
      <div>
        <h2 class="modal__title" id="${titleId}">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="modal__subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <button class="modal__close" type="button" aria-label="Close dialog">${icon('x')}</button>
    </div>
    <div class="modal__body"></div>
    ${footer ? '<div class="modal__footer"></div>' : ''}
  </div>`;

  const dialog = backdrop.querySelector('.modal');
  const bodyEl = backdrop.querySelector('.modal__body');
  const footerEl = backdrop.querySelector('.modal__footer');
  if (body instanceof Node) bodyEl.appendChild(body);
  else bodyEl.innerHTML = body;
  if (footerEl) {
    if (footer instanceof Node) footerEl.appendChild(footer);
    else footerEl.innerHTML = footer;
  }

  const previousFocus = document.activeElement;
  document.body.style.overflow = 'hidden';
  openModalCount += 1;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const focusables = () => $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dialog)
    .filter((el) => el.offsetParent !== null);

  setTimeout(() => {
    const list = focusables();
    if (list.length) list[0].focus();
    else dialog.focus();
  }, 30);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(() => {
      backdrop.remove();
      openModalCount = Math.max(0, openModalCount - 1);
      if (!openModalCount) document.body.style.overflow = '';
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      if (typeof onClose === 'function') onClose();
    }, 230);
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeydown);
  backdrop.querySelector('.modal__close').addEventListener('click', close);
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close();
    });
  }

  return { element: backdrop, dialog, body: bodyEl, footer: footerEl, close };
}

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const modal = openModal({
      title,
      size: 'modal--sm',
      body: `<p style="font-size:13px;line-height:1.6;color:var(--text-soft)">${escapeHtml(message)}</p>`,
      footer: `<button class="btn btn--secondary" type="button" data-cancel>${escapeHtml(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>`,
      onClose: () => { if (!settled) resolve(false); }
    });
    modal.footer.querySelector('[data-cancel]').addEventListener('click', () => { settled = true; resolve(false); modal.close(); });
    modal.footer.querySelector('[data-confirm]').addEventListener('click', () => { settled = true; resolve(true); modal.close(); });
  });
}

export function setBusy(button, busy) {
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

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function animateCounter(element, value, { digits = 0, prefix = '', suffix = '', duration = 900 } = {}) {
  if (!element) return;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    element.textContent = '--';
    return;
  }
  const target = Number(value);
  if (prefersReducedMotion()) {
    element.textContent = `${prefix}${formatNumber(target, digits)}${suffix}`;
    return;
  }
  const start = performance.now();
  const from = 0;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (target - from) * eased;
    element.textContent = `${prefix}${formatNumber(current, digits)}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initReveals(root = document) {
  const elements = $$('[data-reveal]', root);
  if (!elements.length) return;
  if (prefersReducedMotion() || !window.gsap) {
    if ('IntersectionObserver' in window && !prefersReducedMotion()) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
      elements.forEach((el) => observer.observe(el));
    } else {
      elements.forEach((el) => el.classList.add('is-visible'));
    }
    return;
  }

  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
  elements.forEach((el, index) => {
    if (el.classList.contains('is-visible')) return;
    if (window.ScrollTrigger) {
      gsap.fromTo(el, { opacity: 0, y: 22 }, {
        opacity: 1, y: 0, duration: .72, ease: 'power3.out',
        delay: Math.min(index * 0.035, 0.26),
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    } else {
      gsap.fromTo(el, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .72, delay: Math.min(index * 0.035, 0.26), ease: 'power3.out' });
    }
    el.classList.add('is-visible');
  });
}

export function initTilt(root = document) {
  if (prefersReducedMotion()) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  $$('[data-tilt]', root).forEach((card) => {
    let frame = null;
    const max = Number(card.dataset.tiltMax || 5);
    const onMove = (event) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - .5;
        const py = (event.clientY - rect.top) / rect.height - .5;
        card.style.transform = `perspective(1000px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-2px)`;
      });
    };
    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      card.style.transform = '';
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
  });
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function clearFormErrors(form) {
  if (!form) return;
  $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  $$('.field__error', form).forEach((el) => { el.textContent = ''; el.classList.remove('is-visible'); });
  $$('.auth-alert, [data-form-alert]', form).forEach((el) => el.classList.remove('is-visible'));
}

export function showFormErrors(form, details = []) {
  if (!form) return;
  clearFormErrors(form);
  let first = null;
  for (const detail of details || []) {
    if (!detail || !detail.field) continue;
    const field = detail.field.split('.').pop();
    const input = form.querySelector(`[name="${CSS.escape(field)}"]`);
    const error = form.querySelector(`[data-error-for="${CSS.escape(field)}"]`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (!first) first = input;
    }
    if (error) {
      error.textContent = detail.message || 'Invalid value.';
      error.classList.add('is-visible');
    }
  }
  if (first) first.focus();
}

export function formToObject(form) {
  const data = {};
  const elements = form.elements;
  for (const el of elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      data[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
    } else if (el.type !== 'submit' && el.type !== 'button') {
      data[el.name] = el.value;
    }
  }
  return data;
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function initThemeToggle(buttons = null) {
  const targets = buttons ? Array.from(buttons) : $$('[data-theme-toggle]');
  if (!targets.length) return;
  const render = () => {
    const theme = getTheme();
    targets.forEach((button) => {
      button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('title', theme === 'dark' ? 'Light mode' : 'Dark mode');
    });
  };
  render();
  targets.forEach((button) => {
    if (button.dataset.themeBound === 'true') return;
    button.dataset.themeBound = 'true';
    button.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
      try { localStorage.setItem('sp-theme', next); } catch { /* private mode */ }
      render();
      window.dispatchEvent(new CustomEvent('sp:theme', { detail: { theme: next } }));
    });
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard.', 'success');
    return true;
  } catch {
    toast('Could not copy. Select the text manually.', 'error');
    return false;
  }
}

export function disclaimerHtml(text = 'Predictions are estimates, not guarantees. Risk indicators describe associations in the prototype data, not causes, and are never a permanent label. Accuracy for university students has not yet been validated.') {
  return `<p class="disclaimer-note">${icon('info')}<span>${escapeHtml(text)}</span></p>`;
}

export { prefersReducedMotion };
