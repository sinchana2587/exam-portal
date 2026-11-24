/**
 * Universal Template-Specific Validation Engine
 *
 * Implements granular validation distinguishing:
 * - ERRORS: Critical issues preventing automated validation
 * - WARNINGS: Quality issues or missing non-critical items that allow manual override
 * - INFO: Informational notes regarding extraction confidence or formatting
 *
 * Never silently discards invalid or duplicate records.
 */

import { TEMPLATE_IDS } from '../registry/templateRegistry.js';
import { USN_REGEX } from '../contentClassifier.js';

export function validateStudentList(mappedData) {
  const { records = [], lowConfidenceMappings = [] } = mappedData;
  const errors = [];
  const warnings = [];
  const info = [];

  const seenUsns = new Map();
  let validRecordsCount = 0;

  // Add mapping warnings
  lowConfidenceMappings.forEach((mapWarn) => {
    warnings.push({
      id: `warn_map_${mapWarn.sourceField}`,
      code: 'LOW_CONFIDENCE_MAPPING',
      field: mapWarn.targetField,
      message: `Source column "${mapWarn.sourceField}" mapped to "${mapWarn.targetField}" with low confidence (${(mapWarn.confidence * 100).toFixed(0)}%). Please verify.`
    });
  });

  if (records.length === 0) {
    errors.push({
      id: 'err_no_records',
      code: 'EMPTY_STUDENT_LIST',
      message: 'No student records could be identified in the uploaded document.'
    });
    return {
      isValid: false,
      summary: { totalItems: 0, validCount: 0, errorCount: errors.length, warningCount: warnings.length, confidenceScore: 0 },
      errors,
      warnings,
      info
    };
  }

  records.forEach((record, idx) => {
    let hasRecordError = false;

    // 1. Student Name validation
    if (!record.studentName || record.studentName === 'Student' || record.studentName.trim().length < 2) {
      errors.push({
        id: `err_name_${idx}`,
        code: 'MISSING_STUDENT_NAME',
        itemIndex: idx,
        itemKey: record.usn || `Row #${idx + 1}`,
        field: 'studentName',
        message: `Row #${idx + 1}: Student Name is missing or invalid.`
      });
      hasRecordError = true;
    }

    // 2. USN validation
    if (!record.usn) {
      errors.push({
        id: `err_usn_${idx}`,
        code: 'MISSING_USN',
        itemIndex: idx,
        itemKey: `Row #${idx + 1}`,
        field: 'usn',
        message: `Row #${idx + 1}: USN is missing.`
      });
      hasRecordError = true;
    } else if (!USN_REGEX.test(record.usn)) {
      warnings.push({
        id: `warn_usn_format_${idx}`,
        code: 'NON_STANDARD_USN',
        itemIndex: idx,
        itemKey: record.usn,
        field: 'usn',
        message: `Row #${idx + 1}: USN "${record.usn}" does not follow the standard university format.`
      });
    }

    // 3. Duplicate USN detection (Never silent deletion)
    if (record.usn) {
      const existingIdx = seenUsns.get(record.usn);
      if (existingIdx !== undefined) {
        warnings.push({
          id: `warn_dup_${record.usn}_${idx}`,
          code: 'DUPLICATE_USN',
          itemIndex: idx,
          itemKey: record.usn,
          field: 'usn',
          message: `Row #${idx + 1}: Duplicate USN "${record.usn}" found (first seen on Row #${existingIdx + 1}). Record preserved for verification.`
        });
      } else {
        seenUsns.set(record.usn, idx);
      }
    }

    // 4. DOB validation
    if (!record.dateOfBirth || record.dateOfBirth.includes('missing') || record.dateOfBirth.includes('UNCLEAR')) {
      warnings.push({
        id: `warn_dob_${idx}`,
        code: 'UNCLEAR_DOB',
        itemIndex: idx,
        itemKey: record.usn || `Row #${idx + 1}`,
        field: 'dateOfBirth',
        message: `Row #${idx + 1} (${record.usn || record.studentName}): Date of Birth is missing or ambiguous (${record.dateOfBirth || 'empty'}).`
      });
    }

    if (!hasRecordError) {
      validRecordsCount++;
    }
  });

  const confidenceScore = Number((validRecordsCount / records.length).toFixed(2));
  info.push({
    id: 'info_student_summary',
    code: 'VALIDATION_SUMMARY',
    message: `${validRecordsCount} of ${records.length} records passed primary integrity checks.`
  });

  return {
    isValid: errors.length === 0,
    summary: {
      totalItems: records.length,
      validCount: validRecordsCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      confidenceScore
    },
    errors,
    warnings,
    info
  };
}

export function validateQuestionPaper(mappedData) {
  const { modules = [], totalQuestions = 0 } = mappedData;
  const errors = [];
  const warnings = [];
  const info = [];

  if (totalQuestions === 0 || modules.length === 0) {
    errors.push({
      id: 'err_no_questions',
      code: 'EMPTY_QUESTION_PAPER',
      message: 'No questions could be extracted from this document.'
    });
    return {
      isValid: false,
      summary: { totalItems: 0, validCount: 0, errorCount: errors.length, warningCount: warnings.length, confidenceScore: 0 },
      errors,
      warnings,
      info
    };
  }

  const seenNumbers = new Set();
  let completeQuestionsCount = 0;

  modules.forEach((mod) => {
    if (!mod.questions || mod.questions.length === 0) {
      warnings.push({
        id: `warn_empty_mod_${mod.moduleNumber}`,
        code: 'EMPTY_MODULE',
        message: `Module ${mod.moduleNumber} has no questions assigned.`
      });
      return;
    }

    mod.questions.forEach((q, qIdx) => {
      let isComplete = true;

      // 1. Question Text
      if (!q.questionText || q.questionText.trim().length === 0) {
        errors.push({
          id: `err_qtext_${mod.moduleNumber}_${q.questionNumber || qIdx}`,
          code: 'MISSING_QUESTION_TEXT',
          itemKey: `Q${q.questionNumber || qIdx + 1}`,
          field: 'questionText',
          message: `Module ${mod.moduleNumber}, Q${q.questionNumber || qIdx + 1}: Missing question statement text.`
        });
        isComplete = false;
      }

      // 2. Question Numbering & Duplicates
      if (!q.questionNumber) {
        warnings.push({
          id: `warn_qnum_${mod.moduleNumber}_${qIdx}`,
          code: 'UNNUMBERED_QUESTION',
          itemKey: `Row #${qIdx + 1}`,
          field: 'questionNumber',
          message: `Module ${mod.moduleNumber}, Item #${qIdx + 1}: Question number was not found; auto-assigned.`
        });
      } else if (seenNumbers.has(q.questionNumber)) {
        warnings.push({
          id: `warn_dup_qnum_${q.questionNumber}`,
          code: 'DUPLICATE_QUESTION_NUMBER',
          itemKey: `Q${q.questionNumber}`,
          field: 'questionNumber',
          message: `Duplicate question number Q${q.questionNumber} detected in question paper.`
        });
      } else {
        seenNumbers.add(q.questionNumber);
      }

      // 3. Options validation
      const opts = q.options || {};
      const presentOptions = ['A', 'B', 'C', 'D'].filter(opt => {
        const item = opts[opt];
        return item && (item.text?.trim() || item.image);
      });

      if (presentOptions.length === 0) {
        warnings.push({
          id: `warn_no_opts_${q.questionNumber}`,
          code: 'NO_OPTIONS_EXTRACTED',
          itemKey: `Q${q.questionNumber}`,
          field: 'options',
          message: `Q${q.questionNumber}: No options (A–D) were detected.`
        });
        isComplete = false;
      } else if (presentOptions.length < 4) {
        warnings.push({
          id: `warn_partial_opts_${q.questionNumber}`,
          code: 'PARTIAL_OPTIONS',
          itemKey: `Q${q.questionNumber}`,
          field: 'options',
          message: `Q${q.questionNumber}: Only ${presentOptions.length} of 4 options detected (${presentOptions.join(', ')}).`
        });
      }

      // 4. Answer Key validation
      if (!q.correctAnswer) {
        info.push({
          id: `info_key_${q.questionNumber}`,
          code: 'MISSING_ANSWER_KEY',
          message: `Q${q.questionNumber}: No answer key specified in source document.`
        });
      }

      if (isComplete) {
        completeQuestionsCount++;
      }
    });
  });

  const confidenceScore = Number((completeQuestionsCount / totalQuestions).toFixed(2));

  return {
    isValid: errors.length === 0,
    summary: {
      totalItems: totalQuestions,
      validCount: completeQuestionsCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      confidenceScore
    },
    errors,
    warnings,
    info
  };
}

/**
 * Universal Validator Dispatcher
 */
export function validateMappedContent(templateId, mappedData) {
  if (templateId === TEMPLATE_IDS.STUDENT_LIST) {
    return validateStudentList(mappedData);
  }
  if (templateId === TEMPLATE_IDS.QUESTION_PAPER) {
    return validateQuestionPaper(mappedData);
  }
  return {
    isValid: false,
    summary: { totalItems: 0, validCount: 0, errorCount: 1, warningCount: 0, confidenceScore: 0 },
    errors: [{ id: 'err_unknown_template', code: 'UNKNOWN_TEMPLATE', message: `Unknown template: ${templateId}` }],
    warnings: [],
    info: []
  };
}
