const { z } = require('zod');

const NAME_RE = /^[\p{L}][\p{L}\p{M}\s.'-]{1,119}$/u;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;
const ENROLLMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,39}$/;
const COURSE_RE = /^[\p{L}\p{N}\s&(),.'/-]{2,100}$/u;
const SECTION_RE = /^[A-Za-z0-9-]{1,20}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).+$/;

const trimmed = (max) => z.string().trim().min(1).max(max);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .email('Enter a valid email address.');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(PASSWORD_RE, 'Password must include at least one letter and one number.');

const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_RE, 'Username must be 3-50 characters: letters, numbers, dot, dash or underscore.');

const fullNameSchema = z
  .string()
  .trim()
  .regex(NAME_RE, 'Enter a valid full name.')
  .transform((v) => v.replace(/\s+/g, ' '));

const enrollmentSchema = z
  .string()
  .trim()
  .regex(ENROLLMENT_RE, 'Enrollment number may contain letters, numbers, dot, dash, underscore or slash (3-40 characters).')
  .transform((v) => v.toUpperCase());

const courseSchema = z
  .string()
  .trim()
  .regex(COURSE_RE, 'Enter a valid course name.')
  .transform((v) => v.replace(/\s+/g, ' '));

const sectionSchema = z
  .string()
  .trim()
  .regex(SECTION_RE, 'Section must be 1-20 letters, numbers or dashes.')
  .optional()
  .or(z.literal('').transform(() => undefined));

const semesterSchema = z.coerce
  .number({ invalid_type_error: 'Semester must be a number.' })
  .int('Semester must be a whole number.')
  .min(1, 'Semester must be between 1 and 12.')
  .max(12, 'Semester must be between 1 and 12.');

const percent = (label) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a finite number.`)
    .min(0, `${label} must be between 0 and 100.`)
    .max(100, `${label} must be between 0 and 100.`);

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
  enrollment_no: enrollmentSchema,
  course: courseSchema,
  semester: semesterSchema,
  section: sectionSchema
}).strict();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required.').max(255),
  password: z.string().min(1, 'Password is required.').max(200)
}).strict();

const studentCreateSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema.optional(),
  full_name: fullNameSchema,
  enrollment_no: enrollmentSchema,
  course: courseSchema,
  semester: semesterSchema,
  section: sectionSchema
}).strict();

const studentUpdateSchema = z.object({
  full_name: fullNameSchema.optional(),
  course: courseSchema.optional(),
  semester: semesterSchema.optional(),
  section: sectionSchema
}).strict();

const studentStatusSchema = z.object({ is_active: z.boolean() }).strict();

const assessmentFields = {
  attendance: percent('Attendance'),
  internal_marks: percent('Internal marks'),
  study_hours: z.coerce
    .number({ invalid_type_error: 'Study hours must be a number.' })
    .finite()
    .min(0, 'Study hours must be between 0 and 168 per week.')
    .max(168, 'Study hours must be between 0 and 168 per week.'),
  assignment_completion: percent('Assignment completion'),
  participation: percent('Participation'),
  previous_marks: percent('Previous marks')
};

const assessmentSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  ...assessmentFields,
  assessment_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Assessment date must be YYYY-MM-DD.')
    .optional()
}).strict();

const assessmentUpdateSchema = z.object({
  ...assessmentFields,
  assessment_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Assessment date must be YYYY-MM-DD.')
    .optional()
}).strict();

const predictSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  ...assessmentFields,
  assessment_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Assessment date must be YYYY-MM-DD.')
    .optional(),
  assessment_id: z.coerce.number().int().positive().optional()
}).strict();

const idSchema = z.coerce.number().int().positive('ID must be a positive whole number.');
const idParamsSchema = z.object({ id: idSchema }).strict();

const assessmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  student_id: z.coerce.number().int().positive().optional()
}).strict();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional().default(''),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all')
}).strict();

const recommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

const reportQuerySchema = z.object({}).strict();

// Removes NUL bytes and prototype-pollution keys from every string/key.
function sanitizeValue(value, depth = 0) {
  if (depth > 8) return value;
  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = {
  registerSchema,
  loginSchema,
  studentCreateSchema,
  studentUpdateSchema,
  studentStatusSchema,
  assessmentSchema,
  assessmentUpdateSchema,
  predictSchema,
  idSchema,
  idParamsSchema,
  assessmentListQuerySchema,
  paginationSchema,
  recommendationsQuerySchema,
  reportQuerySchema,
  emailSchema,
  passwordSchema,
  fullNameSchema,
  enrollmentSchema,
  semesterSchema,
  sanitizeValue
};
