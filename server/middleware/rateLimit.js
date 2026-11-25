const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const jsonHandler = (message) => (req, res) => {
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message }
  });
};

const make = ({ windowMs, limit, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: jsonHandler(message)
  });

const loginLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.'
});

const registerLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  message: 'Too many registration attempts. Please try again later.'
});

const apiLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please slow down.'
});

const predictLimiter = make({
  windowMs: 60 * 1000,
  limit: 30,
  message: 'Too many prediction requests. Please wait a moment.'
});

const reportLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: 'Too many report requests. Please wait a moment.'
});

module.exports = { loginLimiter, registerLimiter, apiLimiter, predictLimiter, reportLimiter };
