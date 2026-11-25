import { initShell } from './shell.js';
import { get, errorMessage } from './api.js';
import {
  icon, escapeHtml, formatNumber, formatDate, emptyStateHtml, errorStateHtml, toast
} from './ui.js';

const IDENTITY = document.getElementById('model-identity');
const IDENTITY_SUB = document.getElementById('model-identity-sub');
const FEATURES = document.getElementById('features-wrap');
const TRANSFORMATIONS = document.getElementById('transformations-wrap');
const TARGET = document.getElementById('target-wrap');
const BADGE = document.getElementById('metadata-badge');

async function load() {
  try {
    const data = await get('/api/ml/metadata');
    const meta = data.metadata || {};
    const source = data.source || 'unknown';

    IDENTITY_SUB.textContent = `Source: ${source === 'live' ? 'Python ML service (live)' : 'Stored evaluation record (service offline)'}`;
    BADGE.title = meta.disclaimer || 'Prototype model trained on public UCI data';

    IDENTITY.innerHTML = `
      <div class="detail-list">
        <div class="detail-row"><span class="detail-row__label">Model version</span><span class="detail-row__value font-mono">${escapeHtml(meta.model_version || '—')}</span></div>
        <div class="detail-row"><span class="detail-row__label">Active model</span><span class="detail-row__value">${escapeHtml(meta.active_model || '—')}</span></div>
        <div class="detail-row"><span class="detail-row__label">Model type</span><span class="detail-row__value">${escapeHtml(meta.model_type || '—')}</span></div>
        <div class="detail-row"><span class="detail-row__label">Is prototype</span><span class="detail-row__value">${Boolean(meta.is_prototype) ? 'Yes' : 'No'}</span></div>
        <div class="detail-row"><span class="detail-row__label">University validated</span><span class="detail-row__value text-danger">${Boolean(meta.university_validated) ? 'Yes' : 'No — not yet validated'}</span></div>
        <div class="detail-row"><span class="detail-row__label">Trained</span><span class="detail-row__value">${formatDate(meta.trained_at)}</span></div>
        <div class="detail-row"><span class="detail-row__label">Artifact</span><span class="detail-row__value font-mono">${escapeHtml(meta.artifact || '—')}</span></div>
      </div>
      <div class="disclaimer-note mt-4">${icon('info')}<span>${escapeHtml(meta.disclaimer || 'Predictions are estimates, not guarantees.')}</span></div>`;

    const features = meta.features || [];
    if (!features.length) {
      FEATURES.innerHTML = emptyStateHtml({ title: 'No feature definitions', message: 'The model metadata does not list input features.', iconName: 'sliders' });
    } else {
      FEATURES.innerHTML = `<div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Label</th>
              <th scope="col">Unit</th>
              <th scope="col">Min</th>
              <th scope="col">Max</th>
              <th scope="col">Step</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            ${features.map((f) => `<tr>
              <td class="font-mono nowrap">${escapeHtml(f.key)}</td>
              <td><strong>${escapeHtml(f.label)}</strong></td>
              <td class="font-mono">${escapeHtml(f.unit || '')}</td>
              <td class="font-mono">${f.min != null ? f.min : '—'}</td>
              <td class="font-mono">${f.max != null ? f.max : '—'}</td>
              <td class="font-mono">${f.step != null ? f.step : '—'}</td>
              <td class="text-sm text-muted">${escapeHtml(f.help || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted mt-3">${icon('info')}<span>These fields must match exactly the inputs accepted by the prediction form.</span></p>`;
    }

    const transformations = meta.transformations || [];
    if (!transformations.length) {
      TRANSFORMATIONS.innerHTML = emptyStateHtml({ title: 'No transformations recorded', message: 'Feature mapping is not documented in the stored metadata.', iconName: 'sliders' });
    } else {
      TRANSFORMATIONS.innerHTML = `<div class="transformation-list">
        ${transformations.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
      </div>`;
    }

    const target = meta.target || {};
    TARGET.innerHTML = `
      <div class="detail-list">
        <div class="detail-row"><span class="detail-row__label">Key</span><span class="detail-row__value font-mono">${escapeHtml(target.key || 'predicted_marks')}</span></div>
        <div class="detail-row"><span class="detail-row__label">Label</span><span class="detail-row__value">${escapeHtml(target.label || 'Predicted marks')}</span></div>
        <div class="detail-row"><span class="detail-row__label">Min</span><span class="detail-row__value font-mono">${target.min != null ? target.min : '—'}</span></div>
        <div class="detail-row"><span class="detail-row__label">Max</span><span class="detail-row__value font-mono">${target.max != null ? target.max : '—'}</span></div>
      </div>`;
  } catch (err) {
    IDENTITY.innerHTML = errorStateHtml(errorMessage(err), 'metadata-retry');
    FEATURES.innerHTML = errorStateHtml(errorMessage(err), 'features-retry');
    TRANSFORMATIONS.innerHTML = errorStateHtml(errorMessage(err), 'transformations-retry');
    TARGET.innerHTML = errorStateHtml(errorMessage(err), 'target-retry');
    ['metadata-retry', 'features-retry', 'transformations-retry', 'target-retry'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.addEventListener('click', () => window.location.reload());
    });
  }
}

async function boot() {
  const user = await initShell({
    pageKey: 'analytics',
    title: 'Model metadata',
    eyebrow: 'Admin workspace',
    roles: ['admin']
  });
  if (!user) return;
  load();
}

boot();
