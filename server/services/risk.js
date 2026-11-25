const RULE_DEFINITIONS = [
  {
    code: 'attendance_below_60', metric: 'attendance', comparator: '<', threshold: 60,
    severity: 'high', area: 'Attendance',
    label: 'Attendance is below 60%',
    explanation: 'Missing a large share of classes is associated with weaker assessment outcomes in the prototype data.'
  },
  {
    code: 'predicted_below_40', metric: 'predicted_marks', comparator: '<', threshold: 40,
    severity: 'high', area: 'Academic support',
    label: 'Predicted marks are below 40',
    explanation: 'The model estimates a mark in the lowest band. This is an estimate, not a guarantee.'
  },
  {
    code: 'internal_below_40', metric: 'internal_marks', comparator: '<', threshold: 40,
    severity: 'high', area: 'Academic support',
    label: 'Internal marks are below 40',
    explanation: 'Current internal performance is in the lowest band and may benefit from targeted revision.'
  },
  {
    code: 'assignment_below_50', metric: 'assignment_completion', comparator: '<', threshold: 50,
    severity: 'high', area: 'Assignment support',
    label: 'Assignment completion is below 50%',
    explanation: 'Incomplete coursework is associated with lower final outcomes and may reflect competing demands.'
  },
  {
    code: 'participation_below_40', metric: 'participation', comparator: '<', threshold: 40,
    severity: 'high', area: 'Engagement',
    label: 'Participation is below 40%',
    explanation: 'Low participation can hide gaps early; it is a signal to check in, not a judgement.'
  },
  {
    code: 'attendance_below_75', metric: 'attendance', comparator: '<', threshold: 75,
    severity: 'medium', area: 'Attendance',
    label: 'Attendance is below 75%',
    explanation: 'Some classes are being missed; earlier support may prevent gaps from growing.'
  },
  {
    code: 'predicted_below_55', metric: 'predicted_marks', comparator: '<', threshold: 55,
    severity: 'medium', area: 'Academic support',
    label: 'Predicted marks are below 55',
    explanation: 'The estimate is in the lower-middle band, so a short intervention cycle is worth considering.'
  },
  {
    code: 'internal_below_55', metric: 'internal_marks', comparator: '<', threshold: 55,
    severity: 'medium', area: 'Academic support',
    label: 'Internal marks are below 55',
    explanation: 'Internal assessment performance suggests reviewing foundational topics.'
  },
  {
    code: 'assignment_below_70', metric: 'assignment_completion', comparator: '<', threshold: 70,
    severity: 'medium', area: 'Assignment support',
    label: 'Assignment completion is below 70%',
    explanation: 'A moderate share of coursework is incomplete; pacing support may help.'
  },
  {
    code: 'participation_below_55', metric: 'participation', comparator: '<', threshold: 55,
    severity: 'medium', area: 'Engagement',
    label: 'Participation is below 55%',
    explanation: 'Lower participation may make it harder to notice confusion early.'
  },
  {
    code: 'previous_below_50', metric: 'previous_marks', comparator: '<', threshold: 50,
    severity: 'medium', area: 'Academic support',
    label: 'Previous marks are below 50',
    explanation: 'Previous results are associated with current performance; they do not determine it.'
  },
  {
    code: 'study_hours_below_3', metric: 'study_hours', comparator: '<', threshold: 3,
    severity: 'medium', area: 'Study habits',
    label: 'Study time is below 3 hours per week',
    explanation: 'Very low self-reported study time is associated with weaker outcomes in the prototype data.'
  }
];

const RECOMMENDATION_MAP = {
  Attendance: {
    high: 'Work with the student to identify barriers to attendance (transport, work, health, timetable clashes) and agree a realistic catch-up plan.',
    medium: 'Check in about any obstacles to attending class and agree one small step to improve attendance this week.'
  },
  'Academic support': {
    high: 'Arrange a short academic check-in to review the current trajectory, identify two priority topics, and book a follow-up.',
    medium: 'Offer targeted revision on the topics behind the internal assessment and a short practice task before the next test.'
  },
  'Assignment support': {
    high: 'Break upcoming assignments into weekly milestones and connect the student with academic writing or study support.',
    medium: 'Agree a simple assignment schedule with interim checkpoints so work does not pile up.'
  },
  Engagement: {
    high: 'Use low-pressure participation options (small-group discussion, written contributions) and invite the student to one class activity.',
    medium: 'Share one or two accessible ways to participate and ask which format feels workable.'
  },
  'Study habits': {
    high: 'Help the student build a weekly study timetable with short focused blocks, and protect time for rest and other commitments.',
    medium: 'Suggest a weekly study plan with 25-minute focused blocks and a brief review at the end of each week.'
  }
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function performanceCategory(marks) {
  if (marks >= 85) return 'Excellent';
  if (marks >= 70) return 'Good';
  if (marks >= 55) return 'Average';
  if (marks >= 40) return 'Below Average';
  return 'Needs Support';
}

function computeRiskScore(values) {
  const components = {
    predicted: (100 - Number(values.predicted_marks)) * 0.50,
    attendance: (100 - Number(values.attendance)) * 0.15,
    internal: (100 - Number(values.internal_marks)) * 0.10,
    assignment: (100 - Number(values.assignment_completion)) * 0.10,
    participation: (100 - Number(values.participation)) * 0.05,
    previous: (100 - Number(values.previous_marks)) * 0.10
  };
  return round2(Math.max(0, Math.min(100, Object.values(components).reduce((a, b) => a + b, 0))));
}

function evaluateRules(values, riskScore) {
  const triggered = [];
  for (const rule of RULE_DEFINITIONS) {
    const value = Number(values[rule.metric]);
    if (Number.isFinite(value) && value < rule.threshold) {
      triggered.push({
        code: rule.code,
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        value: round2(value),
        severity: rule.severity,
        area: rule.area,
        label: rule.label,
        explanation: rule.explanation
      });
    }
  }

  let level = 'low';
  if (triggered.some((r) => r.severity === 'high') || riskScore >= 60) level = 'high';
  else if (triggered.some((r) => r.severity === 'medium') || riskScore >= 32) level = 'medium';

  const hasLevelRule = triggered.some((r) => r.severity === level);
  if (!hasLevelRule && level !== 'low') {
    triggered.push({
      code: `combined_risk_${level}`,
      metric: 'risk_score',
      comparator: '>=',
      threshold: level === 'high' ? 60 : 32,
      value: riskScore,
      severity: level,
      area: 'Support planning',
      label: level === 'high'
        ? 'Combined risk score is 60 or above'
        : 'Combined risk score is 32 or above',
      explanation: 'Several indicators combine to raise the early-warning signal even though no single indicator crosses its rule threshold.'
    });
  }

  return { level, triggered };
}

function buildRecommendations(rules, level) {
  const recs = [];
  if (level === 'high') {
    recs.push({
      area: 'Mentoring',
      priority: 'high',
      recommendation_text: 'Offer a supportive mentoring check-in that focuses on the student\'s own goals. Listen first, then agree one or two realistic next steps together. This is an early-warning signal, not a label.'
    });
  }

  const seenAreas = new Set();
  const severityRank = { high: 0, medium: 1, low: 2 };
  const sorted = [...rules].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  for (const rule of sorted) {
    const area = rule.area;
    if (seenAreas.has(area)) continue;
    seenAreas.add(area);
    const text = (RECOMMENDATION_MAP[area] && RECOMMENDATION_MAP[area][rule.severity])
      || `Review ${area.toLowerCase()} with the student and agree one small, measurable next step.`;
    recs.push({
      area,
      priority: rule.severity === 'high' ? 'high' : 'medium',
      recommendation_text: text
    });
  }

  if (!recs.length) {
    recs.push({
      area: 'Maintenance',
      priority: 'low',
      recommendation_text: 'Keep current attendance and study routines consistent. Revisit this estimate after the next assessment so the trend can be checked.'
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return recs
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 6);
}

function buildRiskAnalysis(assessment, mlResult) {
  const predictedMarks = round2(Number(mlResult.predicted_marks));
  const values = {
    predicted_marks: predictedMarks,
    attendance: Number(assessment.attendance),
    internal_marks: Number(assessment.internal_marks),
    study_hours: Number(assessment.study_hours),
    assignment_completion: Number(assessment.assignment_completion),
    participation: Number(assessment.participation),
    previous_marks: Number(assessment.previous_marks)
  };
  const riskScore = computeRiskScore(values);
  const { level, triggered } = evaluateRules(values, riskScore);
  const category = performanceCategory(predictedMarks);

  const labels = triggered.map((r) => r.label);
  const explanation = [
    `The prototype model estimates ${predictedMarks.toFixed(1)}/100 from attendance, internal marks, study hours and previous marks.`,
    labels.length
      ? `The ${level} support level was triggered by: ${labels.join('; ')}.`
      : 'No early-warning thresholds were crossed in this assessment.',
    'These patterns are associations in the prototype data, not proof of cause, and this is not a permanent label.'
  ].join(' ');

  return {
    predicted_marks: predictedMarks,
    performance_category: category,
    risk_score: riskScore,
    risk_level: level,
    triggered_rules: triggered,
    explanation,
    recommendations: buildRecommendations(triggered, level)
  };
}

module.exports = {
  buildRiskAnalysis,
  performanceCategory,
  computeRiskScore,
  evaluateRules,
  buildRecommendations,
  RULE_DEFINITIONS
};
