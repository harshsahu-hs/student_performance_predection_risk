const { sanitizeValue } = require('../utils/validators');

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message
  }));
}

/**
 * validate({ body, params, query }) - every supplied schema is parsed and the
 * sanitized/coerced result replaces the request property.
 */
function validate(schemas) {
  return (req, _res, next) => {
    try {
      for (const source of ['body', 'params', 'query']) {
        const schema = schemas[source];
        if (!schema) continue;
        const input = source === 'body' ? sanitizeValue(req[source] || {}) : req[source];
        const result = schema.safeParse(input);
        if (!result.success) {
          return next(Object.assign(new Error('Validation failed.'), {
            status: 400,
            code: 'VALIDATION_ERROR',
            details: formatIssues(result.error)
          }));
        }
        if (source === 'query') {
          // Express 4 exposes a getter-only query; keep the schema result locally.
          req.validatedQuery = result.data;
        } else {
          req[source] = result.data;
        }
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { validate, formatIssues };
