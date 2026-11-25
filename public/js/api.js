export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', details = undefined } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function api(path, { method = 'GET', body, query, headers = {}, signal } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', { status: 0, code: 'NETWORK_ERROR' });
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }

  if (!response.ok) {
    const info = payload && payload.error ? payload.error : {};
    throw new ApiError(info.message || `Request failed (${response.status}).`, {
      status: response.status,
      code: info.code || 'REQUEST_FAILED',
      details: info.details
    });
  }

  if (!payload) return null;
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

export const get = (path, options = {}) => api(path, { ...options, method: 'GET' });
export const post = (path, body, options = {}) => api(path, { ...options, method: 'POST', body });
export const put = (path, body, options = {}) => api(path, { ...options, method: 'PUT', body });
export const patch = (path, body, options = {}) => api(path, { ...options, method: 'PATCH', body });
export const del = (path, options = {}) => api(path, { ...options, method: 'DELETE' });

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try { return decodeURIComponent(utf8[1]); } catch { /* ignore */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

export async function downloadFile(path, fallbackName = 'report.pdf') {
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', { status: 0, code: 'NETWORK_ERROR' });
  }
  if (!response.ok) {
    let message = `Download failed (${response.status}).`;
    try {
      const payload = await response.json();
      if (payload && payload.error && payload.error.message) message = payload.error.message;
    } catch { /* not JSON */ }
    throw new ApiError(message, { status: response.status, code: 'DOWNLOAD_FAILED' });
  }
  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return filename;
}

export function errorMessage(err) {
  if (!err) return 'Something went wrong.';
  if (err.name === 'ApiError') return err.message;
  return err.message || 'Something went wrong.';
}
