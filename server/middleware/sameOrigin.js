const env = require('../config/env');

function sameOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const referer = req.get('referer');
  const candidates = [origin, referer].filter(Boolean);
  if (!candidates.length) return next(); // non-browser client (curl/server-to-server)

  for (const value of candidates) {
    try {
      const url = new URL(value);
      if (env.allowedOrigins.includes(url.origin)) return next();
    } catch {
      return next(Object.assign(new Error('Invalid request origin.'), { status: 403, code: 'FORBIDDEN' }));
    }
  }
  return next(Object.assign(new Error('Cross-origin request blocked.'), { status: 403, code: 'FORBIDDEN' }));
}

module.exports = { sameOrigin };
