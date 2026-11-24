/**
 * Content Classifier for Multi-Format Document Extraction and Routing Engine
 *
 * Inspects raw text, table rows, and spreadsheet sheets to detect and separate
 * Question Paper content and Student List content strictly by data type.
 */

// Broad USN pattern: e.g. 4MH24CS001, 4XX23CS001, 1MS20EC015, MIT24CS001
export const USN_REGEX = /\b([0-9][A-Z]{2}\s*[0-9]{2}\s*[A-Z]{2,4}\s*[0-9]{3}|[A-Z]{3}\s*[0-9]{2}\s*[A-Z]{2,4}\s*[0-9]{3})\b/i;

// MCQ question start pattern: "1. ", "Q1. ", "Question 1:", "1) "
export const QUESTION_START_REGEX = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})(?:[\.\)\-:]\s*|\s{2,})(.*)$/i;

// MCQ Option pattern: "(A) ...", "A. ...", "A) ...", "[A] ..."
export const OPTION_REGEX = /^\s*(?:\(?([A-Da-d])\)?[\.\)\-:]|\[([A-Da-d])\])\s+(.*)$/;

// Answer key pattern: "Ans: B", "Answer: C", "Key: A", "Correct Option: D"
export const ANSWER_KEY_REGEX = /^\s*(?:Ans(?:wer)?|Key|Correct(?:\s*Answer|\s*Option)?)\s*[:\-–]?\s*\(?([A-Da-d])\)?\b/i;

// Module / Section heading
export const MODULE_HEADING_REGEX = /^(?:MODULE|UNIT|PART|SECTION)\s*[-:]?\s*([0-9IVXLCDM]+|[A-Z])(?:\s*[:\-–]\s*(.*))?$/i;

const STUDENT_HEADER_KEYWORDS = [
  'usn', 'university seat number', 'register number', 'reg number', 'reg no', 'reg_no', 'regno',
  'roll number', 'roll no', 'roll_no', 'student name', 'candidate name', 'date of birth', 'dob'
];

const QUESTION_HEADER_KEYWORDS = [
  'question', 'questions', 'questiontext', 'problem', 'statement',
  'option a', 'option b', 'option c', 'option d', 'optiona', 'optionb', 'optionc', 'optiond',
  'key answer', 'answer key', 'correct answer'
];

function normalizeStr(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Classifies an individual line of text.
 * Returns: 'question_start' | 'option' | 'answer_key' | 'module_heading' | 'student' | 'neutral'
 */
export function classifyTextLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return 'neutral';

  // Check for student record (has USN)
  if (USN_REGEX.test(trimmed)) {
    return 'student';
  }

  // Check module heading
  if (MODULE_HEADING_REGEX.test(trimmed)) {
    return 'module_heading';
  }

  // Check answer key
  if (ANSWER_KEY_REGEX.test(trimmed)) {
    return 'answer_key';
  }

  // Check option
  if (OPTION_REGEX.test(trimmed)) {
    return 'option';
  }

  // Check question start
  if (QUESTION_START_REGEX.test(trimmed)) {
    return 'question_start';
  }

  return 'neutral';
}

/**
 * Classifies a spreadsheet or table sheet based on its headers and row contents
 */
export function classifyTableSheet(sheetName, headers = [], rows = []) {
  const normHeaders = headers.map(normalizeStr);

  let studentHeaderMatches = 0;
  for (const kw of STUDENT_HEADER_KEYWORDS) {
    const normKw = normalizeStr(kw);
    if (normHeaders.some(h => h === normKw || h.includes(normKw))) {
      studentHeaderMatches++;
    }
  }

  let questionHeaderMatches = 0;
  for (const kw of QUESTION_HEADER_KEYWORDS) {
    const normKw = normalizeStr(kw);
    if (normHeaders.some(h => h === normKw || h.includes(normKw))) {
      questionHeaderMatches++;
    }
  }

  // Also sample rows
  let usnRowCount = 0;
  let mcqRowCount = 0;
  const sampleRows = rows.slice(0, 30);

  sampleRows.forEach(row => {
    const rowValues = Object.values(row || {}).map(v => String(v || ''));
    const rowJoined = rowValues.join(' ');

    if (USN_REGEX.test(rowJoined)) {
      usnRowCount++;
    }

    const hasQuestionKey = Object.keys(row || {}).some(k =>
      ['question', 'questions', 'optiona', 'optionb', 'optionc', 'optiond'].includes(normalizeStr(k))
    );
    if (hasQuestionKey || rowValues.some(v => OPTION_REGEX.test(v) || QUESTION_START_REGEX.test(v))) {
      mcqRowCount++;
    }
  });

  const isStudentSheet = studentHeaderMatches >= 2 || usnRowCount >= 2;
  const isQuestionSheet = questionHeaderMatches >= 2 || mcqRowCount >= 2;

  return {
    sheetName,
    isStudentSheet,
    isQuestionSheet,
    studentHeaderMatches,
    questionHeaderMatches,
    usnRowCount,
    mcqRowCount
  };
}

/**
 * Inspects all extracted content across text and sheets to determine
 * what data types exist, and separates them cleanly.
 */
export function classifyAndSeparateContent({ rawText = '', tableRows = [], sheetsData = {}, extractedImages = [] }) {
  const lines = rawText ? rawText.split(/\r?\n/) : [];

  let questionLines = [];
  let studentLines = [];
  let neutralLines = [];

  let inQuestionBlock = false;
  let inStudentBlock = false;

  // Multi-pass line segmentation
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineType = classifyTextLine(line);

    if (lineType === 'student') {
      studentLines.push(line);
      inStudentBlock = true;
      inQuestionBlock = false;
    } else if (lineType === 'question_start' || lineType === 'module_heading' || lineType === 'option' || lineType === 'answer_key') {
      questionLines.push(line);
      inQuestionBlock = true;
      inStudentBlock = false;
    } else {
      // Neutral line: decide based on context
      if (inQuestionBlock) {
        // Line continuation of a question stem or option
        questionLines.push(line);
      } else if (inStudentBlock && /^\s*(\d{1,4})\s*$/.test(line)) {
        // Standalone serial number for next student
        studentLines.push(line);
      } else {
        neutralLines.push(line);
      }
    }
  }

  // Count detections in text
  const totalUsnsInText = (rawText.match(new RegExp(USN_REGEX.source, 'gi')) || []).length;
  const totalQuestionsInText = questionLines.filter(l => QUESTION_START_REGEX.test(l)).length;

  // Process spreadsheet sheets
  const separatedQuestionRows = [];
  const separatedStudentRows = [];

  const sheetEntries = Object.entries(sheetsData);

  if (sheetEntries.length > 0) {
    sheetEntries.forEach(([sheetName, sheet]) => {
      const classification = classifyTableSheet(sheetName, sheet.headers || [], sheet.rows || []);

      if (classification.isStudentSheet && !classification.isQuestionSheet) {
        separatedStudentRows.push(...sheet.rows);
      } else if (classification.isQuestionSheet && !classification.isStudentSheet) {
        separatedQuestionRows.push(...sheet.rows);
      } else {
        // Ambiguous or mixed sheet: inspect row by row
        (sheet.rows || []).forEach(row => {
          const rowStr = Object.values(row).join(' ');
          if (USN_REGEX.test(rowStr)) {
            separatedStudentRows.push(row);
          } else {
            const hasQ = Object.keys(row).some(k =>
              ['question', 'questions', 'optiona', 'optionb'].includes(normalizeStr(k))
            );
            if (hasQ || QUESTION_START_REGEX.test(rowStr)) {
              separatedQuestionRows.push(row);
            }
          }
        });
      }
    });
  } else if (tableRows.length > 0) {
    tableRows.forEach(row => {
      const rowStr = Object.values(row).join(' ');
      if (USN_REGEX.test(rowStr)) {
        separatedStudentRows.push(row);
      } else {
        const hasQ = Object.keys(row).some(k =>
          ['question', 'questions', 'optiona', 'optionb'].includes(normalizeStr(k))
        );
        if (hasQ || QUESTION_START_REGEX.test(rowStr)) {
          separatedQuestionRows.push(row);
        }
      }
    });
  }

  const hasQuestions = totalQuestionsInText > 0 || separatedQuestionRows.length > 0;
  const hasStudents = totalUsnsInText > 0 || separatedStudentRows.length > 0 || studentLines.length > 0;

  return {
    hasQuestions,
    hasStudents,
    totalQuestionsDetected: totalQuestionsInText + separatedQuestionRows.length,
    totalStudentsDetected: totalUsnsInText + separatedStudentRows.length,
    questionText: questionLines.join('\n'),
    studentText: studentLines.join('\n'),
    separatedQuestionRows,
    separatedStudentRows,
    extractedImages
  };
}
