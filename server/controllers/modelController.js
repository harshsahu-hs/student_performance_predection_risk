const { query } = require('../config/db');
const { getMetadata } = require('../services/ml');
const { DISCLAIMER, BADGE } = require('../controllers/predictionController');

async function metrics(_req, res, next) {
  try {
    const result = await query(
      `SELECT metric_id, model_name,
              mae::float8 AS mae,
              rmse::float8 AS rmse,
              r2::float8 AS r2,
              feature_importance, dataset_name, dataset_rows, test_rows,
              trained_at, is_active, metadata
         FROM model_metrics
        ORDER BY is_active DESC, rmse ASC, model_name ASC`
    );

    const rows = result.rows;
    const active = rows.find((r) => r.is_active) || null;
    const activeMetadata = active && active.metadata && typeof active.metadata === 'object'
      ? active.metadata
      : null;

    return res.json({
      data: {
        empty: rows.length === 0,
        metrics: rows,
        active_model: active ? active.model_name : null,
        active_metadata: activeMetadata,
        feature_importance: active ? active.feature_importance : [],
        dataset: activeMetadata && activeMetadata.dataset ? activeMetadata.dataset : null,
        transformations: activeMetadata && activeMetadata.transformations ? activeMetadata.transformations : [],
        badge: BADGE,
        disclaimer: DISCLAIMER,
        university_validated: false,
        ...(rows.length === 0 ? {
          message: 'No stored model evaluation metrics yet. Train the model, then run npm run seed:metrics.'
        } : {})
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function metadata(_req, res, next) {
  try {
    const result = await getMetadata();
    res.set('Cache-Control', 'no-store');
    return res.json({
      data: {
        metadata: result.metadata,
        source: result.source,
        warning: result.warning,
        badge: BADGE,
        disclaimer: DISCLAIMER,
        university_validated: false
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { metrics, metadata };
