const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../config/db');

const METRICS_PATH = path.resolve(__dirname, '../../ml-service/model_metrics.json');

async function seedMetrics() {
  if (!fs.existsSync(METRICS_PATH)) {
    throw new Error('ml-service/model_metrics.json not found. Run `npm run ml:train` first.');
  }
  const payload = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));
  if (!Array.isArray(payload.metrics) || !payload.metrics.length) {
    throw new Error('model_metrics.json contains no evaluation metrics.');
  }
  if (!payload.metrics.some((m) => m.is_active)) {
    throw new Error('model_metrics.json must mark exactly one active model.');
  }

  await withTransaction(async (client) => {
    await client.query('UPDATE model_metrics SET is_active = FALSE WHERE is_active = TRUE');
    for (const metric of payload.metrics) {
      await client.query(
        `INSERT INTO model_metrics
           (model_name, mae, rmse, r2, feature_importance, dataset_name, dataset_rows,
            test_rows, trained_at, is_active, metadata)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb)
         ON CONFLICT (model_name) DO UPDATE SET
           mae = EXCLUDED.mae,
           rmse = EXCLUDED.rmse,
           r2 = EXCLUDED.r2,
           feature_importance = EXCLUDED.feature_importance,
           dataset_name = EXCLUDED.dataset_name,
           dataset_rows = EXCLUDED.dataset_rows,
           test_rows = EXCLUDED.test_rows,
           trained_at = EXCLUDED.trained_at,
           is_active = EXCLUDED.is_active,
           metadata = EXCLUDED.metadata`,
        [
          metric.model_name,
          metric.mae,
          metric.rmse,
          metric.r2,
          JSON.stringify(metric.feature_importance || []),
          metric.dataset_name || payload.dataset?.name || 'UCI Student Performance',
          metric.dataset_rows || payload.dataset?.rows || 0,
          metric.test_rows || payload.dataset?.test_rows || 0,
          metric.trained_at || payload.trained_at,
          Boolean(metric.is_active),
          JSON.stringify(metric.metadata || payload.metadata || {})
        ]
      );
    }
  });

  const active = payload.metrics.find((m) => m.is_active);
  console.log(`[seed:metrics] stored ${payload.metrics.length} model evaluations; active: ${active.model_name}`);
}

if (require.main === module) {
  seedMetrics()
    .then(async () => { await pool.end(); process.exit(0); })
    .catch(async (err) => {
      console.error(`[seed:metrics] ${err.message}`);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seedMetrics };
