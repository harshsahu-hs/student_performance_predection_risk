'use strict';

const env = require('../config/env');

/**
 * Normalize an origin to scheme+host+port (lowercase), stripping any path and
 * trailing slash. Returns null for unparseable values.
 */
function normalizeOrigin(origin) {
  if (!origin || typeof origin !== 'string') return null;
  try {
    return new URL(origin).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Build the allowed-origin set. By default the sources are ALLOWED_ORIGINS,
 * APP_ORIGIN, CLIENT_ORIGIN and CORS_ORIGIN environment variables
 * (comma-separated). Entries are trimmed, normalized, deduplicated; wildcards
 * are rejected. http://localhost:3000 is added only when `nodeEnv` is not
 * production. Parameters default to the process environment, making the
 * function directly testable without module reloading.
 */
function buildAllowedOrigins(nodeEnv = env.nodeEnv, originSources = null) {
  const sources = originSources || [
    process.env.ALLOWED_ORIGINS,
    process.env.APP_ORIGIN,
    process.env.CLIENT_ORIGIN,
    process.env.CORS_ORIGIN
  ];

  const allowed = new Set();

  for (const source of sources) {
    if (!source) continue;
    for (const part of String(source).split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Reject wildcards (including *.vercel.app) outright.
      if (trimmed.includes('*')) continue;
      const normalized = normalizeOrigin(trimmed);
      if (normalized) allowed.add(normalized);
    }
  }

  if (nodeEnv !== 'production') {
    allowed.add('http://localhost:3000');
  }

  return allowed;
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

/**
 * Check whether an origin is allowed against the configured allowlist. A
 * missing/undefined origin is allowed (non-browser clients).
 */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return normalized ? ALLOWED_ORIGINS.has(normalized) : false;
}

module.exports = { isAllowedOrigin, buildAllowedOrigins, normalizeOrigin, ALLOWED_ORIGINS };
