/**
 * Fixed Institutional Destination Template Registry
 *
 * Defines the strict, predefined institutional templates supported by the system.
 * Users may NOT upload arbitrary destination templates; only these fixed templates
 * can be targeted for conversion.
 */

export const TEMPLATE_IDS = {
  QUESTION_PAPER: 'QUESTION_PAPER',
  STUDENT_LIST: 'STUDENT_LIST'
};

export const FIXED_TEMPLATES = {
  [TEMPLATE_IDS.QUESTION_PAPER]: {
    id: TEMPLATE_IDS.QUESTION_PAPER,
    canonicalId: 'template_qp_standard_v1',
    displayName: 'Institutional Question Paper Template',
    description: 'Converts MCQ question papers into the standardized 12-column multi-module institutional Excel format.',
    fileExtension: 'xlsx',
    templateFile: 'q_template.xlsx',
    sheetStructure: {
      type: 'module_based',
      defaultSheetNames: ['Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5'],
      dynamicSheetsAllowed: true,
      sheetPrefix: 'Module '
    },
    columns: [
      { key: 'slNo', header: 'Sl.no.', required: true, type: 'number', order: 1 },
      { key: 'questionText', header: 'Questions', required: true, type: 'string', order: 2 },
      { key: 'questionImage', header: 'Question image', required: false, type: 'image_ref', order: 3 },
      { key: 'optionA', header: 'option A', required: true, type: 'string', order: 4 },
      { key: 'optionAImg', header: 'option A img', required: false, type: 'image_ref', order: 5 },
      { key: 'optionB', header: 'option B', required: true, type: 'string', order: 6 },
      { key: 'optionBImg', header: 'option B img', required: false, type: 'image_ref', order: 7 },
      { key: 'optionC', header: 'option C', required: true, type: 'string', order: 8 },
      { key: 'optionCImg', header: 'option C img', required: false, type: 'image_ref', order: 9 },
      { key: 'optionD', header: 'option D ', required: true, type: 'string', order: 10 },
      { key: 'optionDImg', header: 'option D  img', required: false, type: 'image_ref', order: 11 },
      { key: 'correctAnswer', header: 'Key Answer', required: false, type: 'string', order: 12 }
    ],
    standardHeaders: [
      'Sl.no.',
      'Questions',
      'Question image',
      'option A',
      'option A img',
      'option B',
      'option B img',
      'option C',
      'option C img',
      'option D ',
      'option D  img',
      'Key Answer'
    ],
    validationRules: {
      requireQuestionText: true,
      allowedAnswers: ['A', 'B', 'C', 'D'],
      optionsRequiredCount: 4,
      allowPartialOptionsWithWarning: true
    }
  },

  [TEMPLATE_IDS.STUDENT_LIST]: {
    id: TEMPLATE_IDS.STUDENT_LIST,
    canonicalId: 'template_sl_standard_v1',
    displayName: 'Institutional Student List Template',
    description: 'Converts student nominal rolls and lists into the standard 4-column locked COE institutional Excel format.',
    fileExtension: 'xlsx',
    templateFile: 'std_template.xlsx',
    sheetStructure: {
      type: 'single_sheet',
      sheetName: 'Sheet1',
      dynamicSheetsAllowed: false
    },
    columns: [
      { key: 'serialNumber', header: 'Sl.no.', required: true, type: 'number', order: 1 },
      { key: 'studentName', header: 'Student Name', required: true, type: 'string', order: 2 },
      { key: 'usn', header: 'USN', required: true, type: 'string', pattern: '^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$', order: 3 },
      { key: 'dateOfBirth', header: 'Date of Birth', required: true, type: 'date', order: 4 }
    ],
    standardHeaders: [
      'Sl.no.',
      'Student Name',
      'USN',
      'Date of Birth'
    ],
    validationRules: {
      requireStudentName: true,
      requireUsn: true,
      requireDob: false, // flagged with warning if missing
      rejectDuplicateUsn: false, // flagged as duplicate without silent drop
      usnPattern: /^[0-9][A-Z]{2}\s*[0-9]{2}\s*[A-Z]{2,4}\s*[0-9]{3}$/i
    }
  }
};

/**
 * Normalizes template ID input to canonical format
 */
export function normalizeTemplateId(id) {
  if (!id) return null;
  const upper = String(id).toUpperCase().replace(/[\s-]/g, '_');
  if (upper === 'QUESTION_PAPER' || upper === 'QUESTIONPAPER' || upper === 'QP' || upper === 'TEMPLATE_QP_STANDARD_V1') {
    return TEMPLATE_IDS.QUESTION_PAPER;
  }
  if (upper === 'STUDENT_LIST' || upper === 'STUDENTLIST' || upper === 'SL' || upper === 'TEMPLATE_SL_STANDARD_V1') {
    return TEMPLATE_IDS.STUDENT_LIST;
  }
  return null;
}

/**
 * Returns all registered templates
 */
export function getAllTemplates() {
  return Object.values(FIXED_TEMPLATES).map(tpl => ({
    id: tpl.id,
    canonicalId: tpl.canonicalId,
    displayName: tpl.displayName,
    description: tpl.description,
    fileExtension: tpl.fileExtension,
    standardHeaders: tpl.standardHeaders,
    columns: tpl.columns,
    sheetStructure: tpl.sheetStructure
  }));
}

/**
 * Retrieves a template by ID
 */
export function getTemplate(id) {
  const normId = normalizeTemplateId(id);
  if (!normId || !FIXED_TEMPLATES[normId]) {
    return null;
  }
  return FIXED_TEMPLATES[normId];
}

/**
 * Validates whether the requested destination template is allowed
 */
export function validateDestinationTemplate(id) {
  const normId = normalizeTemplateId(id);
  if (!normId || !FIXED_TEMPLATES[normId]) {
    return {
      valid: false,
      error: `Invalid destination template "${id}". Only predefined institutional templates are supported: ${Object.keys(FIXED_TEMPLATES).join(', ')}.`
    };
  }
  return {
    valid: true,
    templateId: normId,
    template: FIXED_TEMPLATES[normId]
  };
}
