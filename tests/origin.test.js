const request = require('supertest');
const app = require('../server/app');
const { normalizeOrigin, buildAllowedOrigins, isAllowedOrigin } = require('../server/utils/origins');

describe('normalizeOrigin', () => {
  it('normalizes trailing slash', () => {
    expect(normalizeOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('normalizes case differences', () => {
    expect(normalizeOrigin('HTTP://LOCALHOST:3000')).toBe('http://localhost:3000');
    expect(normalizeOrigin('Http://Localhost:3000')).toBe('http://localhost:3000');
  });

  it('returns null for invalid or missing input', () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin('not-a-url')).toBeNull();
  });

  it('preserves scheme, host and port', () => {
    expect(normalizeOrigin('https://studentperformance-orcin.vercel.app:443')).toBe(
      'https://studentperformance-orcin.vercel.app'
    );
  });
});

describe('buildAllowedOrigins', () => {
  const src = (overrides = {}) => ({
    ALLOWED_ORIGINS: overrides.ALLOWED_ORIGINS,
    APP_ORIGIN: overrides.APP_ORIGIN,
    CLIENT_ORIGIN: overrides.CLIENT_ORIGIN,
    CORS_ORIGIN: overrides.CORS_ORIGIN
  });

  const sources = (o) => [
    o.ALLOWED_ORIGINS, o.APP_ORIGIN, o.CLIENT_ORIGIN, o.CORS_ORIGIN
  ];

  it('allows configured origin', () => {
    const allowed = buildAllowedOrigins('production', sources(src({ ALLOWED_ORIGINS: 'https://studentperformance-orcin.vercel.app' })));
    expect(allowed.has('https://studentperformance-orcin.vercel.app')).toBe(true);
  });

  it('rejects disallowed origin', () => {
    const allowed = buildAllowedOrigins('production', sources(src({ ALLOWED_ORIGINS: 'https://example.com' })));
    expect(allowed.has('https://evil.example.com')).toBe(false);
  });

  it('normalizes trailing slash differences', () => {
    const allowed = buildAllowedOrigins('production', sources(src({ ALLOWED_ORIGINS: 'http://localhost:3000/' })));
    expect(allowed.has('http://localhost:3000')).toBe(true);
  });

  it('normalizes case differences', () => {
    const allowed = buildAllowedOrigins('production', sources(src({ ALLOWED_ORIGINS: 'HTTP://LOCALHOST:3000' })));
    expect(allowed.has(normalizeOrigin('Http://Localhost:3000'))).toBe(true);
  });

  it('rejects wildcards including *.vercel.app', () => {
    const allowed = buildAllowedOrigins('production', sources(src({ ALLOWED_ORIGINS: 'https://*.vercel.app' })));
    expect(allowed.has('https://studentperformance-orcin.vercel.app')).toBe(false);
  });

  it('excludes localhost in production', () => {
    const allowed = buildAllowedOrigins('production', sources(src({})));
    expect(allowed.has('http://localhost:3000')).toBe(false);
  });

  it('includes localhost in non-production', () => {
    const allowed = buildAllowedOrigins('test', sources(src({})));
    expect(allowed.has('http://localhost:3000')).toBe(true);
  });

  it('merges APP_ORIGIN, CLIENT_ORIGIN and CORS_ORIGIN', () => {
    const allowed = buildAllowedOrigins('production', sources(src({
      APP_ORIGIN: 'https://app.example.com',
      CLIENT_ORIGIN: 'https://client.example.com',
      CORS_ORIGIN: 'https://cors.example.com'
    })));
    expect(allowed.has('https://app.example.com')).toBe(true);
    expect(allowed.has('https://client.example.com')).toBe(true);
    expect(allowed.has('https://cors.example.com')).toBe(true);
  });
});

describe('isAllowedOrigin with default config', () => {
  it('allows missing origin', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
  });
});

describe('Origin middleware (HTTP)', () => {
  // In the test environment (NODE_ENV=test, no ALLOWED_ORIGINS) only
  // http://localhost:3000 is allowed.
  const allowedOrigin = 'http://localhost:3000';
  const disallowedOrigin = 'https://evil.example.com';

  it('allows request with allowed Origin header', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', allowedOrigin);
    expect(res.status).not.toBe(403);
  });

  it('rejects request with disallowed Origin header with 403 JSON', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', disallowedOrigin);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    // Test env is non-production, so the rejected origin is included.
    expect(res.body.error.message).toContain(disallowedOrigin);
  });

  it('allows request with no Origin header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(403);
  });

  it('login POST from the Vercel origin is allowed when configured', async () => {
    await jest.isolateModules(async () => {
      process.env.ALLOWED_ORIGINS = 'https://studentperformance-orcin.vercel.app';
      process.env.NODE_ENV = 'production';
      const isolatedApp = require('../server/app');
      const res = await request(isolatedApp)
        .post('/api/auth/login')
        .set('Origin', 'https://studentperformance-orcin.vercel.app')
        .send({ email: 'test@example.local', password: 'wrong-password-xyz' });
      // Invalid credentials -> 401, not 403 (origin was allowed).
      expect(res.status).not.toBe(403);
    });
  });
});
