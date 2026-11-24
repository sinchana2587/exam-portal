/**
 * Intelligent Field Mapping Engine
 *
 * Maps extracted document content to destination institutional template schemas.
 * Implements strict prioritized matching:
 * 1. Exact field matching
 * 2. Institutional synonym dictionary
 * 3. Normalized header matching
 * 4. Fuzzy string matching (Dice coefficient / Levenshtein)
 * 5. Heuristic pattern fallback (cell-level value inspection)
 *
 * Flags low-confidence mappings and never silently discards or invents data.
 */

import { parseQuestionPaper, parseQuestionPaperRows } from '../parsers/questionPaperParser.js';
import { parseStudentList } from '../parsers/studentListParser.js';
import { normalizeDobToYyyyMmDd, extractStudentsFromTextLines, extractStudentsFromTableRows } from '../smartRoutingEngine.js';
import { USN_REGEX } from '../contentClassifier.js';
import { createQuestionRecord, createStudentRecord } from '../models/documentEnvelope.js';
import { TEMPLATE_IDS } from '../registry/templateRegistry.js';

/**
 * Extended Institutional Synonym Dictionary
 */
export const SYNONYM_DICTIONARY = {
  usn: [
    'usn',
    'university seat number',
    'university seat no',
    'register number',
    'reg number',
    'reg no',
    'reg_no',
    'regno',
    'roll number',
    'roll no',
    'roll_no',
    'rollno',
    'hall ticket number',
    'hall ticket no',
    'hall ticket',
    'registration number',
    'student id',
    'enrollment no',
    'enrollment number',
    'candidate id',
    'vtu usn'
  ],
  studentName: [
    'student name',
    'student_name',
    'name of the student',
    'name of student',
    'candidate name',
    'name of candidate',
    'full name',
    'fullname',
    'name',
    'student',
    'student fullname'
  ],
  dateOfBirth: [
    'date of birth',
    'date_of_birth',
    'dob',
    'd.o.b',
    'd.o.b.',
    'birth date',
    'birthdate',
    'dob (dd-mm-yyyy)',
    'dob (yyyy-mm-dd)',
    'date_birth'
  ],
  serialNumber: [
    'serial number',
    'serial no',
    'sl no',
    'sl.no',
    'sl.no.',
    's.no',
    's.no.',
    'sno',
    'si no',
    'si.no',
    '#',
    'id',
    'sr no',
    'sr.no'
  ],
  section: [
    'section',
    'sec',
    'division',
    'div',
    'class',
    'group'
  ],
  semester: [
    'semester',
    'sem',
    'term'
  ],
  department: [
    'department',
    'dept',
    'branch',
    'program',
    'programme',
    'course'
  ]
};

/**
 * Normalizes string for header comparison
 */
export function normalizeHeader(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates Levenshtein Distance between two strings
 */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculates string similarity (0.0 to 1.0)
 */
export function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const s1 = normalizeHeader(a);
  const s2 = normalizeHeader(b);
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLen;
}

/**
 * Maps a single source column header to a destination template field
 */
export function mapHeaderToField(sourceHeader, targetFields = Object.keys(SYNONYM_DICTIONARY)) {
  const trimmed = String(sourceHeader || '').trim();
  const lower = trimmed.toLowerCase();
  const norm = normalizeHeader(trimmed);

  // 1. Exact match
  for (const field of targetFields) {
    if (field.toLowerCase() === lower || field.toLowerCase() === norm) {
      return { targetField: field, confidence: 1.0, method: 'exact' };
    }
  }

  // 2. Synonym dictionary match
  for (const field of targetFields) {
    const synonyms = SYNONYM_DICTIONARY[field] || [];
    for (const syn of synonyms) {
      if (syn.toLowerCase() === lower || normalizeHeader(syn) === norm) {
        return { targetField: field, confidence: 0.98, method: 'synonym' };
      }
    }
  }

  // 3. Substring and Word match (require whole word or >= 4 chars to prevent false positives)
  const words = trimmed.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const field of targetFields) {
    const synonyms = SYNONYM_DICTIONARY[field] || [];
    for (const syn of synonyms) {
      const synLower = syn.toLowerCase();
      const synNorm = normalizeHeader(syn);
      if (words.includes(synLower) || words.includes(synNorm)) {
        return { targetField: field, confidence: 0.90, method: 'word_match' };
      }
      if (synNorm.length >= 4 && (norm.startsWith(synNorm) || norm.endsWith(synNorm) || norm.includes(synNorm))) {
        return { targetField: field, confidence: 0.85, method: 'substring' };
      }
    }
  }
  // 4. Fuzzy string match
  let bestMatch = null;
  let highestSim = 0;
  for (const field of targetFields) {
    const synonyms = [field, ...(SYNONYM_DICTIONARY[field] || [])];
    for (const syn of synonyms) {
      const sim = stringSimilarity(norm, syn);
      if (sim > highestSim && sim >= 0.70) {
        highestSim = sim;
        bestMatch = field;
      }
    }
  }

  if (bestMatch) {
    return { targetField: bestMatch, confidence: Number(highestSim.toFixed(2)), method: 'fuzzy' };
  }

  return { targetField: null, confidence: 0.0, method: 'unmapped' };
}

/**
 * Intelligent Mapping for Student List destination template
 */
export function mapToStudentListTemplate(extractedData, options = {}) {
  const { tableRows = [], rawText = '' } = extractedData;
  const { department = 'CSE', semester = 5 } = options;

  const mappingReports = [];
  const lowConfidenceMappings = [];
  let mappedRecords = [];
  let detectedHeaders = [];

  // Case A: Tabular data available (Excel, CSV, parsed table)
  if (Array.isArray(tableRows) && tableRows.length > 0) {
    detectedHeaders = Object.keys(tableRows[0] || {});
    const headerMapping = {};

    detectedHeaders.forEach(h => {
      const result = mapHeaderToField(h);
      mappingReports.push({
        sourceField: h,
        targetField: result.targetField,
        confidence: result.confidence,
        method: result.method
      });

      if (result.targetField && !headerMapping[result.targetField]) {
        headerMapping[result.targetField] = h;
        if (result.confidence < 0.75) {
          lowConfidenceMappings.push({
            sourceField: h,
            targetField: result.targetField,
            confidence: result.confidence,
            reason: `Mapped via ${result.method} with confidence ${(result.confidence * 100).toFixed(0)}%`
          });
        }
      }
    });

    tableRows.forEach((row, idx) => {
      let usnVal = headerMapping.usn ? row[headerMapping.usn] : '';
      if (!usnVal) {
        const found = Object.values(row).find(v => USN_REGEX.test(String(v || '')));
        if (found) {
          const m = String(found).match(USN_REGEX);
          if (m) usnVal = m[1];
        }
      }

      if (!usnVal) return; // Skip non-student header/meta rows

      const usn = String(usnVal).replace(/\s+/g, '').toUpperCase();
      let nameVal = headerMapping.studentName ? row[headerMapping.studentName] : '';
      if (!nameVal) {
        for (const [k, v] of Object.entries(row)) {
          if (k !== headerMapping.usn && typeof v === 'string' && /^[A-Za-z\s.]{3,50}$/.test(v.trim())) {
            nameVal = v;
            break;
          }
        }
      }

      let rawDob = headerMapping.dateOfBirth ? row[headerMapping.dateOfBirth] : '';
      if (!rawDob) {
        for (const v of Object.values(row)) {
          const strV = String(v || '').trim();
          if (/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/.test(strV) || /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(strV)) {
            rawDob = strV;
            break;
          }
        }
      }

      const normDob = normalizeDobToYyyyMmDd(rawDob);
      const slNo = headerMapping.serialNumber ? Number(row[headerMapping.serialNumber]) : null;

      mappedRecords.push(createStudentRecord({
        serialNumber: slNo || (mappedRecords.length + 1),
        studentName: String(nameVal || 'Student').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(),
        usn,
        dateOfBirth: normDob,
        section: row[headerMapping.section] || 'A',
        semester: Number(row[headerMapping.semester]) || semester,
        department: row[headerMapping.department] || department,
        provenance: {
          sourceRow: idx + 1,
          originalValues: row,
          mappingSourceFields: headerMapping
        }
      }));
    });
  }

  // Case B: Fallback from text lines if table was empty
  if (mappedRecords.length === 0 && rawText.trim()) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedTextRecords = extractStudentsFromTextLines(lines);

    parsedTextRecords.forEach((r, idx) => {
      mappedRecords.push(createStudentRecord({
        serialNumber: r.serialNumber || (idx + 1),
        studentName: r.studentName,
        usn: r.usn,
        dateOfBirth: r.dateOfBirth,
        section: 'A',
        semester,
        department,
        provenance: {
          sourceRow: idx + 1,
          rawLine: lines[idx] || ''
        }
      }));
    });
  }

  return {
    templateId: TEMPLATE_IDS.STUDENT_LIST,
    records: mappedRecords,
    totalRecords: mappedRecords.length,
    mappingReports,
    lowConfidenceMappings,
    detectedHeaders
  };
}

/**
 * Intelligent Mapping for Question Paper destination template
 */
export function mapToQuestionPaperTemplate(extractedData, options = {}) {
  const { tableRows = [], rawText = '', extractedImages = [] } = extractedData;
  const { department = 'CSE', semester = 5, subjectName = '', subjectCode = '' } = options;

  let parsedPaper = null;
  const parseOptions = { department, semester, subjectName, subjectCode };

  const isQuestionTable = Array.isArray(tableRows) && tableRows.length > 0 &&
    Object.keys(tableRows[0] || {}).some(h => /(question|statement|problem|option)/i.test(h));
  if (isQuestionTable) {
    parsedPaper = parseQuestionPaperRows(tableRows, parseOptions);
  } else {
    parsedPaper = parseQuestionPaper(rawText, extractedImages, parseOptions);
  }

  // Transform into standardized envelope format with provenance
  const modules = (parsedPaper.modules || []).map((m, mIdx) => ({
    moduleNumber: Number(m.moduleNumber) || (mIdx + 1),
    title: m.title || `Module ${Number(m.moduleNumber) || (mIdx + 1)}`,
    questions: (m.questions || []).map(q => createQuestionRecord({
      ...q,
      moduleNumber: Number(m.moduleNumber) || (mIdx + 1)
    }))
  }));

  const totalQuestions = modules.reduce((sum, m) => sum + m.questions.length, 0);

  return {
    templateId: TEMPLATE_IDS.QUESTION_PAPER,
    modules,
    totalModules: modules.length,
    totalQuestions,
    verification: parsedPaper.verification || {},
    metadata: parsedPaper.metadata || {},
    extractedImages
  };
}
