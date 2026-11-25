-- 001_init.sql
-- Core schema for the Student Performance Prediction & Academic Risk Analysis System.
-- All tables are created in the schema selected by the connection search_path.

CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'student'
                CONSTRAINT users_role_check CHECK (role IN ('admin', 'student')),
  is_active     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  student_id    SERIAL PRIMARY KEY,
  user_id       INTEGER      NOT NULL UNIQUE
                REFERENCES users(user_id) ON DELETE CASCADE,
  enrollment_no VARCHAR(40)  NOT NULL UNIQUE,
  full_name     VARCHAR(120) NOT NULL,
  course        VARCHAR(100) NOT NULL,
  semester      SMALLINT     NOT NULL
                CONSTRAINT students_semester_check CHECK (semester BETWEEN 1 AND 12),
  section       VARCHAR(20),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
  assessment_id         SERIAL PRIMARY KEY,
  student_id            INTEGER      NOT NULL
                        REFERENCES students(student_id) ON DELETE CASCADE,
  attendance            NUMERIC(5,2) NOT NULL
                        CONSTRAINT assessments_attendance_check CHECK (attendance BETWEEN 0 AND 100),
  internal_marks        NUMERIC(5,2) NOT NULL
                        CONSTRAINT assessments_internal_marks_check CHECK (internal_marks BETWEEN 0 AND 100),
  study_hours           NUMERIC(5,2) NOT NULL
                        CONSTRAINT assessments_study_hours_check CHECK (study_hours BETWEEN 0 AND 168),
  assignment_completion NUMERIC(5,2) NOT NULL
                        CONSTRAINT assessments_assignment_check CHECK (assignment_completion BETWEEN 0 AND 100),
  participation         NUMERIC(5,2) NOT NULL
                        CONSTRAINT assessments_participation_check CHECK (participation BETWEEN 0 AND 100),
  previous_marks        NUMERIC(5,2) NOT NULL
                        CONSTRAINT assessments_previous_marks_check CHECK (previous_marks BETWEEN 0 AND 100),
  assessment_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
  prediction_id        SERIAL PRIMARY KEY,
  assessment_id        INTEGER      NOT NULL UNIQUE
                       REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  predicted_marks      NUMERIC(5,2) NOT NULL
                       CONSTRAINT predictions_marks_check CHECK (predicted_marks BETWEEN 0 AND 100),
  performance_category VARCHAR(30)  NOT NULL
                       CONSTRAINT predictions_category_check
                       CHECK (performance_category IN ('Excellent', 'Good', 'Average', 'Below Average', 'Needs Support')),
  risk_score           NUMERIC(5,2) NOT NULL
                       CONSTRAINT predictions_risk_score_check CHECK (risk_score BETWEEN 0 AND 100),
  risk_level           VARCHAR(10)  NOT NULL
                       CONSTRAINT predictions_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high')),
  model_used           VARCHAR(100) NOT NULL,
  is_mock              BOOLEAN      NOT NULL DEFAULT FALSE,
  triggered_rules      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  explanation          TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
  recommendation_id  SERIAL PRIMARY KEY,
  prediction_id      INTEGER      NOT NULL
                     REFERENCES predictions(prediction_id) ON DELETE CASCADE,
  area               VARCHAR(80)  NOT NULL,
  priority           VARCHAR(10)  NOT NULL
                     CONSTRAINT recommendations_priority_check CHECK (priority IN ('high', 'medium', 'low')),
  recommendation_text TEXT        NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_records (
  progress_id   SERIAL PRIMARY KEY,
  student_id    INTEGER NOT NULL
                REFERENCES students(student_id) ON DELETE CASCADE,
  assessment_id INTEGER NOT NULL
                REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT progress_records_assessment_unique UNIQUE (student_id, assessment_id)
);

-- Evaluation metrics are written by server/db/seed-metrics.js from the real
-- train/test evaluation performed in ml-service/train_model.py.
CREATE TABLE IF NOT EXISTS model_metrics (
  metric_id          SERIAL PRIMARY KEY,
  model_name         VARCHAR(100) NOT NULL UNIQUE,
  mae                NUMERIC(8,4) NOT NULL CHECK (mae >= 0),
  rmse               NUMERIC(8,4) NOT NULL CHECK (rmse >= 0),
  r2                 NUMERIC(8,4) NOT NULL CHECK (r2 <= 1),
  feature_importance JSONB        NOT NULL DEFAULT '[]'::jsonb,
  dataset_name       VARCHAR(150) NOT NULL,
  dataset_rows       INTEGER      NOT NULL,
  test_rows          INTEGER      NOT NULL,
  trained_at         TIMESTAMPTZ  NOT NULL,
  is_active          BOOLEAN      NOT NULL DEFAULT FALSE,
  metadata           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(lower(full_name));
CREATE INDEX IF NOT EXISTS idx_assessments_student_date ON assessments(student_id, assessment_date DESC, assessment_id DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_assessment ON predictions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_predictions_risk ON predictions(risk_level);
CREATE INDEX IF NOT EXISTS idx_recommendations_prediction ON recommendations(prediction_id);
CREATE INDEX IF NOT EXISTS idx_progress_student ON progress_records(student_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_metrics_active ON model_metrics(is_active);
