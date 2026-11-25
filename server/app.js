const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const { query, closePool } = require('./config/db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const assessmentRoutes = require('./routes/assessments');
const predictRoutes = require('./routes/predict');
const modelRoutes = require('./routes/models');
const analyticsRoutes = require('./routes/analytics');
const reportRoutes = require('./routes/reports');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');
const { sameOrigin } = require('./middleware/sameOrigin');

const app = express();
app.disable('x-powered-by');
if (env.isProduction) app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !env.allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Origin is not allowed.' } });
  }
  return next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());
app.use(sameOrigin);

if (!env.isTest) {
  morgan.token('request-id', (req) => req.id);
  app.use(morgan(':method :url :status :response-time ms req=:request-id', {
    skip: (req) => req.path === '/api/health'
  }));
}

app.get('/api/health', async (_req, res) => {
  let database = 'unavailable';
  try {
    await query('SELECT 1');
    database = 'connected';
  } catch (err) {
    console.error('[health] database check failed', {
      code: typeof err.code === 'string' ? err.code : 'UNKNOWN',
      name: typeof err.name === 'string' ? err.name : 'Error'
    });
    database = 'unavailable';
  }
  res.status(database === 'connected' ? 200 : 503).json({
    status: database === 'connected' ? 'ok' : 'degraded',
    service: 'student-performance-api',
    database,
    modelMode: env.ml.mock ? 'MOCK - not real model output' : 'live',
    time: new Date().toISOString()
  });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, {
  dotfiles: 'deny',
  index: 'index.html',
  maxAge: env.isProduction ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/api', notFoundHandler);
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(publicDir, '404.html'), (err) => {
      if (err) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found.' } });
    });
  }
  return notFoundHandler(req, res);
});
app.use(errorHandler);

let server;
if (require.main === module) {
  const port = process.env.PORT || env.port;
  server = app.listen(port, () => {
    console.log(`[server] listening on ${env.appOrigin} (port ${port})`);
    console.log(`[server] database schema: ${env.dbSchema || 'public'}`);
    console.log(`[server] ML mode: ${env.ml.mock ? 'MOCK - not real model output' : `live @ ${env.ml.url}`}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, closing...`);
    server.close(() => closePool().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
