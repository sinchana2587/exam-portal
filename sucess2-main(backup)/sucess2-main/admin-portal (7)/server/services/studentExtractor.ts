import crypto from 'node:crypto';
import type {
  ConversionLifecycleStatus,
  ExtractedStudentPreviewRow,
  StudentConversionSession,
} from '../../src/types';
import {
  DocumentProcessingError,
  extractDocumentContent,
  ExtractedTextLine,
} from './pdfAndOcrEngine';

const DEPT_PREFIX_MAP: Record<string, string[]> = {
  // Institutional department codes (MIT Mysore E158XX)
  E158CS: ['CS'],
  E158IS: ['IS'],
  E158EC: ['EC'],
  E158ME: ['ME'],
  E158CV: ['CV'],
  E158CE: ['CE'],
  E158CA: ['CA', 'AI'],
  E158CD: ['CD', 'DS', 'AD'],
  E158CB: ['CB', 'CSBS'],
  E158CI: ['CI', 'AI', 'AM', 'AL'],
  E158IC: ['IC', 'IO', 'CY'],
  E158EE: ['EE'],

  // Standard short codes and aliases
  CSE: ['CS'],
  CS: ['CS'],
  ISE: ['IS'],
  IS: ['IS'],
  ECE: ['EC'],
  EC: ['EC'],
  ME: ['ME'],
  CV: ['CV'],
  CE: ['CE'],
  EEE: ['EE'],
  EE: ['EE'],
  CA: ['CA', 'AI'],
  CD: ['CD', 'DS', 'AD'],
  CB: ['CB', 'CSBS'],
  CI: ['CI', 'AI', 'AM', 'AL'],
  IC: ['IC', 'IO', 'CY'],
  AIML: ['AI', 'AM', 'AL', 'CI'],
  AIDS: ['AD', 'AI', 'DS'],
};

function getDeptPrefixAlternatives(deptCode: string): string[] {
  const upper = deptCode ? deptCode.trim().toUpperCase() : '';
  if (!upper) return [];
  return DEPT_PREFIX_MAP[upper] || [];
}

function normalizeSectionLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^section\s+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

export function normalizeDobValue(raw: string): { normalized: string; suggestedCorrection?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { normalized: '' };

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { normalized: trimmed };
  }
  const isoSlash = trimmed.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (isoSlash) {
    const fixed = `${isoSlash[1]}-${isoSlash[2].padStart(2, '0')}-${isoSlash[3].padStart(2, '0')}`;
    return { normalized: fixed, suggestedCorrection: fixed };
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (dmyMatch) {
    const fixed = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    return { normalized: fixed, suggestedCorrection: fixed };
  }
  const textMonthMatch = trimmed.match(/^(\d{1,2})[-\s]+([A-Za-z]+)[-\s,]+(\d{4})$/);
  if (textMonthMatch) {
    const month = MONTH_MAP[textMonthMatch[2].toLowerCase()];
    if (month) {
      const fixed = `${textMonthMatch[3]}-${month}-${textMonthMatch[1].padStart(2, '0')}`;
      return { normalized: fixed, suggestedCorrection: fixed };
    }
  }
  return { normalized: trimmed };
}

export function isValidIsoDob(val: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    y >= 1985 &&
    y <= 2015
  );
}

function isMetadataOrBannerLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    /^(department|dept|semester|sem|section|academic\s*year|subject|branch)\s*[:|-]/i.test(t) ||
    /^page\s+\d+(\s+of\s+\d+)?$/i.test(t) ||
    /^maharaja\s+institute\s+of\s+technology/i.test(t) ||
    /^(departmental\s+)?eligible\s+student/i.test(t) ||
    /^generated\s+(on|by)/i.test(t) ||
    /^(sl\.?\s*no\.?|s\.?\s*no\.?)?\s*\b(usn|university\s*seat)\b.*\b(name|student)\b.*\b(dob|date\s*of\s*birth)\b/i.test(t)
  );
}

interface StudentColumnLayout {
  slNoX?: number;
  usnX: number;
  nameX: number;
  dobX: number;
  sectionX?: number;
  hasDistinctColumnTokens: boolean;
}

function detectStudentTableHeader(lines: ExtractedTextLine[]): {
  headerIndex: number;
  layout: StudentColumnLayout;
} | null {
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const lower = ln.text.toLowerCase();
    const hasUsn = /\b(usn|university\s*seat\s*(no|number)?)\b/i.test(lower);
    const hasName = /\b(student\s*name|name\s*of\s*(the\s*)?student|name)\b/i.test(lower);
    const hasDob = /\b(dob|d\.o\.b|date\s*of\s*birth|birth\s*date)\b/i.test(lower);

    if (hasUsn && hasName && hasDob) {
      const usnTok = ln.tokens.find((t) => /\b(usn|seat)\b/i.test(t.text));
      const nameTok = ln.tokens.find(
        (t) => t !== usnTok && /\b(student|name)\b/i.test(t.text)
      );
      const dobTok = ln.tokens.find(
        (t) => t !== usnTok && t !== nameTok && /\b(dob|birth|date)\b/i.test(t.text)
      );
      const slTok = ln.tokens.find((t) => /^(sl\.?|s\.?no\.?|#)$/i.test(t.text.trim()));
      const secTok = ln.tokens.find(
        (t) => t !== usnTok && t !== nameTok && t !== dobTok && /\bsection\b/i.test(t.text)
      );

      if (
        usnTok &&
        nameTok &&
        dobTok &&
        nameTok.x > usnTok.x + 8 &&
        dobTok.x > nameTok.x + 8
      ) {
        return {
          headerIndex: i,
          layout: {
            slNoX: slTok?.x,
            usnX: usnTok.x,
            nameX: nameTok.x,
            dobX: dobTok.x,
            sectionX: secTok?.x,
            hasDistinctColumnTokens: true,
          },
        };
      }

      // Compute proportional positions from character offsets when headers appear in a single PDF run
      const len = Math.max(1, ln.text.length);
      const usnChar = Math.max(0, lower.search(/\b(usn|university\s*seat)/i));
      const nameChar = Math.max(usnChar + 3, lower.search(/\b(student\s*name|name)/i));
      const dobChar = Math.max(nameChar + 4, lower.search(/\b(dob|d\.o\.b|date\s*of\s*birth|birth)/i));

      return {
        headerIndex: i,
        layout: {
          usnX: ln.x + (usnChar / len) * ln.width,
          nameX: ln.x + (nameChar / len) * ln.width,
          dobX: ln.x + (dobChar / len) * ln.width,
          hasDistinctColumnTokens: false,
        },
      };
    }
  }
  return null;
}

function isRepeatedHeaderLine(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(usn|university\s*seat)\b/i.test(lower) &&
    /\b(name|student\s*name)\b/i.test(lower) &&
    /\b(dob|date\s*of\s*birth)\b/i.test(lower)
  );
}

function parseRowFromUnstructuredLine(lineText: string): {
  usn: string;
  studentName: string;
  dob: string;
  sourceSection?: string;
} | null {
  let clean = lineText.trim();
  if (!clean) return null;

  // Handle pipe-delimited rows
  if (clean.includes('|')) {
    const parts = clean.split('|').map((p) => p.trim());
    // Detect optional leading Sl.No column
    let offset = 0;
    if (/^\d{1,3}\.?$/.test(parts[0]) && parts.length >= 4) offset = 1;
    return {
      usn: (parts[offset] || '').toUpperCase(),
      studentName: parts[offset + 1] || '',
      dob: parts[offset + 2] || '',
      sourceSection: parts[offset + 3] || undefined,
    };
  }

  // Strip optional leading serial number (e.g. "1  4MH24CS071  Aarav Deshmukh  2006-03-12")
  clean = clean.replace(/^\d{1,3}[.)]?\s+/, '');

  const dobMatch = clean.match(
    /(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4}|\d{1,2}[-\s]+[A-Za-z]{3,9}[-\s,]+\d{4})\s*$/
  );
  let dob = '';
  let body = clean;
  if (dobMatch) {
    dob = dobMatch[1];
    body = clean.slice(0, dobMatch.index).trim();
  }

  // Look for leading USN-like token (strict or partially corrupted OCR token containing digits/letters/?)
  const firstSpace = body.search(/\s+/);
  if (firstSpace === -1) {
    return { usn: body.toUpperCase(), studentName: '', dob };
  }
  const firstTok = body.slice(0, firstSpace).trim();
  const remainder = body.slice(firstSpace).trim();

  if (/\d/.test(firstTok) || /\?/.test(firstTok) || /^4MH/i.test(firstTok)) {
    return { usn: firstTok.toUpperCase(), studentName: remainder, dob };
  }
  // If first token has no digits, USN might be missing (name + dob)
  return { usn: '', studentName: body, dob };
}

export interface StudentValidationInputs {
  departmentCode: string;
  semesterNumber: number;
  section: string;
  existingUsnConflicts: Record<string, string>;
  contextMismatches: string[];
  sectionMetadataMissing: boolean;
  sectionConfirmed: boolean;
}

export function revalidateStudentSessionRecords(
  rawRecords: {
    tempId: string;
    rowNumber: number;
    usn: string;
    studentName: string;
    dob: string;
    sourceSection?: string;
    confidence?: number;
    ocrUncertain?: boolean;
  }[],
  validationInputs: StudentValidationInputs
): {
  records: ExtractedStudentPreviewRow[];
  validationErrors: StudentConversionSession['validationErrors'];
  status: ConversionLifecycleStatus;
  statusMessage: string;
  downloadEligible: boolean;
} {
  const counts = new Map<string, number>();
  const duplicateUsnsInDoc = new Set<string>();
  for (const r of rawRecords) {
    const norm = r.usn.trim().toUpperCase();
    if (!norm) continue;
    const prev = counts.get(norm) || 0;
    counts.set(norm, prev + 1);
    if (prev >= 1) duplicateUsnsInDoc.add(norm);
  }

  const allowedPrefixes = getDeptPrefixAlternatives(validationInputs.departmentCode);
  const selectedSecNorm = normalizeSectionLabel(validationInputs.section);
  const validationErrors: StudentConversionSession['validationErrors'] = [];

  const records: ExtractedStudentPreviewRow[] = rawRecords.map((raw, idx) => {
    const rowNumber = raw.rowNumber || idx + 1;
    const usn = raw.usn.trim().toUpperCase();
    const studentName = raw.studentName.trim();
    const { normalized: dobNormalized, suggestedCorrection } = normalizeDobValue(raw.dob);

    const errors: string[] = [];
    let usnInvalid = false;
    let nameInvalid = false;
    let dobInvalid = false;

    if (!usn || usn.includes('?') || usn.includes('_')) {
      const msg = 'Missing or unreadable USN.';
      errors.push(msg);
      usnInvalid = true;
      validationErrors.push({
        rowNumber,
        field: 'USN',
        value: usn || '(blank)',
        status: 'Invalid',
        explanation: msg,
      });
    } else {
      const match = usn.match(/^4MH\d{2}([A-Z]{2,4})\d{3}$/);
      if (!match) {
        const sample = allowedPrefixes.length > 0 ? allowedPrefixes[0] : 'CS';
        const msg = `Invalid USN format "${usn}" (expected e.g. 4MH24${sample}001).`;
        errors.push(msg);
        usnInvalid = true;
        validationErrors.push({
          rowNumber,
          field: 'USN',
          value: usn,
          status: 'Invalid',
          explanation: msg,
        });
      } else if (allowedPrefixes.length === 0) {
        const msg = `USN branch mapping has not been configured for department "${validationInputs.departmentCode}".`;
        errors.push(msg);
        usnInvalid = true;
        validationErrors.push({
          rowNumber,
          field: 'USN',
          value: usn,
          status: 'Invalid',
          explanation: msg,
        });
      } else if (!allowedPrefixes.includes(match[1])) {
        const msg = `Department-prefix mismatch ("${match[1]}" does not belong to ${validationInputs.departmentCode}).`;
        errors.push(msg);
        usnInvalid = true;
        validationErrors.push({
          rowNumber,
          field: 'USN',
          value: usn,
          status: 'Invalid',
          explanation: msg,
        });
      }

      if (duplicateUsnsInDoc.has(usn)) {
        const msg = `Duplicate USN "${usn}" within the uploaded document.`;
        errors.push(msg);
        usnInvalid = true;
        validationErrors.push({
          rowNumber,
          field: 'USN',
          value: usn,
          status: 'Duplicate',
          explanation: msg,
        });
      }

      if (validationInputs.existingUsnConflicts[usn]) {
        const msg = validationInputs.existingUsnConflicts[usn];
        errors.push(msg);
        usnInvalid = true;
        validationErrors.push({
          rowNumber,
          field: 'USN',
          value: usn,
          status: 'Conflict',
          explanation: msg,
        });
      }
    }

    if (!studentName || studentName.includes('?') || studentName.includes('_')) {
      const msg = 'Missing or unreadable Student Name.';
      errors.push(msg);
      nameInvalid = true;
      validationErrors.push({
        rowNumber,
        field: 'Student Name',
        value: studentName || '(blank)',
        status: 'Invalid',
        explanation: msg,
      });
    } else if (/^\d+$/.test(studentName) || studentName.length < 2 || isMetadataOrBannerLine(studentName)) {
      const msg = 'Invalid Student Name or document metadata detected in name column.';
      errors.push(msg);
      nameInvalid = true;
      validationErrors.push({
        rowNumber,
        field: 'Student Name',
        value: studentName,
        status: 'Invalid',
        explanation: msg,
      });
    }

    if (!dobNormalized) {
      const msg = 'Missing Date of Birth (DOB).';
      errors.push(msg);
      dobInvalid = true;
      validationErrors.push({
        rowNumber,
        field: 'DOB',
        value: '(blank)',
        status: 'Missing',
        explanation: msg,
      });
    } else if (!isValidIsoDob(dobNormalized)) {
      const msg = `Invalid DOB "${dobNormalized}" (expected valid YYYY-MM-DD date).`;
      errors.push(msg);
      dobInvalid = true;
      validationErrors.push({
        rowNumber,
        field: 'DOB',
        value: dobNormalized,
        status: 'Invalid',
        explanation: msg,
        suggestedCorrection,
      });
    }

    if (raw.sourceSection && normalizeSectionLabel(raw.sourceSection) !== selectedSecNorm) {
      const msg = `Row belongs to "${raw.sourceSection}" instead of selected "${validationInputs.section}". Remove or resolve cross-section record.`;
      errors.push(msg);
      usnInvalid = true;
      validationErrors.push({
        rowNumber,
        field: 'Section',
        value: raw.sourceSection,
        status: 'Section Mismatch',
        explanation: msg,
      });
    }

    const ocrLowConfidence = typeof raw.confidence === 'number' && raw.confidence < 75;
    const isValid = errors.length === 0;
    const uncertain = !isValid || Boolean(raw.ocrUncertain) || ocrLowConfidence;

    let note = 'Valid — ready for standard Excel export';
    if (!isValid) {
      note = errors.join(' | ');
    } else if (ocrLowConfidence) {
      note = `OCR confidence ${raw.confidence}% — verify spelling and digits before download`;
    }

    return {
      tempId: raw.tempId || `stu-prev-${rowNumber}`,
      rowNumber,
      usn,
      studentName,
      dob: dobNormalized,
      sourceSection: raw.sourceSection,
      confidence: raw.confidence,
      isValid,
      uncertain,
      errors,
      invalidFields: {
        usn: usnInvalid,
        studentName: nameInvalid,
        dob: dobInvalid,
      },
      suggestedCorrection,
      note,
    };
  });

  const hasContextMismatch = validationInputs.contextMismatches.length > 0;
  const hasRowErrors = records.some((r) => !r.isValid);
  const needsSectionConfirmation =
    validationInputs.sectionMetadataMissing && !validationInputs.sectionConfirmed;

  let status: ConversionLifecycleStatus = 'READY_FOR_EXCEL_DOWNLOAD';
  let statusMessage = `Validation Passed: All ${records.length} student record(s) verified and ready for .xlsx download.`;

  if (hasContextMismatch) {
    const mismatchText = validationInputs.contextMismatches.join('; ');
    status = /department/i.test(mismatchText)
      ? 'DEPARTMENT_MISMATCH'
      : /section/i.test(mismatchText)
      ? 'SECTION_MISMATCH'
      : 'VALIDATION_FAILED';
    statusMessage = `Document context mismatch: ${mismatchText}`;
  } else if (hasRowErrors) {
    status = 'VALIDATION_FAILED';
    const invalidCount = records.filter((r) => !r.isValid).length;
    statusMessage = `Validation failed: ${invalidCount} row(s) contain blocking errors. Correct highlighted fields before Excel download.`;
  } else if (needsSectionConfirmation) {
    status = 'MANUAL_REVIEW_REQUIRED';
    statusMessage = `Section metadata was not detected inside the document. Confirm that these ${records.length} students belong to ${validationInputs.section} to enable download.`;
  }

  const downloadEligible =
    records.length > 0 && !hasContextMismatch && !hasRowErrors && !needsSectionConfirmation;

  return {
    records,
    validationErrors,
    status,
    statusMessage,
    downloadEligible,
  };
}

// Ephemeral in-memory conversion sessions scoped to authenticated HOD with TTL cleanup
const studentSessions = new Map<string, StudentConversionSession>();

export function cleanupExpiredStudentSessions(): void {
  const now = Date.now();
  for (const [id, sess] of studentSessions.entries()) {
    if (Date.parse(sess.expiresAt) <= now) {
      studentSessions.delete(id);
    }
  }
}

export async function createStudentConversionSession(params: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType?: string;
  hodUserId: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  section: string;
  existingUsnConflicts?: Record<string, string>;
}): Promise<StudentConversionSession> {
  cleanupExpiredStudentSessions();

  const extracted = await extractDocumentContent({
    buffer: params.fileBuffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    extractDiagramRegionsFromRaster: false,
  });

  if (extracted.lines.length === 0) {
    throw new DocumentProcessingError(
      'No readable text or table data could be extracted from the uploaded student document.',
      'CORRUPTED_DOCUMENT',
      400
    );
  }

  // 1. Extract document-level metadata separately (NEVER allow into student rows)
  const metadataDetected: NonNullable<StudentConversionSession['metadataDetected']> = {
    detectedSections: [],
  };
  const detectedSectionSet = new Set<string>();

  for (const ln of extracted.lines) {
    const t = ln.text;
    const deptMatch = t.match(/\b(?:Department|Dept)\s*[:|-]\s*([A-Za-z0-9_-]+)/i);
    if (deptMatch && !metadataDetected.departmentCode) {
      metadataDetected.departmentCode = deptMatch[1].toUpperCase();
    }

    const semMatch = t.match(/\b(?:Semester|Sem)\s*[:|-]?\s*(\d{1,2})\b/i);
    if (semMatch && metadataDetected.semesterNumber === undefined) {
      metadataDetected.semesterNumber = Number(semMatch[1]);
    }

    const secMatch =
      t.match(/\bSection\s*[:|-]\s*([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?)/i) ||
      t.match(/\|\s*(Section\s+[A-Za-z0-9]+)\b/i);
    if (secMatch) {
      const cleanSec = secMatch[1].trim();
      const formatted = /^section\s+/i.test(cleanSec) ? cleanSec : `Section ${cleanSec}`;
      if (!metadataDetected.section) {
        metadataDetected.section = formatted;
      }
      detectedSectionSet.add(formatted);
    }
  }
  metadataDetected.detectedSections = Array.from(detectedSectionSet);

  const contextMismatches: string[] = [];
  if (
    metadataDetected.departmentCode &&
    metadataDetected.departmentCode !== params.departmentCode.toUpperCase()
  ) {
    contextMismatches.push(
      `Document Department "${metadataDetected.departmentCode}" does not match authenticated HOD Department "${params.departmentCode}".`
    );
  }
  if (
    typeof metadataDetected.semesterNumber === 'number' &&
    metadataDetected.semesterNumber !== params.semesterNumber
  ) {
    contextMismatches.push(
      `Document Semester ${metadataDetected.semesterNumber} does not match selected Semester ${params.semesterNumber}.`
    );
  }
  if (
    metadataDetected.section &&
    normalizeSectionLabel(metadataDetected.section) !== normalizeSectionLabel(params.section)
  ) {
    contextMismatches.push(
      `Document Section "${metadataDetected.section}" does not match selected "${params.section}".`
    );
  }
  if (metadataDetected.detectedSections.length > 1) {
    contextMismatches.push(
      `Multiple sections detected in document (${metadataDetected.detectedSections.join(', ')}). Upload one section per conversion.`
    );
  }

  // 2. Locate Student Table Header and extract rows using column X-boundaries
  const headerInfo = detectStudentTableHeader(extracted.lines);
  if (!headerInfo) {
    throw new DocumentProcessingError(
      'Could not locate student table headings ("USN", "Student Name", "DOB"). Document metadata alone cannot be converted into student records.',
      'CORRUPTED_DOCUMENT',
      422
    );
  }

  const { headerIndex, layout } = headerInfo;
  const usnStartBoundary =
    layout.slNoX !== undefined ? (layout.slNoX + layout.usnX) / 2 : -Infinity;
  const nameStartBoundary = (layout.usnX + layout.nameX) / 2;
  const dobStartBoundary = (layout.nameX + layout.dobX) / 2;
  const sectionStartBoundary =
    layout.sectionX !== undefined ? (layout.dobX + layout.sectionX) / 2 : Infinity;

  const rawRows: {
    tempId: string;
    rowNumber: number;
    usn: string;
    studentName: string;
    dob: string;
    sourceSection?: string;
    confidence?: number;
    ocrUncertain?: boolean;
  }[] = [];

  let currentInlineSection: string | undefined;

  for (let i = headerIndex + 1; i < extracted.lines.length; i++) {
    const ln = extracted.lines[i];
    const secSubHeader = ln.text.match(/^Section\s*[:|-]?\s*([A-Za-z0-9]+)$/i);
    if (secSubHeader) {
      currentInlineSection = `Section ${secSubHeader[1].toUpperCase()}`;
      continue;
    }
    if (isRepeatedHeaderLine(ln.text) || isMetadataOrBannerLine(ln.text)) {
      continue;
    }

    let usn = '';
    let studentName = '';
    let dob = '';
    let sourceSection = currentInlineSection;

    if (layout.hasDistinctColumnTokens && ln.tokens.length >= 2 && !ln.text.includes('|')) {
      const usnParts: string[] = [];
      const nameParts: string[] = [];
      const dobParts: string[] = [];
      const secParts: string[] = [];

      for (const tok of ln.tokens) {
        if (tok.x < usnStartBoundary) {
          // Leading serial number column — ignore
          continue;
        } else if (tok.x < nameStartBoundary) {
          usnParts.push(tok.text);
        } else if (tok.x < dobStartBoundary) {
          nameParts.push(tok.text);
        } else if (tok.x < sectionStartBoundary) {
          dobParts.push(tok.text);
        } else {
          secParts.push(tok.text);
        }
      }

      usn = usnParts.join(' ').trim().toUpperCase();
      studentName = nameParts.join(' ').trim();
      dob = dobParts.join(' ').trim();
      if (secParts.length > 0) {
        const s = secParts.join(' ').trim();
        sourceSection = /^section\s+/i.test(s) ? s : `Section ${s}`;
      }
    } else {
      const parsed = parseRowFromUnstructuredLine(ln.text);
      if (!parsed) continue;
      usn = parsed.usn;
      studentName = parsed.studentName;
      dob = parsed.dob;
      if (parsed.sourceSection) {
        sourceSection = /^section\s+/i.test(parsed.sourceSection)
          ? parsed.sourceSection
          : `Section ${parsed.sourceSection}`;
      }
    }

    // Fallback: if column bucketing collapsed fields because of narrow column spacing
    if (!studentName || (!usn && studentName)) {
      const fallback = parseRowFromUnstructuredLine(ln.text);
      if (fallback && (fallback.studentName || fallback.usn)) {
        usn = fallback.usn;
        studentName = fallback.studentName;
        if (fallback.dob) dob = fallback.dob;
      }
    }

    if (!usn && !studentName && !dob) continue;
    if (/^(department|semester|section|total\s+students)\b/i.test(`${usn} ${studentName}`)) continue;

    const rowNumber = rawRows.length + 1;
    rawRows.push({
      tempId: `stu-conv-${rowNumber}`,
      rowNumber,
      usn,
      studentName,
      dob,
      sourceSection,
      confidence: ln.confidence,
      ocrUncertain: ln.source === 'OCR' && ln.confidence < 78,
    });
  }

  if (rawRows.length === 0) {
    throw new DocumentProcessingError(
      'No student rows were detected beneath the table header in this document.',
      'CORRUPTED_DOCUMENT',
      422
    );
  }

  const sectionMetadataMissing = !metadataDetected.section;
  const validation = revalidateStudentSessionRecords(rawRows, {
    departmentCode: params.departmentCode,
    semesterNumber: params.semesterNumber,
    section: params.section,
    existingUsnConflicts: params.existingUsnConflicts || {},
    contextMismatches,
    sectionMetadataMissing,
    sectionConfirmed: !sectionMetadataMissing,
  });

  const cleanSectionFilePart = params.section.replace(/\s+/g, '');
  const conversionId = `stuconv-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000);

  const session: StudentConversionSession = {
    conversionId,
    hodUserId: params.hodUserId,
    departmentId: params.departmentId,
    departmentCode: params.departmentCode,
    semesterNumber: params.semesterNumber,
    section: params.section,
    originalFileName: params.fileName,
    fileType: extracted.fileType,
    status: validation.status,
    statusMessage: validation.statusMessage,
    pageCount: extracted.pageCount,
    metadataDetected,
    contextMismatches,
    sectionMetadataMissing,
    sectionConfirmed: !sectionMetadataMissing,
    records: validation.records,
    validationErrors: validation.validationErrors,
    downloadEligible: validation.downloadEligible,
    recommendedFileName: `${params.departmentCode}_Sem${params.semesterNumber}_${cleanSectionFilePart}_Student_List.xlsx`,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  studentSessions.set(conversionId, session);
  return session;
}

export function getStudentConversionSession(
  conversionId: string,
  hodUserId: string,
  departmentId: string
): StudentConversionSession | null {
  cleanupExpiredStudentSessions();
  const sess = studentSessions.get(conversionId);
  if (!sess) return null;
  if (sess.hodUserId !== hodUserId || sess.departmentId !== departmentId) {
    return null;
  }
  return sess;
}

export function updateStudentConversionSession(params: {
  conversionId: string;
  hodUserId: string;
  departmentId: string;
  records?: Pick<ExtractedStudentPreviewRow, 'tempId' | 'rowNumber' | 'usn' | 'studentName' | 'dob' | 'sourceSection'>[];
  sectionConfirmed?: boolean;
  existingUsnConflicts?: Record<string, string>;
}): StudentConversionSession {
  const sess = getStudentConversionSession(
    params.conversionId,
    params.hodUserId,
    params.departmentId
  );
  if (!sess) {
    throw new DocumentProcessingError('Conversion session not found or expired.', 'CORRUPTED_DOCUMENT', 404);
  }

  if (typeof params.sectionConfirmed === 'boolean') {
    sess.sectionConfirmed = params.sectionConfirmed;
  }

  const nextRaw = (params.records || sess.records).map((r, idx) => ({
    tempId: r.tempId || `stu-conv-${idx + 1}`,
    rowNumber: idx + 1,
    usn: r.usn,
    studentName: r.studentName,
    dob: r.dob,
    sourceSection: r.sourceSection,
  }));

  const validation = revalidateStudentSessionRecords(nextRaw, {
    departmentCode: sess.departmentCode,
    semesterNumber: sess.semesterNumber,
    section: sess.section,
    existingUsnConflicts: params.existingUsnConflicts || {},
    contextMismatches: sess.contextMismatches,
    sectionMetadataMissing: sess.sectionMetadataMissing,
    sectionConfirmed: sess.sectionConfirmed,
  });

  sess.records = validation.records;
  sess.validationErrors = validation.validationErrors;
  sess.status = validation.status;
  sess.statusMessage = validation.statusMessage;
  sess.downloadEligible = validation.downloadEligible;
  studentSessions.set(sess.conversionId, sess);
  return sess;
}
