class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = 'Authentication required.') => new HttpError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'You do not have access to this resource.') => new HttpError(403, 'FORBIDDEN', message);
const notFound = (message = 'Resource not found.') => new HttpError(404, 'NOT_FOUND', message);
const conflict = (message, details) => new HttpError(409, 'CONFLICT', message, details);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
