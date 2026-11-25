import {
  getCurrentUser, login, register, logout, dashboardPath, safeNextPath
} from './auth.js';
import { errorMessage } from './api.js';
import {
  icon, initThemeToggle, initReveals, initTilt, toast, setBusy,
  showFormErrors, clearFormErrors
} from './ui.js';
import { initParticleNetwork } from './three-scenes.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabs = {
  login: document.getElementById('tab-login'),
  register: document.getElementById('tab-register')
};
const panels = {
  login: document.getElementById('panel-login'),
  register: document.getElementById('panel-register')
};
const authTitle = document.getElementById('auth-title');
const authSub = document.getElementById('auth-sub');
const authTabs = document.querySelector('.auth-tabs');
const signedInPanel = document.getElementById('signed-in-panel');
const registerSuccess = document.getElementById('register-success');

function setAuthAlert(panel, message) {
  const alert = panel.querySelector('[data-auth-alert]');
  const text = panel.querySelector('[data-auth-alert-text]');
  if (!alert || !text) return;
  text.textContent = message || '';
  alert.classList.toggle('is-visible', Boolean(message));
}

function clearAuthAlert(panel) {
  setAuthAlert(panel, '');
}

function activateTab(name, { focus = false } = {}) {
  const isLogin = name === 'login';
  tabs.login.setAttribute('aria-selected', String(isLogin));
  tabs.register.setAttribute('aria-selected', String(!isLogin));
  tabs.login.tabIndex = isLogin ? 0 : -1;
  tabs.register.tabIndex = isLogin ? -1 : 0;
  panels.login.classList.toggle('hidden', !isLogin);
  panels.register.classList.toggle('hidden', isLogin);
  authTitle.textContent = isLogin ? 'Welcome back' : 'Request student access';
  authSub.textContent = isLogin
    ? 'Sign in to review assessments, estimates and support plans.'
    : 'Register with your institutional details. An administrator approves new accounts.';
  if (focus) (isLogin ? tabs.login : tabs.register).focus();
}

tabs.login.addEventListener('click', () => activateTab('login'));
tabs.register.addEventListener('click', () => activateTab('register'));

document.querySelectorAll('[data-switch-register]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    activateTab('register', { focus: true });
  });
});

document.querySelectorAll('[data-back-to-login]').forEach((button) => {
  button.addEventListener('click', () => {
    registerSuccess.classList.add('hidden');
    registerForm.classList.remove('hidden');
    activateTab('login', { focus: true });
  });
});

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    button.innerHTML = show
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.3M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1"/><path d="m2 2 20 20"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
});

const strength = document.getElementById('password-strength');
const registerPassword = document.getElementById('reg-password');
registerPassword.addEventListener('input', () => {
  const value = registerPassword.value;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (value.length >= 12) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  strength.dataset.score = String(value ? Math.max(1, score) : 0);
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthAlert(panels.login);
  clearFormErrors(loginForm);

  const email = loginForm.elements.email.value.trim().toLowerCase();
  const password = loginForm.elements.password.value;
  const details = [];
  if (!email) details.push({ field: 'email', message: 'Email is required.' });
  else if (!EMAIL_RE.test(email)) details.push({ field: 'email', message: 'Enter a valid email address.' });
  if (!password) details.push({ field: 'password', message: 'Password is required.' });
  if (details.length) {
    showFormErrors(loginForm, details);
    return;
  }

  const submit = document.getElementById('login-submit');
  setBusy(submit, true);
  try {
    const user = await login(email, password);
    toast(`Welcome back, ${user.student ? user.student.full_name : user.username}.`, 'success', 2200);
    const next = safeNextPath();
    const target = next || dashboardPath(user.role);
    setTimeout(() => window.location.assign(target), 280);
  } catch (err) {
    setBusy(submit, false);
    if (Array.isArray(err.details) && err.details.length) {
      showFormErrors(loginForm, err.details);
    }
    setAuthAlert(panels.login, errorMessage(err));
  }
});

function collectRegistration() {
  const value = (name) => String(registerForm.elements[name].value || '').trim();
  return {
    username: value('username'),
    email: value('email').toLowerCase(),
    password: registerForm.elements.password.value,
    full_name: value('full_name'),
    enrollment_no: value('enrollment_no').toUpperCase(),
    course: value('course'),
    semester: value('semester'),
    ...(value('section') ? { section: value('section') } : {})
  };
}

function validateRegistration(payload) {
  const details = [];
  if (!/^\S.*\S$/.test(payload.full_name) || payload.full_name.length < 2) {
    details.push({ field: 'full_name', message: 'Enter your full name (at least 2 characters).' });
  }
  if (!USERNAME_RE.test(payload.username)) {
    details.push({ field: 'username', message: 'Use 3-50 letters, numbers, dots, dashes or underscores.' });
  }
  if (!EMAIL_RE.test(payload.email)) {
    details.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (payload.enrollment_no.length < 3) {
    details.push({ field: 'enrollment_no', message: 'Enter your enrollment number.' });
  }
  if (payload.course.length < 2) {
    details.push({ field: 'course', message: 'Enter your course name.' });
  }
  const semester = Number(payload.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    details.push({ field: 'semester', message: 'Select a semester between 1 and 12.' });
  }
  if (payload.password.length < 8) {
    details.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  } else if (!(/[A-Za-z]/.test(payload.password) && /\d/.test(payload.password))) {
    details.push({ field: 'password', message: 'Password must include at least one letter and one number.' });
  }
  return details;
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthAlert(panels.register);
  clearFormErrors(registerForm);

  const payload = collectRegistration();
  const details = validateRegistration(payload);
  if (details.length) {
    showFormErrors(registerForm, details);
    return;
  }

  const submit = document.getElementById('register-submit');
  setBusy(submit, true);
  try {
    const data = await register({ ...payload, semester: Number(payload.semester) });
    setBusy(submit, false);
    registerForm.classList.add('hidden');
    registerSuccess.classList.remove('hidden');
    if (data && data.message) {
      const message = registerSuccess.querySelector('p');
      if (message) message.textContent = `${data.message} You can switch back to sign in once an administrator has approved you.`;
    }
    toast('Registration received. An administrator must approve the account.', 'success');
  } catch (err) {
    setBusy(submit, false);
    if (Array.isArray(err.details) && err.details.length) {
      showFormErrors(registerForm, err.details);
    }
    setAuthAlert(panels.register, errorMessage(err));
  }
});

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    await logout();
  });
});

async function boot() {
  initThemeToggle();
  initReveals();
  initTilt();
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  const nav = document.getElementById('landing-nav');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const stage = document.querySelector('[data-scene="network"]');
  if (stage) {
    initParticleNetwork(stage).catch(() => {
      // The CSS gradient hero remains a complete fallback.
      stage.classList.add('scene-stage--fallback');
    });
  }

  if (safeNextPath()) activateTab('login');

  try {
    const user = await getCurrentUser();
    if (user) {
      authTabs.classList.add('hidden');
      panels.login.classList.add('hidden');
      panels.register.classList.add('hidden');
      signedInPanel.classList.remove('hidden');
      authTitle.textContent = 'You are signed in';
      authSub.textContent = 'Continue to your workspace, or sign out to switch accounts.';
      const name = signedInPanel.querySelector('[data-signed-in-name]');
      if (name) name.textContent = user.student ? user.student.full_name : user.username;
      const link = signedInPanel.querySelector('[data-dashboard-link]');
      if (link) link.setAttribute('href', dashboardPath(user.role));
    }
  } catch {
    // A network hiccup should not block the sign-in form.
  }
}

boot();
