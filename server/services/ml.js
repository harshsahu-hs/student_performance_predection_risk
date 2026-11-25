const env = require('../config/env');
const { query } = require('../config/db');
const { HttpError } = require('../utils/httpError');

const MODEL_FEATURES = ['attendance', 'internal_marks', 'study_hours', 'previous_marks'];
let metadataCache = { at: 0, value: null };

function assertFeatures(features) {
  if (!Array.isArray(features) || !features.length) return false;
  return features.every((f) => f && typeof f.key === 'string' && typeof f.label === 'string'
    && typeof f.min === 'number' && typeof f.max === 'number');
}

async function storedMetadata() {
  const result = await query(
    `SELECT metadata, model_name, model_version
       FROM (
         SELECT metadata, model_name, metadata->>'model_version' AS model_version,
                is_active, trained_at
           FROM model_metrics
          ORDER BY is_active DESC, trained_at DESC
          LIMIT 1
       ) m`,
    []
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  if (!row.metadata || !assertFeatures(row.metadata.features)) return null;
  return row.metadata;
}

async function getMetadata({ force = false } = {}) {
  const now = Date.now();
  if (!force && metadataCache.value && now - metadataCache.at < 60_000) return metadataCache.value;

  let live = null;
  let liveError = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(env.ml.timeoutMs, 4000));
    const response = await fetch(`${env.ml.url}/metadata`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const meta = await response.json();
    if (!assertFeatures(meta.features)) throw new Error('metadata features are invalid');
    live = { metadata: meta, source: 'live', warning: null };
  } catch (err) {
    liveError = err;
  }

  if (live) {
    metadataCache = { at: now, value: live };
    return live;
  }

  const fallback = await storedMetadata();
  if (fallback) {
    const value = {
      metadata: fallback,
      source: 'stored',
      warning: 'The Python prediction service is offline. Showing the feature definitions stored with the last trained model.'
    };
    metadataCache = { at: now, value };
    return value;
  }

  throw new HttpError(503, 'ML_METADATA_UNAVAILABLE',
    'Model metadata is unavailable. Train the model and store its metrics, or start the Python ML service.',
    env.isTest ? { cause: liveError && liveError.message } : undefined);
}

function mockPredict(features) {
  // Deterministic development stub. It is NEVER presented as a real model.
  const score = (0.35 * features.previous_marks)
    + (0.30 * features.internal_marks)
    + (0.15 * features.attendance)
    + (0.20 * Math.min(100, features.study_hours * 6));
  return {
    predicted_marks: Math.round(Math.max(0, Math.min(100, score)) * 100) / 100,
    model_used: 'MOCK - not real model output',
    model_version: 'mock-development-stub',
    is_mock: true,
    is_prototype: true,
    university_validated: false,
    features_used: MODEL_FEATURES,
    feature_values: features
  };
}

async function predict(features) {
  if (env.ml.mock) return mockPredict(features);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ml.timeoutMs);
  let response;
  try {
    response = await fetch(`${env.ml.url}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err.name === 'AbortError';
    throw new HttpError(timedOut ? 504 : 503,
      timedOut ? 'ML_TIMEOUT' : 'ML_UNAVAILABLE',
      timedOut
        ? 'The prediction service timed out. No assessment or prediction was saved. Please try again.'
        : 'The prediction service is unavailable. No assessment or prediction was saved. Please try again.');
  }
  clearTimeout(timer);

  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const detail = body && body.detail;
    const message = typeof detail === 'string'
      ? detail
      : (detail && detail.message) || 'The prediction service returned an error. No prediction was saved.';
    throw new HttpError(502, 'ML_ERROR', message);
  }
  if (!body || typeof body.predicted_marks !== 'number' || !Number.isFinite(body.predicted_marks)
      || body.predicted_marks < 0 || body.predicted_marks > 100) {
    throw new HttpError(502, 'ML_INVALID_RESPONSE', 'The prediction service returned an invalid result. No prediction was saved.');
  }
  if (!body.model_used) {
    throw new HttpError(502, 'ML_INVALID_RESPONSE', 'The prediction service did not identify the model used.');
  }
  return {
    predicted_marks: Math.round(body.predicted_marks * 100) / 100,
    model_used: String(body.model_used).slice(0, 100),
    model_version: body.model_version ? String(body.model_version).slice(0, 100) : null,
    is_mock: Boolean(body.is_mock),
    is_prototype: body.is_prototype !== false,
    university_validated: Boolean(body.university_validated),
    features_used: Array.isArray(body.features_used) ? body.features_used : MODEL_FEATURES,
    feature_values: body.feature_values || features
  };
}

module.exports = { predict, getMetadata, MODEL_FEATURES, mockPredict, resetMetadataCache: () => { metadataCache = { at: 0, value: null }; } };
