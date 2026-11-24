import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateFile } from './fileValidator.js';
import { extractFromPdf } from './extractors/pdfExtractor.js';
import { extractWithOcr, extractPdfWithOcr } from './extractors/ocrExtractor.js';
import { extractFromDocx } from './extractors/docxExtractor.js';
import { extractFromExcel } from './extractors/excelExtractor.js';
import { parseQuestionPaper, parseQuestionPaperRows } from './parsers/questionPaperParser.js';
import { mapColumnHeader } from './parsers/studentListParser.js';
import { classifyAndSeparateContent, USN_REGEX, QUESTION_START_REGEX, OPTION_REGEX } from './contentClassifier.js';
import { exportQuestionOutputToExcel, exportStudentOutputToExcel, QUESTION_COLUMNS, STUDENT_COLUMNS } from './exporters/smartExporter.js';
import { db } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normalizes Date of Birth to YYYY-MM-DD per specification:
 * "Format as YYYY-MM-DD when clear; if ambiguous or missing, preserve the raw value and flag [UNCLEAR: ...] rather than guessing."
 */
export function normalizeDobToYyyyMmDd(rawVal) {
  if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
    return '[UNCLEAR: missing]';
  }

  const str = String(rawVal).trim();
  if (str.startsWith('[UNCLEAR:')) return str;

  // Format 1: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) {
    const num1 = parseInt(ddmmyyyy[1], 10);
    const num2 = parseInt(ddmmyyyy[2], 10);
    const y = ddmmyyyy[3];

    // If num1 > 12: num1 must be day, num2 must be month
    if (num1 > 12 && num1 <= 31 && num2 <= 12 && num2 >= 1) {
      return `${y}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
    }
    // If num2 > 12: num2 must be day, num1 must be month (MM-DD-YYYY)
    if (num2 > 12 && num2 <= 31 && num1 <= 12 && num1 >= 1) {
      return `${y}-${String(num1).padStart(2, '0')}-${String(num2).padStart(2, '0')}`;
    }
    // Both <= 12: In Indian educational institutions, DD-MM-YYYY is standard
    if (num1 >= 1 && num1 <= 31 && num2 >= 1 && num2 <= 12) {
      return `${y}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
    }
    return `[UNCLEAR: ${str}]`;
  }

  // Format 2: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = parseInt(yyyymmdd[2], 10);
    const d = parseInt(yyyymmdd[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return `[UNCLEAR: ${str}]`;
  }

  // Format 3: Excel serial date
  if (!isNaN(str) && Number(str) > 20000 && Number(str) < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Number(str) * 86400000);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Format 4: Check if standard date string parse succeeds
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2099) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return `[UNCLEAR: ${str}]`;
}

/**
 * Extracts and cleans student records from text lines.
 */
export function extractStudentsFromTextLines(lines) {
  const records = [];
  let rowCount = 0;
  let lastStandaloneNum = null;

  lines.forEach((line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;

    const usnMatch = trimmed.match(USN_REGEX);
    if (!usnMatch) {
      const numMatch = trimmed.match(/^\s*(\d{1,4})\s*$/);
      if (numMatch) lastStandaloneNum = parseInt(numMatch[1], 10);
      return;
    }

    rowCount++;
    const usn = usnMatch[1].replace(/\s+/g, '').toUpperCase();

    // DOB extraction
    const dobMatch = trimmed.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
    const rawDob = dobMatch ? dobMatch[1] : '';
    const formattedDob = normalizeDobToYyyyMmDd(rawDob);

    // Serial number
    const slMatch = trimmed.match(/^\s*(\d{1,4})\b/);
    const serialNumber = slMatch ? parseInt(slMatch[1], 10) : (lastStandaloneNum || rowCount);
    lastStandaloneNum = null;

    // Student Name extraction & cleaning
    const tokens = trimmed.split(/[\t,;|]|\s{2,}/).map(s => s.trim()).filter(Boolean);
    let candidateName = '';

    for (const token of tokens) {
      if (token === usn || (rawDob && token.includes(rawDob)) || /^\d+$/.test(token)) continue;
      if (/^(usn|dob|name|sec|section|sem|semester|room|hall|seat|dept|sl|sno)/i.test(token)) continue;
      if (/^[A-Za-z\s.]{3,50}$/.test(token) && token.length > candidateName.length) {
        candidateName = token;
      }
    }

    if (!candidateName) {
      let cleanLine = trimmed
        .replace(usnMatch[0], '')
        .replace(dobMatch ? dobMatch[0] : '', '')
        .replace(/^\s*\d+\s*/, '')
        .trim();
      const words = cleanLine.split(/\s+/).filter(w =>
        /^[A-Za-z.]{1,}$/.test(w) &&
        !/^(usn|dob|sl|sno|si|no|sec|section|sem|semester|dept|department|room|hall|seat|name|student)$/i.test(w)
      );
      candidateName = words.join(' ') || 'Student';
    }

    // Clean extra spaces, tabs, line breaks per specification
    const cleanedName = candidateName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

    records.push({
      serialNumber,
      studentName: cleanedName,
      usn,
      dateOfBirth: formattedDob
    });
  });

  return records;
}

/**
 * Extracts student records from table/spreadsheet rows.
 */
export function extractStudentsFromTableRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const headers = Object.keys(rows[0] || {});
  const columnMapping = {};

  headers.forEach(h => {
    const field = mapColumnHeader(h);
    if (field && !columnMapping[field]) {
      columnMapping[field] = h;
    }
  });

  const records = [];
  let rowCount = 0;

  rows.forEach((row, idx) => {
    // Check if row has USN
    let usnVal = columnMapping.usn ? row[columnMapping.usn] : '';
    if (!usnVal) {
      // Search all row values for USN
      const foundVal = Object.values(row).find(v => USN_REGEX.test(String(v || '')));
      if (foundVal) {
        const m = String(foundVal).match(USN_REGEX);
        if (m) usnVal = m[1];
      }
    }

    if (!usnVal) return; // Not a valid student record

    rowCount++;
    const usn = String(usnVal).replace(/\s+/g, '').toUpperCase();

    // Student Name
    let nameVal = columnMapping.studentName ? row[columnMapping.studentName] : '';
    if (!nameVal) {
      for (const [k, v] of Object.entries(row)) {
        if (k !== columnMapping.usn && typeof v === 'string' && /^[A-Za-z\s.]{3,50}$/.test(v.trim())) {
          nameVal = v;
          break;
        }
      }
    }
    const studentName = String(nameVal || 'Student').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

    // DOB
    let rawDob = columnMapping.dob ? row[columnMapping.dob] : '';
    if (!rawDob) {
      for (const v of Object.values(row)) {
        const strV = String(v || '').trim();
        if (/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/.test(strV) || /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(strV)) {
          rawDob = strV;
          break;
        }
      }
    }
    const dateOfBirth = normalizeDobToYyyyMmDd(rawDob);

    // Serial number
    const rawSl = columnMapping.serialNumber ? row[columnMapping.serialNumber] : null;
    const serialNumber = Number(rawSl) || rowCount;

    records.push({
      serialNumber,
      studentName,
      usn,
      dateOfBirth
    });
  });

  return records;
}

/**
 * Main Smart Extraction and Content Routing Engine
 */
export async function processSmartDocumentExtraction(filePath, options = {}) {
  const {
    department = 'CSE',
    semester = 5,
    originalFilename = path.basename(filePath)
  } = options;

  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  let rawText = '';
  let extractedImages = [];
  let tableRows = [];
  let sheetsData = {};
  let isScanned = false;

  // 1. EXTRACT RAW CONTENT ACROSS ALL PAGES AND SHEETS
  if (ext === 'pdf') {
    const pdfResult = await extractFromPdf(filePath);
    rawText = pdfResult.text || '';
    extractedImages = pdfResult.images || [];
    isScanned = pdfResult.isScannedLikely;

    if (isScanned || !rawText.trim()) {
      const ocrResult = await extractPdfWithOcr(filePath, pdfResult.numPages, 'eng');
      if (ocrResult.success && ocrResult.text.trim()) {
        rawText = ocrResult.text;
      }
    }
  } else if (ext === 'docx') {
    const docxResult = await extractFromDocx(filePath);
    rawText = docxResult.textWithImageMarkers || docxResult.text || '';
    extractedImages = docxResult.images || [];
  } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const excelResult = await extractFromExcel(filePath);
    tableRows = excelResult.primaryRows || [];
    sheetsData = excelResult.sheets || {};
    extractedImages = excelResult.images || [];
  } else if (ext === 'txt') {
    rawText = fs.readFileSync(filePath, 'utf8');
  } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
    const ocrResult = await extractWithOcr(filePath);
    if (ocrResult.success && ocrResult.text.trim()) {
      rawText = ocrResult.text;
    }
  }

  // 2. CLASSIFY AND STRICTLY SEPARATE DATA TYPES
  const separation = classifyAndSeparateContent({
    rawText,
    tableRows,
    sheetsData,
    extractedImages
  });

  // 3. PROCESS QUESTION OUTPUT (Strictly MCQs, Never Student Rows)
  let questionOutputRows = [];
  if (separation.hasQuestions) {
    if (separation.separatedQuestionRows.length > 0) {
      const parsedRows = parseQuestionPaperRows(separation.separatedQuestionRows, { department, semester });
      let slNo = 1;
      for (const module of parsedRows.modules || []) {
        for (const q of module.questions || []) {
          questionOutputRows.push({
            'Sl.no.': slNo++,
            'Questions': q.questionText || '',
            'Question image': q.questionImage || '',
            'option A': q.options?.A?.text || '',
            'option A img': q.options?.A?.image || '',
            'option B': q.options?.B?.text || '',
            'option B img': q.options?.B?.image || '',
            'option C': q.options?.C?.text || '',
            'option C img': q.options?.C?.image || '',
            'option D ': q.options?.D?.text || '',
            'option D  img': q.options?.D?.image || '',
            'Key Answer': q.correctAnswer ? q.correctAnswer : 'Not provided in source',
            moduleNumber: q.moduleNumber || module.moduleNumber || 1
          });
        }
      }
    } else if (separation.questionText.trim()) {
      const parsedText = parseQuestionPaper(separation.questionText, separation.extractedImages, { department, semester });
      let slNo = 1;
      for (const module of parsedText.modules || []) {
        for (const q of module.questions || []) {
          questionOutputRows.push({
            'Sl.no.': slNo++,
            'Questions': q.questionText || '',
            'Question image': q.questionImage || '',
            'option A': q.options?.A?.text || '',
            'option A img': q.options?.A?.image || '',
            'option B': q.options?.B?.text || '',
            'option B img': q.options?.B?.image || '',
            'option C': q.options?.C?.text || '',
            'option C img': q.options?.C?.image || '',
            'option D ': q.options?.D?.text || '',
            'option D  img': q.options?.D?.image || '',
            'Key Answer': q.correctAnswer ? q.correctAnswer : 'Not provided in source',
            moduleNumber: q.moduleNumber || module.moduleNumber || 1
          });
        }
      }
    }
  }

  // 4. PROCESS STUDENT OUTPUT (Strictly Student Records, Never Questions)
  let studentOutputRows = [];
  if (separation.hasStudents) {
    let rawStudentRecords = [];
    if (separation.separatedStudentRows.length > 0) {
      rawStudentRecords = extractStudentsFromTableRows(separation.separatedStudentRows);
    }
    if (rawStudentRecords.length === 0 && separation.studentText.trim()) {
      const studentLines = separation.studentText.split(/\r?\n/).filter(Boolean);
      rawStudentRecords = extractStudentsFromTextLines(studentLines);
    }
    // Also if rawText had students and studentText missed some lines
    if (rawStudentRecords.length === 0 && rawText.trim()) {
      const allLines = rawText.split(/\r?\n/).filter(Boolean);
      rawStudentRecords = extractStudentsFromTextLines(allLines);
    }

    let slNo = 1;
    studentOutputRows = rawStudentRecords.map(r => ({
      'Sl.no.': slNo++,
      'Student Name': r.studentName,
      'USN': r.usn,
      'Date of Birth': r.dateOfBirth
    }));
  }

  // 5. ENFORCE SEPARATION AND ROUTING RULES
  // "If a file has only one type of data, populate that output completely and leave the other output empty."
  // "Never mix student rows into the question output, and never mix questions or answer keys into the student output."
  const finalHasQuestions = questionOutputRows.length > 0;
  const finalHasStudents = studentOutputRows.length > 0;

  const detectedTypes = [];
  if (finalHasQuestions) detectedTypes.push('question_paper');
  if (finalHasStudents) detectedTypes.push('student_list');

  return {
    success: true,
    originalFilename,
    detectedTypes,
    hasQuestions: finalHasQuestions,
    hasStudents: finalHasStudents,
    questionOutput: {
      totalQuestions: questionOutputRows.length,
      columns: QUESTION_COLUMNS,
      rows: questionOutputRows
    },
    studentOutput: {
      totalStudents: studentOutputRows.length,
      columns: STUDENT_COLUMNS,
      rows: studentOutputRows
    }
  };
}
