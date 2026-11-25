# Student Performance Prediction & Academic Risk Analysis System

A production-quality prototype for student performance prediction and academic risk analysis.
Built with **Node.js + Express**, **PostgreSQL on InsForge**, a **Python ML service** (FastAPI + Joblib),
and a **vanilla HTML/CSS/JS frontend** with Three.js, GSAP, and Chart.js.

> **Honesty notice:** Predictions are estimates, not guarantees. The prototype model is trained on the public
> UCI Student Performance dataset (secondary-school students in Portugal). Accuracy for university students has
> **not yet been validated**. Risk indicators describe associations in the prototype data, not causes, and are
> never a permanent label for a student.

---

## Project structure

```
student performance/
├── .env                    # Actual secrets (gitignored - never commit)
├── .env.example            # Template with required variables
├── .gitignore
├── package.json
├── README.md
├── prd.md
├── prompt.md
├── public/                 # Frontend (served by Express)
│   ├── 404.html
│   ├── index.html          # Landing + login/registration (Three.js particle network)
│   ├── css/
│   │   ├── base.css        # Design tokens, base styles, accessibility
│   │   ├── app.css         # Shell, dashboard, cards, tables, forms
│   │   └── landing.css     # Landing page sections
│   ├── js/
│   │   ├── theme-init.js   # Synchronous theme bootstrap (dark/light)
│   │   ├── api.js          # Fetch client + file download helper
│   │   ├── auth.js         # Auth helpers (login, register, logout, requireUser)
│   │   ├── ui.js           # Shared UI: toasts, modals, badges, counters, tilt, reveals
│   │   ├── shell.js        # Sidebar/topbar shell + GSAP page transitions
│   │   ├── charts.js       # Chart.js wrappers (doughnut, bar, line, theme-aware)
│   │   ├── three-scenes.js # Three.js particle network + ring gauges (WebGL fallback)
│   │   ├── landing.js      # Landing page logic
│   │   ├── admin-dashboard.js
│   │   ├── student-dashboard.js
│   │   ├── students.js     # Student management (CRUD, status, delete)
│   │   ├── assessments.js  # Academic assessment + prediction (form from metadata)
│   │   ├── analytics.js    # Performance analytics (model comparison + charts)
│   │   ├── ml-metadata.js  # Model feature definitions & transformations
│   │   ├── risk.js         # Risk analysis (at-risk students)
│   │   └── reports.js      # PDF report preview & download
│   └── pages/
│       ├── admin-dashboard.html
│       ├── student-dashboard.html
│       ├── students.html
│       ├── assessments.html
│       ├── analytics.html
│       ├── ml-metadata.html
│       ├── risk.html
│       └── reports.html
├── server/                 # Backend (Express)
│   ├── app.js              # Express app, middleware, route mounting, static files
│   ├── config/
│   │   ├── env.js          # Environment + InsForge connection (server-side only)
│   │   └── db.js           # pg pool with SSL, transactions, search_path
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── studentController.js
│   │   ├── assessmentController.js
│   │   ├── predictionController.js
│   │   ├── analyticsController.js
│   │   ├── modelController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   ├── auth.js         # requireAuth, requireRole, requireSelfOrAdmin, JWT cookie
│   │   ├── error.js        # Centralized error handler (no stack traces)
│   │   ├── rateLimit.js    # Login/api/predict/report rate limiting
│   │   ├── sameOrigin.js   # CSRF-style origin check for mutating requests
│   │   └── validate.js     # Zod validation middleware
│   ├── routes/
│   │   ├── auth.js
│   │   ├── students.js
│   │   ├── assessments.js
│   │   ├── predict.js
│   │   ├── models.js
│   │   ├── analytics.js
│   │   └── reports.js
│   ├── services/
│   │   ├── ml.js           # Python ML client + mock stub
│   │   ├── risk.js         # Transparent risk rules + recommendations
│   │   ├── pdf.js          # PDFKit report layout
│   │   └── authAudit.js    # Auth event logging (never blocks auth)
│   ├── db/
│   │   ├── migrate.js      # Versioned migration runner
│   │   ├── setup-test-db.js# Test schema setup
│   │   ├── seed-admin.js   # Seed administrator
│   │   ├── seed-metrics.js # Seed stored model evaluation metrics
│   │   └── migrations/
│   │       ├── 001_init.sql
│   │       └── 002_auth_hardening.sql
│   └── utils/
│       ├── asyncHandler.js
│       ├── httpError.js
│       └── validators.js   # Zod schemas + sanitization
├── ml-service/             # Python ML service (FastAPI)
│   ├── app.py              # /predict, /metadata, /health, /metrics
│   ├── train_model.py      # UCI training + real evaluation metrics
│   ├── model_metrics.json  # Stored evaluation metrics (generated)
│   ├── .venv/              # Virtual env (gitignored)
│   └── data/               # UCI datasets (gitignored)
└── tests/                  # Jest + Supertest
    ├── setup.js            # Test schema + seed
    ├── auth.test.js
    ├── permissions.test.js
    ├── validation.test.js
    ├── prediction.test.js
    └── pdf.test.js
```

---

## Prerequisites

- **Node.js** >= 20
- **Python** 3.10+ (for the ML service)
- **InsForge PostgreSQL** instance (connection string + API key)
- The UCI datasets (`student-mat.csv`, `student-por.csv`) for training — included in `ml-service/data/` or fetched by `train_model.py`

---

## Step 0 — Install dependencies

```bash
cd "C:\Users\Harsh\Desktop\student performance"
npm install
```

This installs Express, pg, bcrypt, jsonwebtoken, zod, pdfkit, helmet, cors, express-rate-limit, morgan, dotenv, and Jest + Supertest.

---

## Step 1 — Configure environment

Copy the example file and fill in your InsForge credentials:

```bash
copy .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | InsForge PostgreSQL connection string (SSL required) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Fallback DB params if `DATABASE_URL` is not set |
| `DB_SSL` | `require` (InsForge requires SSL) |
| `INSFORGE_API_KEY` | InsForge project API key (server-side only) |
| `PORT` | `3000` |
| `APP_ORIGIN` | `http://localhost:3000` (used for CORS) |
| `JWT_SECRET` | Long random string (32+ chars) |
| `JWT_EXPIRES_IN` | `8h` |
| `COOKIE_SECURE` | `false` for local dev, `true` behind HTTPS |
| `ADMIN_EMAIL` | `admin@studentpredict.local` |
| `ADMIN_PASSWORD` | Strong password (10+ chars) |
| `PYTHON_ML_URL` | `http://localhost:8000` |
| `ML_MOCK` | `false` for live model, `true` for dev stub |
| `ML_TIMEOUT_MS` | `8000` |

**Never commit `.env`.** It is gitignored. `.env.example` is committed as a template.

---

## Step 2 — Run database migrations

The InsForge project "Studentpro" (`4843b884-dfe8-4fe2-9bb3-c10454564429`) is already linked. Migrations are versioned SQL files in `server/db/migrations/`.

```bash
# Create tables and apply migrations
npm run migrate

# Seed the administrator account (reads ADMIN_EMAIL / ADMIN_PASSWORD from .env)
npm run seed:admin
```

The admin is seeded with email `admin@studentpredict.local` and the password from `.env`. The password is **never logged**.

To verify the connection:

```bash
node -e "const {query} = require('./server/config/db'); query('SELECT version()').then(r => console.log(r.rows[0].version)).catch(e => console.error(e))"
```

---

## Step 3 — Train the ML model (optional but recommended)

The model is trained on the real UCI Student Performance dataset (1,044 records). This generates `ml-service/model_metrics.json` and `ml-service/artifacts/student_performance_model.joblib`.

```bash
npm run ml:train
```

Training compares LinearRegression, RandomForest, and GradientBoosting. LinearRegression is selected as the active model (MAE 4.6736, RMSE 7.8896, R² 0.8231 on held-out data).

Then store the metrics in the database:

```bash
npm run seed:metrics
```

Without this step, `/api/models/metrics` returns empty and the UI shows an empty state (no fabricated numbers).

---

## Step 4 — Start the Python ML service

The Node backend calls `POST http://localhost:8000/predict` on the Python service.

```bash
# Using the project virtual environment (Windows PowerShell)
ml-service\.venv\Scripts\python.exe -m uvicorn app:app --app-dir ml-service --host 127.0.0.1 --port 8000
```

Verify it is running:

```bash
# Health
curl http://localhost:8000/health
# Metadata (feature definitions exactly matching the prediction form)
curl http://localhost:8000/metadata
```

Expected `/health` response:
```json
{"status":"ok","model_loaded":true,"artifact":"student_performance_model.joblib","is_prototype":true,"university_validated":false}
```

If the Python service is unavailable and `ML_MOCK=true`, the backend uses a clearly labeled stub ("MOCK - not real model output") and no assessment/prediction is written as real model output.

---

## Step 5 — Start the Node server

```bash
# Production mode
npm start

# Development mode with auto-restart
npm run dev
```

The server listens on `http://localhost:3000`. Verify:

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{"status":"ok","service":"student-performance-api","database":"connected","modelMode":"live","time":"..."}
```

Open the app: **http://localhost:3000**

---

## Step 6 — Run the test suite

Tests use a disposable `student_performance_test` schema on the same InsForge database (never the public schema). `ML_MOCK=true` is set so the prediction pipeline works without the Python service.

```bash
npm test
```

**Expected:** 5 test suites, 28 tests, all passing:
- `auth.test.js` — login/logout/register/me, generic 401, httpOnly cookie
- `permissions.test.js` — student 403 on another student's records, admin access
- `validation.test.js` — out-of-range marks, missing fields, future dates, SQL injection
- `prediction.test.js` — end-to-end predict → DB rows, metrics, analytics
- `pdf.test.js` — PDF generation (`%PDF`), ownership, 404/403

---

## Step 7 — Using the application

### Pages

| # | Page | URL | Description |
|---|------|-----|-------------|
| 1 | Landing & Login | `/` | Marketing site, sign-in, registration (admin-approved) |
| 2 | Admin Dashboard | `/pages/admin-dashboard.html` | Totals, risk distribution, category distribution, recent assessments, 3D gauge |
| 3 | Student Dashboard | `/pages/student-dashboard.html` | Profile, latest estimate, risk level, recommendations, timeline |
| 4 | Student Management | `/pages/students.html` | Add/view/edit/deactivate students, duplicate validation |
| 5 | Academic Assessment | `/pages/assessments.html` | Data-entry form, run prediction, see result immediately |
| 6 | Performance Analytics | `/pages/analytics.html` | Model comparison (MAE/RMSE/R²), feature importance, trends |
| 7 | Risk Analysis | `/pages/risk.html` | At-risk students, risk levels, triggered rules |
| 8 | Reports | `/pages/reports.html` | PDF report per student |

### Default admin account

- **Email:** `admin@studentpredict.local`
- **Password:** the value of `ADMIN_PASSWORD` in `.env`

New student accounts created via registration are **inactive until approved** by an administrator. Accounts created directly by an administrator are active immediately.

### Model honesty features

- Visible **"Prototype model (UCI dataset)"** badge near every prediction
- Disclaimer: "Predictions are estimates, not guarantees..." near every result
- "Accuracy for university students has not yet been validated" stated on analytics, metadata, and reports
- Risk language: "early-warning signal," "supportive check-in," "not a label"
- Associations not causes: explanations describe correlations, not causation
- Empty states when no data exists (no fabricated statistics)
- Real stored metrics only (MAE, RMSE, R², feature importance)

---

## Security

- Secrets (DB password, JWT secret, InsForge API key) are **server-side only** in `.env` (gitignored)
- JWT stored in **httpOnly, sameSite=Lax** cookie
- Passwords hashed with **bcrypt (cost 12)**
- Generic "Invalid email or password" message (no user enumeration)
- Login **rate-limited** (10 attempts per 15 minutes)
- **Role-based access**: admin vs student
- **Ownership enforcement**: students can only access their own `student_id` data (403 for others)
- **Inactive accounts** cannot log in
- All SQL is **parameterized**; transactions with rollback for multi-table writes
- `helmet` (CSP, referrer policy), `cors` restricted to app origin
- `morgan` request logging (no secrets in logs)

---

## npm scripts

| Script | Purpose |
|---|---|
| `npm start` | Start the Express server (production) |
| `npm run dev` | Start with `--watch` (development) |
| `npm run migrate` | Run versioned database migrations |
| `npm run seed:admin` | Seed the administrator account |
| `npm run seed:demo` | Seed demo data (if available) |
| `npm run seed:metrics` | Store model evaluation metrics in DB |
| `npm run setup:test-db` | Create test schema + run migrations |
| `npm run ml:train` | Train the UCI model and generate metrics |
| `npm run ml:serve` | Start the Python ML service |
| `npm test` | Run Jest + Supertest suite |
| `npm run test:watch` | Watch mode for tests |

---

## Deployment notes

- Set `NODE_ENV=production` and `COOKIE_SECURE=true` behind HTTPS
- `APP_ORIGIN` must match your frontend URL for CORS
- The InsForge API key is **not** used by the app directly (direct `pg` access only); it is kept in `.env` for reference
- `ml-service/.venv` and `ml-service/artifacts/*.joblib` are gitignored; generate them on the deployment host
- First InsForge connection can be slow (~10s); subsequent queries are ~0.5s. The pool timeout is 15s.

---

## Test credentials (do not use in production)

The admin password is stored in `.env` as `ADMIN_PASSWORD` and is never printed or logged. Change it before any non-local deployment.

---

## License

Prototype for academic early-warning workflows. Not for high-stakes academic decisions.
