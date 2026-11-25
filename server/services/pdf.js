const PDFDocument = require('pdfkit');

const COLORS = {
  ink: '#101828',
  body: '#344054',
  muted: '#667085',
  line: '#D0D5DD',
  accent: '#4338CA',
  accentSoft: '#EEF2FF',
  high: '#B42318',
  medium: '#B54708',
  low: '#067647',
  panel: '#F9FAFB'
};

const RISK_LABEL = { low: 'Low', medium: 'Moderate', high: 'High (prioritise support)' };

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, '?');
}

function fmt(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '--';
}

function ensureSpace(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 30) doc.addPage();
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 50);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(clean(text));
  doc.moveDown(0.25);
  const y = doc.y;
  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  doc.moveDown(0.45);
}

function keyValue(doc, label, value, x, width) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text(clean(label).toUpperCase(), x, doc.y, { width, continued: false });
  doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.ink).text(clean(value || '--'), x, doc.y + 2, { width });
}

function drawSummaryCard(doc, x, y, width, height, label, value, sub, color) {
  doc.roundedRect(x, y, width, height, 6).fillAndStroke(COLORS.panel, COLORS.line);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text(clean(label).toUpperCase(), x + 12, y + 12, { width: width - 24 });
  doc.font('Helvetica-Bold').fontSize(20).fillColor(color || COLORS.ink).text(clean(value), x + 12, y + 27, { width: width - 24 });
  if (sub) doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(clean(sub), x + 12, y + 53, { width: width - 24 });
}

function addFooter(doc, generatedAt) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 36;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text('Student Performance Prediction & Academic Risk Analysis - prototype report', 48, y, { width: 330 });
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - 130, y, { width: 82, align: 'right' });
    doc.text(`Generated ${generatedAt}`, 48, y + 10, { width: 420 });
  }
}

function buildReportPdf({ student, latest, recommendations, metrics, activeMetadata, generatedAt }) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    bufferPages: true,
    info: {
      Title: `Student performance report - ${clean(student.full_name)}`,
      Author: 'Student Performance Prediction & Academic Risk Analysis System',
      Subject: 'Prototype academic risk report'
    }
  });

  // Header band
  doc.rect(0, 0, doc.page.width, 10).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.ink)
    .text('Student Performance Report', 48, 44, { width: 360 });
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.muted)
    .text('Prediction & Academic Risk Analysis System', 48, 69, { width: 360 });

  const badgeText = 'Prototype model (UCI dataset)';
  doc.font('Helvetica-Bold').fontSize(8);
  const badgeWidth = doc.widthOfString(badgeText) + 20;
  doc.roundedRect(doc.page.width - 48 - badgeWidth, 44, badgeWidth, 22, 11).fill(COLORS.accentSoft);
  doc.fillColor(COLORS.accent).text(badgeText, doc.page.width - 48 - badgeWidth + 10, 50, { width: badgeWidth });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text('Accuracy for university students is not yet validated.', 48, 88, { width: doc.page.width - 96 });

  // Student details
  sectionTitle(doc, 'Student profile');
  const topY = doc.y;
  keyValue(doc, 'Full name', student.full_name, 48, 230);
  doc.y = topY;
  keyValue(doc, 'Enrollment number', student.enrollment_no, 300, 200);
  doc.y = Math.max(doc.y, topY + 38);
  const row2 = doc.y;
  keyValue(doc, 'Course', student.course, 48, 230);
  doc.y = row2;
  keyValue(doc, 'Semester / section', `${student.semester}${student.section ? ` / ${student.section}` : ''}`, 300, 200);
  doc.y = Math.max(doc.y, row2 + 38);
  const row3 = doc.y;
  keyValue(doc, 'Email', student.email, 48, 300);
  doc.y = row3;
  keyValue(doc, 'Account status', student.is_active ? 'Active' : 'Inactive', 400, 140);

  if (!latest) {
    sectionTitle(doc, 'Assessment and prediction');
    doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.body)
      .text('No assessment data has been recorded for this student. A prediction cannot be generated until an assessment is entered.', { width: doc.page.width - 96 });
    sectionTitle(doc, 'Disclaimer');
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
      .text('Predictions are estimates, not guarantees. Risk indicators describe associations, not causes, and are never a permanent label. Accuracy for university students has not yet been validated.', { width: doc.page.width - 96 });
    addFooter(doc, generatedAt);
    return doc;
  }

  const predicted = latest.predicted_marks;
  const riskLevel = latest.risk_level || 'unknown';
  const riskColor = riskLevel === 'high' ? COLORS.high : riskLevel === 'medium' ? COLORS.medium : COLORS.low;

  // Summary cards
  sectionTitle(doc, 'Latest prediction');
  ensureSpace(doc, 130);
  const cardY = doc.y;
  const cardWidth = (doc.page.width - 96 - 24) / 3;
  drawSummaryCard(doc, 48, cardY, cardWidth, 78, 'Predicted marks', predicted == null ? '--' : `${fmt(predicted, 1)}/100`, latest.performance_category || 'No prediction', COLORS.accent);
  drawSummaryCard(doc, 48 + cardWidth + 12, cardY, cardWidth, 78, 'Risk level', RISK_LABEL[riskLevel] || riskLevel, `Risk score ${latest.risk_score == null ? '--' : fmt(latest.risk_score, 1)}/100`, riskColor);
  drawSummaryCard(doc, 48 + (cardWidth + 12) * 2, cardY, cardWidth, 78, 'Assessment date', String(latest.assessment_date || '--'), `Model: ${latest.model_used || '--'}`, COLORS.ink);
  doc.y = cardY + 94;

  if (latest.is_mock) {
    doc.roundedRect(48, doc.y, doc.page.width - 96, 24, 4).fill('#FEF3F2');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.high)
      .text('MOCK - not real model output. This development result must not be used for real decisions.', 58, doc.y + 8, { width: doc.page.width - 116 });
    doc.y += 34;
  }

  sectionTitle(doc, 'Assessment inputs');
  const fields = [
    ['Attendance (%)', latest.attendance],
    ['Internal marks (%)', latest.internal_marks],
    ['Study hours / week', latest.study_hours],
    ['Assignment completion (%)', latest.assignment_completion],
    ['Participation (%)', latest.participation],
    ['Previous marks (%)', latest.previous_marks]
  ];
  const startY = doc.y;
  fields.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 48 + col * ((doc.page.width - 96) / 3);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text(clean(label).toUpperCase(), x, startY + row * 30, { width: 140 });
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.ink).text(fmt(value, 1), x, startY + row * 30 + 11, { width: 140 });
  });
  doc.y = startY + 68;

  sectionTitle(doc, 'Why this risk level was triggered');
  ensureSpace(doc, 80);
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body)
    .text(clean(latest.explanation || 'No explanation stored.'), { width: doc.page.width - 96 });
  doc.moveDown(0.5);

  const rules = Array.isArray(latest.triggered_rules) ? latest.triggered_rules : [];
  if (rules.length) {
    for (const rule of rules) {
      ensureSpace(doc, 34);
      const color = rule.severity === 'high' ? COLORS.high : COLORS.medium;
      doc.circle(53, doc.y + 4, 3).fill(color);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink)
        .text(clean(rule.label || rule.code), 63, doc.y, { width: doc.page.width - 150, continued: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text(`Observed ${rule.metric}: ${fmt(rule.value, 1)} (${rule.comparator} ${fmt(rule.threshold, 1)})`, 63, doc.y + 2, { width: doc.page.width - 150 });
      doc.moveDown(0.15);
    }
  } else {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
      .text('No rule thresholds were crossed in this assessment.', { width: doc.page.width - 96 });
  }

  sectionTitle(doc, 'Recommendations for support');
  if (!recommendations.length) {
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body)
      .text('No recommendations stored for this prediction.', { width: doc.page.width - 96 });
  } else {
    recommendations.forEach((rec, index) => {
      ensureSpace(doc, 52);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.accent)
        .text(`${index + 1}. ${clean(rec.area)} (${clean(rec.priority)} priority)`, { width: doc.page.width - 96 });
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
        .text(clean(rec.recommendation_text), { width: doc.page.width - 110, indent: 12 });
      doc.moveDown(0.35);
    });
  }

  sectionTitle(doc, 'Model and evaluation');
  const active = (metrics || []).find((m) => m.is_active) || (metrics || [])[0];
  if (!active) {
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body)
      .text('No stored model evaluation metrics are available. Run ml-service/train_model.py and npm run seed:metrics.', { width: doc.page.width - 96 });
  } else {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
      .text(`Active model: ${clean(active.model_name)}  |  Dataset: ${clean(active.dataset_name)} (${active.dataset_rows} rows, ${active.test_rows} held-out test rows)`, { width: doc.page.width - 96 });
    doc.moveDown(0.35);
    const headers = ['Model', 'MAE', 'RMSE', 'R2'];
    const colX = [48, 300, 370, 440];
    ensureSpace(doc, 30);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: i === 0 ? 240 : 60 }));
    doc.moveDown(0.2);
    doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).strokeColor(COLORS.line).stroke();
    doc.moveDown(0.2);
    for (const m of metrics) {
      ensureSpace(doc, 20);
      doc.font(m.is_active ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(COLORS.body);
      doc.text(clean(m.model_name), colX[0], doc.y, { width: 240 });
      doc.text(fmt(m.mae, 3), colX[1], doc.y, { width: 60 });
      doc.text(fmt(m.rmse, 3), colX[2], doc.y, { width: 60 });
      doc.text(fmt(m.r2, 3), colX[3], doc.y, { width: 60 });
      doc.moveDown(0.3);
    }
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text('Metrics are the stored held-out evaluation results from the training run. They are not live accuracy guarantees.', { width: doc.page.width - 96 });
    if (activeMetadata && activeMetadata.transformations) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('Prototype feature mapping');
      doc.font('Helvetica').fontSize(7.8).fillColor(COLORS.muted)
        .text(clean(activeMetadata.transformations.join('  |  ')), { width: doc.page.width - 96 });
    }
  }

  sectionTitle(doc, 'Important disclaimer');
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
    .text('Predictions are estimates, not guarantees. Risk indicators describe associations in the prototype data, not causes, and must never be used to label a student permanently. Accuracy for university students has not yet been validated. Use this report to guide supportive intervention and professional judgement.', { width: doc.page.width - 96 });

  addFooter(doc, generatedAt);
  return doc;
}

module.exports = { buildReportPdf };
