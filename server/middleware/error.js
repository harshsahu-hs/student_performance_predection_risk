const env = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' }
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = Number(err.status || err.statusCode) || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON.';
  } else if (err.code === '23505') {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with these details already exists.';
  } else if (err.code === '23514') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'One or more values are outside the allowed range.';
  } else if (err.code === '23503') {
    status = 400;
    code = 'INVALID_REFERENCE';
    message = 'A referenced record does not exist.';
  } else if (err.code === '22P02') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'One or more values have an invalid format.';
  }

  if (status >= 500) {
    // Log only method, URL and the error name. No request bodies, cookies or
    // SQL parameters are ever written to logs.
    console.error(`[error] ${req.method} ${req.originalUrl} -> ${status} ${err.name || 'Error'}: ${err.message}`);
    if (!env.isTest && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    code = code === 'INTERNAL_ERROR' ? 'INTERNAL_ERROR' : code;
    message = 'An unexpected server error occurred. Please try again.';
    details = undefined;
  }

  if (!env.isTest && status >= 500) details = undefined;

  res.status(status).json({
    error: {
      code: String(code).toUpperCase(),
      message,
      ...(details ? { details } : {})
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
