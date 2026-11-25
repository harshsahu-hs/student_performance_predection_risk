import { get, post, ApiError } from './api.js';

export function dashboardPath(role) {
  return role === 'admin' ? '/pages/admin-dashboard.html' : '/pages/student-dashboard.html';
}

export async function getCurrentUser() {
  try {
    const data = await get('/api/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function login(email, password) {
  const data = await post('/api/auth/login', { email, password });
  return data.user;
}

export async function register(payload) {
  return post('/api/auth/register', payload);
}

export async function logout() {
  try { await post('/api/auth/logout', {}); } catch { /* the cookie is cleared client-side on navigation anyway */ }
  window.location.assign('/');
}

export function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next) return null;
  if (!next.startsWith('/pages/') || next.startsWith('//')) return null;
  if (!/^\/pages\/[A-Za-z0-9._-]+\.html$/.test(next)) return null;
  return next;
}

export function currentPathWithNext() {
  return `${window.location.pathname}${window.location.search}`;
}

export async function requireUser({ roles = null } = {}) {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(currentPathWithNext());
    window.location.replace(`/?next=${next}`);
    return null;
  }
  if (Array.isArray(roles) && roles.length && !roles.includes(user.role)) {
    window.location.replace(dashboardPath(user.role));
    return null;
  }
  return user;
}
