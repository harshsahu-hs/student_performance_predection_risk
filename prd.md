Student Performance Prediction & Academic Risk Analysis System
Product Requirements Document (PRD) and Architecture Specification
Version 1.0 | Status: Draft for review | Stack: Python 3.13, Streamlit, SQLite, scikit-learn
Part A: Product Requirements Document
1. Overview
1.1 Purpose
This system is a web-based application that predicts a student's expected marks using machine learning, classifies performance, estimates academic risk, and generates personalized improvement recommendations. It supports early academic intervention at the university and gives students visibility into their own progress.
1.2 Project Status and Continuity
Development is already underway. Dataset preparation, model training, prediction, risk analysis, recommendations and an initial database exist. This document defines the target state. It does not require restarting or replacing working code. All changes are incremental, tested before integration, and schema changes go through controlled migrations.
1.3 Problem Statement
Academic risk is often noticed only after final results. Faculty lack a simple tool that combines assessment data, predicted outcomes and actionable guidance, and students lack a clear view of where they stand and what to improve.
1.4 Goals
• Predict expected marks from validated academic inputs.
• Classify performance and estimate risk level with transparent rules.
• Generate personalized, explainable recommendations.
• Provide role-based dashboards for administrators and students.
• Track progress across assessments over time.
• Produce downloadable PDF reports per student.
• Protect student data through authentication, hashing and access control.
1.5 Non-Goals (Current Release)
• Claiming proven accuracy for university students while using the public UCI dataset.
• Causal claims (the system describes associations, not causes).
• Permanent labelling of students; risk scores support intervention only.
• Integration with external ERP/LMS systems.
• Mobile-native apps.
2. Users and Roles
Role
Description
Key permissions
Administrator
Faculty or academic staff managing the system
Manage students and accounts; enter and update assessments; run predictions; view risk analysis and overall statistics; monitor progress; generate reports
Student
Learner viewing own data
View own profile, assessments, predictions, risk and recommendations; track previous assessments; download own report
Hard rule: a student must never view or modify another student's records.
3. Functional Requirements
ID
Requirement
Description
Priority
FR-01
User registration
Register authorized users
Must
FR-02
Login
Authenticate users securely
Must
FR-03
Role management
Separate admin and student permissions
Must
FR-04
Student management
Add, view, update and manage profiles
Must
FR-05
Academic data entry
Record academic information
Must
FR-06
Performance prediction
Predict expected marks using ML
Must
FR-07
Model comparison
Compare four regression algorithms
Must
FR-08
Performance classification
Assign performance categories
Must
FR-09
Risk analysis
Estimate academic risk level
Must
FR-10
Recommendations
Generate personalized suggestions
Must
FR-11
Admin dashboard
Overall academic statistics
Should
FR-12
Student dashboard
Individual performance view
Should
FR-13
Progress tracking
Compare assessments over time
Should
FR-14
Visualization
Charts and analytical summaries
Should
FR-15
PDF reports
Downloadable student reports
Should
3.1 Acceptance Criteria (Key Requirements)
FR-02 Login: Valid credentials open the role-appropriate dashboard; invalid credentials are rejected with a generic error; inactive accounts cannot log in.
FR-05 Data entry: Missing values and out-of-range values (for example, marks or percentages outside allowed limits) are rejected with a clear message and nothing is saved.
FR-06 Prediction: The prediction form supplies exactly the features the loaded model expects. A missing or corrupt model file produces a clear error, not a crash.
FR-07 Model comparison: All four models are trained on the same split and reported with real calculated MAE, RMSE and R². No illustrative or invented numbers are ever displayed.
FR-09 Risk analysis: The risk score, level and the specific rules that triggered it are visible to the user.
FR-15 PDF reports: The report contains correct student information, prediction, risk and recommendations, and a student can only download their own.
4. Non-Functional Requirements
Area
Requirement
Security
Password hashing (bcrypt, PBKDF2 or Argon2), role-based access control, input validation, parameterized SQL
Performance
Efficient Pandas operations; model loaded once and reused (cached)
Reliability
Exception handling; database transactions with rollback
Maintainability
Modular files, reusable functions, separation of layers
Usability
Simple navigation, understandable dashboards and plain-language results
Scalability
Separate application, database and ML modules so each can be swapped later
Accuracy
Evaluation with MAE, RMSE and R² on held-out data
Data integrity
Primary keys, foreign keys, unique and check constraints
Compatibility
Python 3.13-compatible dependencies
Privacy
Students see only their own records; passwords never stored as plain text
5. Machine Learning Requirements
5.1 Algorithms
Linear Regression, Decision Tree Regressor, Random Forest Regressor, Gradient Boosting Regressor.
5.2 Two-Stage Model Strategy
This is the most important data constraint in the project.
Stage
Data
Features
Status
1. Prototype model
UCI Student Performance dataset
Actual UCI features (for example G1, G2, studytime, absences)
Current
2. University model
Authorized university data
Attendance %, internal marks, study hours, assignment completion, participation, previous marks
Future, when data is available
Known mismatches to document and respect:
• absences is not an attendance percentage.
• studytime is a coded category, not daily study hours.
• The prototype model cannot accept internal marks or assignment completion until retrained with a compatible feature set.
5.3 Prediction Timing Rule
The point at which prediction happens must be defined explicitly. Only information available at that moment may be used as input. The target (G3) must never be a model input. G1 and G2 are valid inputs only if they exist at prediction time.
5.4 Pipeline
1.  Collect a documented dataset with permission to use it.
2.  Inspect and clean (missing values, duplicates, types, invalid values).
3.  Select features and target.
4.  Train-test split before any evaluation.
5.  Train all four models on the training set.
6.  Evaluate with MAE, RMSE, R², plus cross-validation on training data.
7.  Select the model with the best overall evidence.
8.  Save with Joblib.
9.  Predict from validated inputs.
10.  Derive category, risk level and recommendations.
5.5 Explainability
• Feature importance for tree-based models.
• Coefficient analysis for Linear Regression.
• Documented risk scoring rules.
• A list of factors that triggered each recommendation.
Explanations describe associations and model behavior, never causes.
6. Core Business Rules
1.  Predictions are estimates, not guarantees.
2.  A risk score supports intervention and does not permanently label a student.
3.  Dataset limitations are documented; UCI-trained accuracy is not evidence of accuracy for Sarla Birla University students.
4.  No fabricated results anywhere (metrics, statistics, charts).
5.  Prediction inputs must match the trained model's features exactly.
6.  Students access only their own records.
7.  Existing working code is preserved; changes are incremental and tested.
7. Key User Flows
Administrator: Log in, open admin dashboard, add or update a student, enter an assessment, run prediction, review category, risk and recommendations, generate a PDF report.
Student: Log in, open personal dashboard, view assessments and latest prediction, review risk and recommendations, compare past assessments, download own report.
8. Success Metrics and Completion Criteria
• All four models trained and compared with real test metrics.
• Selected model predicts from validated inputs.
• Passwords are hashed; admin and student permissions verified by tests.
• Academic data is stored and retrieved correctly.
• Risk analysis and recommendations are understandable and traceable to rules.
• Charts use real stored or calculated data.
• PDF reports are correct.
• Project installs and runs from documented commands.
• Test suite passes, including security and validation cases.
9. Risks and Mitigations
Risk
Impact
Mitigation
Public dataset does not match university context
Misleading accuracy claims
Label prototype clearly; document limitations; plan Stage 2 retraining
Feature mismatch between form and model
Wrong or failing predictions
Single feature schema shared by form, validator and model
Target leakage (G3 or unavailable grades as input)
Inflated metrics
Define prediction time; code review of feature list
Unauthorized data access
Privacy breach
Server-side permission checks on every query, not UI hiding only
Schema changes break working code
Lost progress
Controlled migrations; backups before migration
Model file missing or stale
App errors
Startup check, clear error, versioned model files
Students over-trusting predictions
Harm or demotivation
Wording as estimates; intervention-oriented language
10. Assumptions and Open Questions
• Permission and timeline for obtaining university data for Stage 2 are not yet confirmed.
• Exact performance category thresholds and risk scoring weights need sign-off from faculty.
• Whether students self-register or are created by administrators needs a decision (FR-01).
• Deployment target (local, university server or cloud) is undecided.
11. Release Roadmap
Phase
Work
Outcome
1
Project setup and environment
Working Python project
2
Dataset preparation and EDA
Clean dataset, visualizations
3
Model training and academic analysis
Models, prediction, risk, recommendations
4
Database and application foundation
SQLite and core modules
5
Authentication and user management
Secure login and roles
6
Student profile and academic entry
Data entry and management
7
Prediction integration
End-to-end prediction
8
Admin and student dashboards
Role-based dashboards
9
Analytics and progress tracking
Charts and history
10
PDF report generation
Downloadable reports
11
Testing and security checks
Verified application
12
Deployment and documentation
Deployable project
Phases 1 to 4 are largely in progress or complete; later phases proceed one verified step at a time.
Part B: Architecture Specification
1. Architectural Style
A layered, modular monolith. One Streamlit process hosts the UI and calls into separate Python packages for logic, ML, analysis, data and reporting. Each layer depends only on the layers below it, which keeps modules independently testable and replaceable.
2. Layer Diagram
+------------------------------------------------------------+
| PRESENTATION LAYER                                         |
| Streamlit pages: Login, Dashboards, Forms, Charts          |
+------------------------------------------------------------+
| APPLICATION LOGIC LAYER                                    |
| Authentication, Permissions, Validation,                   |
| Student Management, Assessment Processing                  |
+---------------------------+--------------------------------+
| MACHINE LEARNING LAYER    | ACADEMIC ANALYSIS LAYER        |
| Training, Evaluation,     | Performance categories,        |
| Prediction, Interpretation| Risk scoring, Recommendations  |
+---------------------------+--------------------------------+
| REPORTING LAYER                                            |
| Plotly charts, Analytics, PDF reports (ReportLab)          |
+------------------------------------------------------------+
| DATA LAYER                                                 |
| SQLite database, CSV datasets, Joblib model files          |
+------------------------------------------------------------+
3. Layer Responsibilities
Layer
Responsibility
Primary modules
Presentation
Render screens, collect input, show results; contains no business logic
app.py, pages/
Application logic
Authenticate, authorize, validate, orchestrate workflows
authentication/, utils/validators.py, database/*_repository.py
Machine learning
Train, evaluate, store, load and run models
models/train_models.py, evaluate_models.py, predict.py
Academic analysis
Convert predicted marks and inputs into category, risk, recommendations
models/risk_analysis.py, recommendations.py
Reporting
Aggregate statistics, charts, PDF output
analytics/, reports/report_generator.py
Data
Persistence and file storage
database/db.py, data/, models/saved/
4. Request Flow (Prediction)
1.  User logs in; auth.py verifies the bcrypt hash and starts a session with the role.
2.  permissions.py checks that the role may open the page and access the requested student.
3.  Admin submits an assessment form.
4.  validators.py checks required fields and allowed ranges.
5.  assessment_repository.py saves the assessment inside a transaction.
6.  predict.py builds the feature row in the exact order the model expects and returns predicted marks.
7.  performance.py assigns the category; risk_analysis.py computes score and level and records the triggered rules.
8.  recommendations.py produces suggestions linked to the triggering factors.
9.  Results are saved to predictions and recommendations and the progress record is written.
10.  Dashboards read stored results; report_generator.py builds the PDF on request.
5. Data Architecture
5.1 Entity Relationships
users 1 --- 0..1 students 1 --- * assessments 1 --- 0..1 predictions 1 --- * recommendations
                       |                 |
                       +---- * progress_records ----+
One student has many assessments. Each assessment can have predictions and each prediction can have multiple recommendations. Progress records link students to assessments over time.
5.2 Tables
Table
Key columns
Notes
users
user_id PK, username, email UNIQUE, password_hash, role, is_active, created_at
role constrained to admin or student
students
student_id PK, user_id FK, enrollment_no UNIQUE, full_name, course, semester, section, created_at
Links one account to one profile
assessments
assessment_id PK, student_id FK, attendance, internal_marks, study_hours, assignment_completion, participation, previous_marks, assessment_date
CHECK constraints on ranges
predictions
prediction_id PK, assessment_id FK, predicted_marks, performance_category, risk_score, risk_level, model_used, created_at
Store model name and version for traceability
recommendations
recommendation_id PK, prediction_id FK, area, priority, recommendation_text, created_at
One row per suggestion
progress_records
progress_id PK, student_id FK, assessment_id FK, recorded_at
Supports time comparison
5.3 Data Rules
• Foreign keys enabled on every connection (PRAGMA foreign_keys = ON).
• All SQL uses parameterized queries; no string-built SQL.
• Writes that span tables run in a single transaction with rollback on failure.
• The existing database may use a smaller schema; the target tables above are reached through numbered migration scripts, with a backup before each run.
5.4 Prototype vs University Features
The assessments table targets university fields, while the prototype model uses UCI features. Until Stage 2, the prediction layer maps only the fields the prototype model supports and the UI labels results as prototype output. Feature definitions live in one shared schema (in utils/constants.py) used by the form, validator and model so they cannot drift apart.
6. Security Architecture
Concern
Design
Passwords
bcrypt (or PBKDF2/Argon2) with per-password salt; never stored or logged in plain text
Sessions
Role and user id held in Streamlit session state; every page begins with a role check
Authorization
Permission checks happen in the logic and repository layer using the logged-in user id, never only by hiding UI elements
Student isolation
Student-facing queries filter by the session's own student_id; an attempt to open another profile returns access denied
Input handling
Type, range and format validation before any database or model call
SQL injection
Parameterized queries only
Errors
User-facing messages are generic; details go to logs
Files
Model and report paths resolved through pathlib from config.py; no user-supplied paths
7. Machine Learning Architecture
raw CSV --> cleaning --> feature selection --> train/test split
   --> train 4 models --> evaluate (MAE, RMSE, R2, CV)
   --> select best --> save .joblib + metrics file
   --> predict.py loads once, validates features, returns marks
• Training is offline. train_models.py and evaluate_models.py run as scripts, not inside the web app.
• Artifacts: each saved model has a companion metadata file recording feature list, training date, dataset name and real metrics.
• Loading: predict.py loads the selected model once (Streamlit caching) and checks the incoming feature set against the metadata before predicting.
• Failure handling: missing or incompatible model files raise a clear, handled error shown to the user.
• Interpretation: feature importance for tree models and coefficients for Linear Regression are generated at evaluation time and displayed on the analytics page with wording about association, not causation.
8. Academic Analysis Architecture
• Performance categories: threshold-based mapping from predicted marks to labels; thresholds live in utils/constants.py and are subject to faculty approval.
• Risk scoring: rule-based score combining predicted marks and available indicators; each rule returns its contribution so the final score is explainable.
• Recommendations: rule-driven suggestions tied to the factors that triggered them, with area and priority; recommendation text avoids causal claims.
9. Module Map and Folder Structure
student_performance_prediction/
  app.py                 entry point and navigation
  config.py              paths, constants, environment settings
  requirements.txt       pinned, tested versions
  pages/                 Streamlit screens (1_Login ... 8_Reports)
  authentication/        auth.py, permissions.py
  database/              db.py, models.py, student_repository.py, assessment_repository.py
  models/                train_models.py, evaluate_models.py, predict.py,
                         risk_analysis.py, recommendations.py, saved/
  data/                  raw/, processed/
  analytics/             performance.py, visualizations.py, progress_tracking.py
  reports/               report_generator.py, eda/, generated/
  utils/                 validators.py, helpers.py, constants.py
  assets/                css/, images/, icons/
  tests/                 test_auth, test_database, test_prediction,
                         test_risk_analysis, test_recommendations, test_reports
Existing files are retained and moved into this structure only when the relevant development step is reached.
10. Page-to-Module Mapping
Page
Uses
1_Login
authentication/auth.py
2_Admin_Dashboard
analytics/performance.py, visualizations.py
3_Student_Dashboard
repositories (own records), progress_tracking.py
4_Student_Management
student_repository.py, validators.py
5_Academic_Assessment
assessment_repository.py, predict.py, risk_analysis.py, recommendations.py
6_Performance_Analytics
analytics/, model evaluation outputs
7_Risk_Analysis
risk_analysis.py, stored predictions
8_Reports
reports/report_generator.py
11. Technology Stack
Package
Purpose
streamlit
Web interface
pandas, numpy
Data handling and numerics
scikit-learn
Regression models and metrics
joblib
Model persistence
plotly
Interactive charts
matplotlib, seaborn
Static and EDA charts
reportlab
PDF generation
bcrypt
Password hashing
pytest
Automated testing
sqlite3, pathlib, datetime
Standard library
Install inside the active virtual environment with python -m pip install .... Do not reinstall working packages unnecessarily; the final requirements.txt pins tested versions.
12. Testing Architecture
Level
Scope
Examples
Unit
Single functions
Hash and verify password, validators, repository insert and fetch, prediction, risk calculation, recommendations
Integration
Module interaction
Login against database, assessment to prediction, prediction stored, risk to recommendations, dashboard shows saved results
System
Login to PDF end to end
Full admin and student journeys
Security and validation
Abuse and failure
Bad credentials, duplicate email or enrollment number, missing values, out-of-range marks, cross-student access, SQL injection strings, missing model file, interrupted database operations
Test case
Expected result
Valid login
Dashboard opens
Invalid password
Access denied
Duplicate email
Validation error
Valid academic data
Prediction generated
Marks outside range
Input rejected
Missing model file
Clear error message
Student opens another profile
Access denied
Valid PDF request
Correct report generated
13. Deployment and Operations
• Run: streamlit run app.py inside a virtual environment.
• Configuration: paths and settings centralized in config.py; secrets (if any) via environment variables, never committed (.gitignore).
• Backups: copy the SQLite file before migrations and on a regular schedule.
• Logging: application errors logged to file; no sensitive data in logs.
• Scaling path: SQLite suits a single-department deployment. If concurrency or volume grows, the repository layer allows migration to PostgreSQL without changing pages or ML code.
• Documentation: README with install, run, test and migration commands.
14. Architecture Decision Records (Summary)
ID
Decision
Rationale
Trade-off
ADR-1
Layered modular monolith
Simple to build, test and deploy for a university project
Less independent scaling than services
ADR-2
Streamlit UI
Fast Python-only development, built-in charts and forms
Limited UI customization and session handling
ADR-3
SQLite
Zero setup, relational integrity, fits scale
Limited concurrent writes
ADR-4
Offline model training
Reproducible and keeps the app fast
Retraining is a manual step
ADR-5
Two-stage model strategy
Honest about dataset limits
Stage 2 depends on obtaining university data
ADR-6
Rule-based risk and recommendations
Transparent and explainable
Less adaptive than learned risk models
ADR-7
Incremental migrations
Protects working code
Slower than a rewrite
15. Immediate Next Steps
1.  Audit the existing project against this target structure and list gaps.
2.  Document the current database schema and write migration 001 toward the target schema.
3.  Freeze the prototype feature schema and prediction timing rule.
4.  Confirm category thresholds and risk rules with faculty.
5.  Implement authentication with password hashing and role checks (Phase 5).