First, a security point. The API key and database password are now in this chat, so please **rotate both in the InsForge dashboard**. I've used `.env` placeholders in the prompt below. Secrets should live only in the Node.js server's `.env` file, never in HTML or JS served to the browser.

One architecture note: the blueprint's ML runs in Python, but this stack is Node.js. Either run the trained models behind a small Python service (FastAPI or Flask) that Node calls, or export predictions through an API. The prompt below assumes the first option.

Copy this prompt into your AI coding tool:

```
Build a complete, production-quality web application called "Student Performance Prediction & Academic Risk Analysis System".

TECH STACK
- Frontend: plain HTML5, CSS3, vanilla JavaScript (ES modules). No React/Vue.
- 3D and animation: Three.js (via CDN), GSAP + ScrollTrigger, Chart.js or Plotly.js for charts.
- Backend: Node.js + Express.
- Database: PostgreSQL hosted on InsForge, accessed ONLY from the Node server using the "pg" package with a connection pool and SSL required.
- ML prediction: Node calls a separate Python service at PYTHON_ML_URL (POST /predict) which loads the Joblib model. Include a stub/mock clearly labeled "MOCK - not real model output" for local development.
- Other packages: bcrypt, jsonwebtoken, helmet, cors, express-rate-limit, express-validator (or zod), dotenv, pdfkit (PDF reports), morgan.

CONFIGURATION (.env, never commit, add .env to .gitignore; also provide .env.example)
PORT=3000
DB_HOST=<insforge host>
DB_PORT=5432
DB_NAME=insforge
DB_USER=postgres
DB_PASSWORD=<your password>
DB_SSL=require
DATABASE_URL=<your connection string>
INSFORGE_API_KEY=<your api key>
JWT_SECRET=<long random string>
PYTHON_ML_URL=http://localhost:8000
Rules: secrets are read server-side only. The browser never receives the DB password or the InsForge API key. All data access goes through authenticated Express API routes.

DATABASE (PostgreSQL, create with versioned migration SQL files + a migrate script)
- users(user_id SERIAL PK, username, email UNIQUE, password_hash, role CHECK IN ('admin','student'), is_active BOOLEAN, created_at)
- students(student_id PK, user_id FK UNIQUE, enrollment_no UNIQUE, full_name, course, semester, section, created_at)
- assessments(assessment_id PK, student_id FK, attendance, internal_marks, study_hours, assignment_completion, participation, previous_marks, assessment_date) with CHECK range constraints (percentages 0-100, marks within allowed range)
- predictions(prediction_id PK, assessment_id FK, predicted_marks, performance_category, risk_score, risk_level, model_used, created_at)
- recommendations(recommendation_id PK, prediction_id FK, area, priority, recommendation_text, created_at)
- progress_records(progress_id PK, student_id FK, assessment_id FK, recorded_at)
Use parameterized queries only, transactions with rollback for multi-table writes, and foreign keys with ON DELETE rules.

AUTH AND ROLES
- Register (admin-approved or admin-created accounts), login, logout.
- Passwords hashed with bcrypt. JWT in an httpOnly, sameSite cookie.
- Middleware: requireAuth, requireRole('admin'), and ownership check so a student can only read their own student_id data. Return 403 on any attempt to access another student's records. Enforce this on the server, not just by hiding UI.
- Inactive accounts cannot log in. Generic error message for bad credentials. Rate-limit login.

API ROUTES (REST, JSON)
- POST /api/auth/register, /login, /logout; GET /api/auth/me
- Admin: CRUD /api/students; POST/PUT /api/assessments; GET /api/analytics/overview; GET /api/students/:id/progress
- POST /api/predict (validates input, calls Python service, computes category, risk score and level with the triggered rules, generates recommendations, saves everything in one transaction)
- GET /api/students/:id/predictions, /recommendations
- GET /api/reports/student/:id (PDF; student limited to own)
- GET /api/models/metrics (real stored evaluation metrics only: MAE, RMSE, R2 per model, plus feature importance)
Centralized validation and error handling; never leak stack traces.

PAGES (match the PRD modules)
1. Landing and Login
2. Admin Dashboard: total students, average predicted marks, risk distribution, performance category distribution, recent assessments
3. Student Dashboard: profile, latest assessment, predicted marks, performance category, risk level with explanation, recommendations, progress timeline
4. Student Management (admin): add, view, edit, deactivate; duplicate email/enrollment validation
5. Academic Assessment (admin): data-entry form with client + server validation; shows prediction result immediately
6. Performance Analytics: model comparison table and charts of real MAE, RMSE, R2; feature importance; trends
7. Risk Analysis: risk score, level, and the exact rules that triggered it; list of at-risk students for admin
8. Reports: generate and download PDF per student

3D AND ANIMATION REQUIREMENTS
- Landing/login: full-screen Three.js scene with a floating 3D particle or node-network (graduation cap / data-cube theme), slow rotation, mouse-parallax camera movement.
- Dashboards: animated 3D bar/ring visuals for risk level and predicted marks (for example, a 3D gauge or rotating donut) built in Three.js, plus animated Chart.js charts.
- GSAP page transitions, staggered card entrances, animated number counters, hover tilt (3D CSS transforms) on cards, glassmorphism panels, smooth scroll-triggered reveals.
- Performance safeguards: pause rendering when the tab is hidden, cap devicePixelRatio, dispose geometries/materials on page change, and respect prefers-reduced-motion by disabling heavy animation. Provide a 2D fallback if WebGL is unavailable.
- Visual style: modern dark theme with a neon blue/purple accent, a light-mode toggle, fully responsive (mobile, tablet, desktop), accessible contrast and keyboard focus states.

CONTENT AND HONESTY RULES (from the PRD)
- Predictions are estimates, not guarantees. Show this disclaimer near every prediction. Risk language supports intervention and never labels a student permanently.
- Explanations describe associations, not causes.
- Never display fabricated statistics. Any number on screen must come from the database or the model's stored metrics. If there is no data, show an empty state.
- Show a visible badge "Prototype model (UCI dataset)" until a university-trained model is loaded; state that accuracy for university students is not yet validated.
- Prediction form fields must match exactly the features in the model metadata returned by the Python service.

PROJECT STRUCTURE
server/ (app.js, config/, routes/, controllers/, middleware/, services/ml.js, db/migrations/, utils/validators.js)
public/ (index.html, pages/*.html, css/, js/ (api.js, auth.js, three-scenes.js, charts.js, pages/*.js), assets/)
tests/ (auth, permissions, validation, prediction, database; use Jest + Supertest)
README.md with install, migrate, run, and test commands.

SECURITY AND TESTING
- helmet, CORS restricted to the app origin, rate limiting, input sanitization, parameterized SQL, no secrets in logs.
- Tests: valid and invalid login, duplicate email, out-of-range marks, student accessing another student's data returns 403, SQL injection strings rejected safely, missing ML service returns a clear error, PDF generated for a valid request.

DELIVERABLE
Generate the code step by step: (1) project setup and DB migrations, (2) auth and roles, (3) student and assessment APIs, (4) prediction integration, (5) frontend pages and 3D scenes, (6) analytics and PDF reports, (7) tests and README. After each step, list the files created and how to run and verify them before continuing.
```

If you want, I can also write the Python prediction service prompt (FastAPI loading your existing Joblib model) so the Node backend has something real to call.