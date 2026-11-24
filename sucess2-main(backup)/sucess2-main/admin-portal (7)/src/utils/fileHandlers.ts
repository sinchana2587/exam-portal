import * as XLSX from 'xlsx';
import { ParsedStudentRow, studentService } from '../services/studentService';
import {
  downloadQuestionExcelTemplateLocal,
  downloadStudentExcelTemplateLocal,
  parseQuestionWorkbookInBrowser,
} from './browserExcelService';
import { getAllowedDeptBranchPrefixes, validateInstitutionalUsn } from './usnValidator';
import { AuthUser, QuestionImageAsset, QuestionItem } from '../types';

export const STUDENT_EXCEL_HEADERS = ['Sl.no.', 'Student Name', 'USN', 'Date of Birth'];
export const QUESTION_EXCEL_HEADERS = [
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
  'Key Answer',
];

export interface StudentExcelContext {
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  section: string;
}

export interface StudentExcelParseResult {
  success: boolean;
  fatalError?: string;
  fileName: string;
  fileSizeBytes: number;
  rows: ParsedStudentRow[];
  validCount: number;
  invalidCount: number;
}

export interface ParsedQuestionRow {
  rowNumber: number;
  worksheetName?: string;
  moduleNumber: number | null;
  moduleRaw: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  questionImages: QuestionImageAsset[];
  optionAImages: QuestionImageAsset[];
  optionBImages: QuestionImageAsset[];
  optionCImages: QuestionImageAsset[];
  optionDImages: QuestionImageAsset[];
  isValid: boolean;
  errors: string[];
}

export interface QuestionExcelParseResult {
  success: boolean;
  fatalError?: string;
  fileName: string;
  fileSizeBytes: number;
  rows: ParsedQuestionRow[];
  validCount: number;
  invalidCount: number;
  totalImagesExtracted: number;
  questionsWithImagesCount?: number;
  optionsWithImagesCount?: number;
  moduleBreakdown?: Record<number, number>;
}

function normalizeExcelDob(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return String(raw);
  }
  let str = String(raw).trim();
  str = str.replace(/[T\s].*$/, '').trim();

  // Match DD-MM-YYYY or DD/MM/YYYY (with 1 or 2 digits for day/month)
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD (with 1 or 2 digits for day/month)
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const parsedDate = Date.parse(str);
  if (!isNaN(parsedDate)) {
    const dt = new Date(parsedDate);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    if (y >= 1970 && y <= 2025) {
      return `${y}-${m}-${d}`;
    }
  }

  return str;
}

function isValidIsoDate(val: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    y >= 1970 &&
    y <= 2025
  );
}

function isMetadataOrHeaderText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^(department|semester|section|usn|student\s*name|dob|date\s*of\s*birth)\s*[:|]?/i.test(
    trimmed
  );
}

export async function downloadStudentExcelTemplate(
  departmentCode: string,
  semesterNumber: number,
  section: string
): Promise<void> {
  await downloadStudentExcelTemplateLocal(departmentCode, semesterNumber, section);
}

export async function downloadQuestionExcelTemplate(
  subjectCode: string,
  moduleNumber: number
): Promise<void> {
  await downloadQuestionExcelTemplateLocal(subjectCode, moduleNumber);
}

export async function parseAndValidateStudentExcel(
  file: File,
  context: StudentExcelContext
): Promise<StudentExcelParseResult> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    return {
      success: false,
      fatalError: 'Unsupported file format. Please upload a valid Excel workbook (.xlsx or .xls).',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  let matrix: unknown[][] = [];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        fatalError: 'The uploaded workbook contains no worksheets.',
        fileName: file.name,
        fileSizeBytes: file.size,
        rows: [],
        validCount: 0,
        invalidCount: 0,
      };
    }
    const sheet = workbook.Sheets[firstSheetName];
    matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  } catch (err) {
    return {
      success: false,
      fatalError:
        err instanceof Error
          ? `Failed to parse Excel file: ${err.message}`
          : 'Unable to parse the uploaded Excel workbook.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  if (matrix.length < 2) {
    return {
      success: false,
      fatalError: 'The Excel worksheet has no student rows below the header row.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  let headerRowIdx = -1;
  let rawHeaders: string[] = [];
  let normalizedHeaders: string[] = [];
  let usnIdx = -1;
  let nameIdx = -1;
  let dobIdx = -1;

  for (let r = 0; r < Math.min(matrix.length, 6); r++) {
    const rowCells = (matrix[r] || []).map((h) => String(h).trim()).filter(Boolean);
    const norm = rowCells.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const uIdx = norm.findIndex((h) => h === 'usn' || h.includes('seatnumber') || h.includes('regno'));
    const nIdx = norm.findIndex((h) => h.includes('studentname') || h === 'name' || h.includes('fullname'));
    const dIdx = norm.findIndex((h) => h.includes('dateofbirth') || h === 'dob' || h.includes('birthdate'));

    if (uIdx !== -1 || (nIdx !== -1 && dIdx !== -1)) {
      headerRowIdx = r;
      rawHeaders = rowCells;
      normalizedHeaders = norm;
      usnIdx = uIdx;
      nameIdx = nIdx;
      dobIdx = dIdx;
      break;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    rawHeaders = (matrix[0] || []).map((h) => String(h).trim()).filter(Boolean);
    normalizedHeaders = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  }

  if (normalizedHeaders.some((h) => h === 'section')) {
    return {
      success: false,
      fatalError:
        'Remove the "Section" column. Section assignment is inherited automatically from the selected Student Lists section tab.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  // Support both 3-column (USN, Student Name, DOB) and 4-column (Sl.no., Student Name, USN, DOB) formats
  if (usnIdx === -1 && rawHeaders.length >= 4) usnIdx = 2;
  if (nameIdx === -1 && rawHeaders.length >= 4) nameIdx = 1;
  if (dobIdx === -1 && rawHeaders.length >= 4) dobIdx = 3;

  if (usnIdx === -1 && rawHeaders.length === 3) usnIdx = 0;
  if (nameIdx === -1 && rawHeaders.length === 3) nameIdx = 1;
  if (dobIdx === -1 && rawHeaders.length === 3) dobIdx = 2;

  if (usnIdx === -1 || nameIdx === -1 || dobIdx === -1) {
    return {
      success: false,
      fatalError: `Incorrect spreadsheet columns. Expected columns: USN, Student Name, DOB (or Sl.no, Student Name, USN, Date of Birth). Found "${rawHeaders.join(', ')}".`,
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  const dataRows = matrix
    .slice(headerRowIdx + 1)
    .map((row, i) => ({ row, rowNumber: headerRowIdx + i + 2 }))
    .filter(({ row }) => row.some((cell) => String(cell).trim() !== ''));

  if (dataRows.length === 0) {
    return {
      success: false,
      fatalError: 'All rows below the header are blank.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
    };
  }

  const usnsInFile = dataRows.map(({ row }) => String(row[usnIdx] ?? '').trim().toUpperCase());
  const seenInFile = new Map<string, number>();
  const duplicateUsnsInFile = new Set<string>();
  usnsInFile.forEach((u) => {
    if (!u) return;
    const prev = seenInFile.get(u) || 0;
    seenInFile.set(u, prev + 1);
    if (prev >= 1) duplicateUsnsInFile.add(u);
  });

  let externalConflicts: Record<string, string> = {};
  try {
    externalConflicts = await studentService.findCrossSectionOrDeptUsnConflicts(
      context.departmentId,
      context.semesterNumber,
      context.section,
      usnsInFile.filter(Boolean)
    );
  } catch (conflictErr) {
    console.warn('Cross-section USN conflict pre-validation skipped:', conflictErr);
  }

  getAllowedDeptBranchPrefixes(context.departmentCode);

  const parsedRows: ParsedStudentRow[] = dataRows.map(({ row, rowNumber }) => {
    const usn = String(row[usnIdx] ?? '').trim().toUpperCase();
    const studentName = String(row[nameIdx] ?? '').trim();
    const dob = normalizeExcelDob(row[dobIdx]);
    const errors: string[] = [];

    const usnCheck = validateInstitutionalUsn(usn, context.departmentCode);
    if (!usnCheck.valid) {
      errors.push(`USN: ${usnCheck.error}`);
    } else {
      if (duplicateUsnsInFile.has(usn)) {
        errors.push(`USN: Duplicate USN "${usn}" appears multiple times inside this file.`);
      }
      if (externalConflicts[usn]) {
        errors.push(`USN: ${externalConflicts[usn]}.`);
      }
    }

    if (!studentName || studentName.includes('?')) {
      errors.push('Student Name: Missing or unreadable student name.');
    } else if (/^\d+$/.test(studentName) || studentName.length < 2) {
      errors.push('Student Name: Invalid student name.');
    } else if (isMetadataOrHeaderText(studentName)) {
      errors.push('Student Name: Contains document metadata instead of a student name.');
    }

    if (!dob) {
      errors.push('Date of Birth: Missing Date of Birth.');
    } else if (!isValidIsoDate(dob)) {
      errors.push(`Date of Birth: Invalid date "${dob}" (use YYYY-MM-DD or DD-MM-YYYY).`);
    }

    return {
      rowNumber,
      usn,
      studentName,
      dob,
      isValid: errors.length === 0,
      errors,
    };
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  return {
    success: true,
    fileName: file.name,
    fileSizeBytes: file.size,
    rows: parsedRows,
    validCount,
    invalidCount: parsedRows.length - validCount,
  };
}

export async function parseAndValidateQuestionExcel(
  file: File,
  subjectModuleCount: number,
  existingSubjectQuestions: QuestionItem[],
  selectedModuleNumber?: number,
  _actor?: AuthUser | null
): Promise<QuestionExcelParseResult> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    return {
      success: false,
      fatalError: 'Unsupported file format. Please upload an Excel workbook (.xlsx or .xls).',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  const existingTexts = existingSubjectQuestions
    .filter((q) => q.status === 'Active')
    .map((q) => q.questionText.trim())
    .filter(Boolean);

  // Use 100% browser-only ExcelJS + JSZip OpenXML parser for .xlsx workbooks so
  // embedded cell drawings and _ImageMap metadata are reconstructed cleanly with zero backend dependency.
  if (lowerName.endsWith('.xlsx')) {
    try {
      return await parseQuestionWorkbookInBrowser({
        file,
        subjectModuleCount,
        expectedModuleNumber: selectedModuleNumber,
        existingQuestionTexts: existingTexts,
      });
    } catch (err) {
      return {
        success: false,
        fatalError:
          err instanceof Error
            ? err.message
            : 'Unable to parse image-enabled Excel workbook in browser.',
        fileName: file.name,
        fileSizeBytes: file.size,
        rows: [],
        validCount: 0,
        invalidCount: 0,
        totalImagesExtracted: 0,
      };
    }
  }

  // Legacy .xls fallback (cell-only via SheetJS) enforcing strict single-module policy
  let matrix: unknown[][] = [];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      return {
        success: false,
        fatalError: 'The Excel workbook contains no sheets.',
        fileName: file.name,
        fileSizeBytes: file.size,
        rows: [],
        validCount: 0,
        invalidCount: 0,
        totalImagesExtracted: 0,
      };
    }
    matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' }) as unknown[][];
  } catch (err) {
    return {
      success: false,
      fatalError: err instanceof Error ? `Excel parsing failed: ${err.message}` : 'Unable to read Excel file.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  if (matrix.length < 2) {
    return {
      success: false,
      fatalError: 'The worksheet has no question rows.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  const rawHeaders = (matrix[0] || []).map((h) => String(h).trim()).filter(Boolean);
  const normalizedHeaders = rawHeaders.map((h) => h.toLowerCase());
  const expectedLower = QUESTION_EXCEL_HEADERS.map((h) => h.toLowerCase());

  if (normalizedHeaders.some((h) => h.includes('difficulty'))) {
    return {
      success: false,
      fatalError: 'Remove any Difficulty column. All questions share a uniform difficulty policy.',
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  if (
    rawHeaders.length !== 7 ||
    expectedLower.some((exp, idx) => normalizedHeaders[idx] !== exp)
  ) {
    return {
      success: false,
      fatalError: `Incorrect column headers. Expected strictly "${QUESTION_EXCEL_HEADERS.join(', ')}". Found "${rawHeaders.join(', ')}".`,
      fileName: file.name,
      fileSizeBytes: file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  const existingNormSet = new Set(existingTexts.map((t) => t.toLowerCase()));
  const dataRows = matrix
    .slice(1)
    .map((row, idx) => ({ row, rowNumber: idx + 2 }))
    .filter(({ row }) => row.some((c) => String(c).trim() !== ''));

  const seenTextsInFile = new Set<string>();
  const parsedRows: ParsedQuestionRow[] = dataRows.map(({ row, rowNumber }) => {
    const moduleRaw = String(row[0] ?? '').trim();
    const moduleNum = Number(moduleRaw);
    const questionText = String(row[1] ?? '').trim();
    const optionA = String(row[2] ?? '').trim();
    const optionB = String(row[3] ?? '').trim();
    const optionC = String(row[4] ?? '').trim();
    const optionD = String(row[5] ?? '').trim();
    const correctOption = String(row[6] ?? '').trim().toUpperCase();
    const errors: string[] = [];

    if (!moduleRaw || !Number.isInteger(moduleNum) || moduleNum < 1 || moduleNum > subjectModuleCount) {
      errors.push(
        `Col A (Module Number): "${moduleRaw || 'blank'}" must be an integer between 1 and ${subjectModuleCount}.`
      );
    } else if (moduleNum !== selectedModuleNumber) {
      errors.push(
        `Col A (Module Number): Strictly Module ${selectedModuleNumber} was selected for this upload batch, but row contains Module ${moduleNum}.`
      );
    }

    if (!questionText) {
      errors.push('Col B (Question Text): Blank question text.');
    } else {
      const norm = questionText.toLowerCase();
      if (seenTextsInFile.has(norm)) {
        errors.push('Col B (Question Text): Duplicate question within the uploaded file.');
      }
      if (existingNormSet.has(norm)) {
        errors.push('Col B (Question Text): Duplicate of an existing active question in this subject.');
      }
      seenTextsInFile.add(norm);
    }

    const opts = [optionA, optionB, optionC, optionD];
    if (opts.some((o) => !o)) {
      errors.push('Cols C–F (Options A–D): All four options are required.');
    } else if (new Set(opts.map((o) => o.toLowerCase())).size < 4) {
      errors.push('Cols C–F (Options A–D): All four options must be distinct.');
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      errors.push(`Col G (Correct Option): "${correctOption || 'blank'}" must be A, B, C, or D.`);
    }

    return {
      rowNumber,
      moduleNumber: Number.isInteger(moduleNum) ? moduleNum : null,
      moduleRaw,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      questionImages: [],
      optionAImages: [],
      optionBImages: [],
      optionCImages: [],
      optionDImages: [],
      isValid: errors.length === 0,
      errors,
    };
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  return {
    success: true,
    fileName: file.name,
    fileSizeBytes: file.size,
    rows: parsedRows,
    validCount,
    invalidCount: parsedRows.length - validCount,
    totalImagesExtracted: 0,
  };
}
