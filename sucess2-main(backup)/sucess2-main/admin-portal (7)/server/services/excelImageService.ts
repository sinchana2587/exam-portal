import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import type {
  ExtractedQuestionPreviewRow,
  ExtractedStudentPreviewRow,
  QuestionImageAsset,
  QuestionImageField,
} from '../../src/types';

export const STANDARD_STUDENT_HEADERS = ['USN', 'Student Name', 'DOB'] as const;
export const STANDARD_QUESTION_HEADERS = [
  'Module Number',
  'Question Text',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Correct Option',
] as const;

const FIELD_TO_COL_INDEX: Record<QuestionImageField, number> = {
  QUESTION_TEXT: 1, // 0-based col B
  OPTION_A: 2, // 0-based col C
  OPTION_B: 3, // 0-based col D
  OPTION_C: 4, // 0-based col E
  OPTION_D: 5, // 0-based col F
};

const COL_INDEX_TO_FIELD: Record<number, QuestionImageField> = {
  1: 'QUESTION_TEXT',
  2: 'OPTION_A',
  3: 'OPTION_B',
  4: 'OPTION_C',
  5: 'OPTION_D',
};

function sanitizeCellValue(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text).join('').trim();
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text.trim();
    }
    if ('result' in val && val.result !== undefined) {
      return String(val.result).trim();
    }
  }
  return String(val).trim();
}

export async function buildStudentWorkbookBuffer(
  rows: Pick<ExtractedStudentPreviewRow, 'usn' | 'studentName' | 'dob'>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MIT Mysore Examination Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Eligible Students');
  sheet.columns = [
    { header: 'USN', key: 'usn', width: 20 },
    { header: 'Student Name', key: 'studentName', width: 34 },
    { header: 'DOB', key: 'dob', width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17243A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  rows.forEach((row) => {
    const added = sheet.addRow([
      row.usn.trim().toUpperCase(),
      row.studentName.trim(),
      row.dob.trim(),
    ]);
    added.height = 20;
    added.eachCell((cell) => {
      cell.numFmt = '@';
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function buildQuestionWorkbookBuffer(params: {
  moduleNumber: number;
  subjectCode: string;
  rows: ExtractedQuestionPreviewRow[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MIT Mysore Examination Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Questions');
  sheet.columns = [
    { header: 'Module Number', key: 'moduleNumber', width: 16 },
    { header: 'Question Text', key: 'questionText', width: 48 },
    { header: 'Option A', key: 'optionA', width: 28 },
    { header: 'Option B', key: 'optionB', width: 28 },
    { header: 'Option C', key: 'optionC', width: 28 },
    { header: 'Option D', key: 'optionD', width: 28 },
    { header: 'Correct Option', key: 'correctOption', width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17243A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  // Internal hidden metadata sheet preserving exact image-to-question/option relationships
  const imageMapSheet = workbook.addWorksheet('_ImageMap', { state: 'veryHidden' });
  imageMapSheet.addRow([
    'Asset ID',
    'Question Row',
    'Preview ID',
    'Target Field',
    'Sequence',
    'MIME Type',
    'Width',
    'Height',
    'Alt Text',
    'Excel Image ID',
    'SHA256',
  ]);

  for (let i = 0; i < params.rows.length; i++) {
    const q = params.rows[i];
    const excelRowNumber = i + 2;

    const added = sheet.addRow([
      params.moduleNumber,
      (q.questionText || '').trim(),
      (q.optionA || '').trim(),
      (q.optionB || '').trim(),
      (q.optionC || '').trim(),
      (q.optionD || '').trim(),
      (q.correctOption || '').trim().toUpperCase(),
    ]);

    added.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: 'top',
        horizontal: colNumber === 1 || colNumber === 7 ? 'center' : 'left',
        wrapText: true,
      };
    });

    // Estimate text height plus embedded image space
    const textLines = Math.max(
      2,
      Math.ceil(q.questionText.length / 44),
      Math.ceil(q.optionA.length / 24),
      Math.ceil(q.optionB.length / 24),
      Math.ceil(q.optionC.length / 24),
      Math.ceil(q.optionD.length / 24)
    );
    let maxImageDisplayH = 0;

    // Group images by field so multiple images in one field keep ordered horizontal/vertical offsets
    const byField = new Map<QuestionImageField, QuestionImageAsset[]>();
    for (const img of q.images || []) {
      const list = byField.get(img.targetField) || [];
      list.push(img);
      byField.set(img.targetField, list);
    }

    for (const [field, fieldImgs] of byField.entries()) {
      fieldImgs.sort((a, b) => a.sequence - b.sequence);
      const colIdx0 = FIELD_TO_COL_INDEX[field];

      for (let seqIdx = 0; seqIdx < fieldImgs.length; seqIdx++) {
        const asset = fieldImgs[seqIdx];
        const rawBase64 = asset.base64Data.replace(/^data:image\/[^;]+;base64,/i, '');
        const imgBuf = Buffer.from(rawBase64, 'base64');
        const sha256 =
          asset.sha256 || crypto.createHash('sha256').update(imgBuf).digest('hex');

        const excelImageId = workbook.addImage({
          buffer: imgBuf as unknown as ExcelJS.Buffer,
          extension: asset.mimeType === 'image/jpeg' ? 'jpeg' : 'png',
        });

        const srcW = Math.max(24, asset.width || 120);
        const srcH = Math.max(24, asset.height || 90);
        const maxW = field === 'QUESTION_TEXT' ? 190 : 140;
        const maxH = 100;
        const scale = Math.min(1, maxW / srcW, maxH / srcH);
        const displayW = Math.round(srcW * scale);
        const displayH = Math.round(srcH * scale);
        if (displayH > maxImageDisplayH) maxImageDisplayH = displayH;

        const colOffset = Math.min(0.65, 0.05 + seqIdx * 0.25);
        const rowOffset = 0.22;

        sheet.addImage(excelImageId, {
          tl: { col: colIdx0 + colOffset, row: excelRowNumber - 1 + rowOffset },
          ext: { width: displayW, height: displayH },
          editAs: 'oneCell',
        });

        imageMapSheet.addRow([
          asset.assetId,
          excelRowNumber,
          q.previewId,
          field,
          seqIdx + 1,
          asset.mimeType,
          asset.width,
          asset.height,
          asset.altText || '',
          String(excelImageId),
          sha256,
        ]);
      }
    }

    const rowPtHeight = Math.max(
      24,
      textLines * 15 + (maxImageDisplayH > 0 ? Math.ceil(maxImageDisplayH * 0.78) + 18 : 8)
    );
    added.height = Math.min(240, rowPtHeight);
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export interface ParsedExcelQuestionWithImages {
  rowNumber: number;
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

export interface ParsedQuestionExcelBundle {
  success: boolean;
  fatalError?: string;
  fileName: string;
  fileSizeBytes: number;
  rows: ParsedExcelQuestionWithImages[];
  validCount: number;
  invalidCount: number;
  totalImagesExtracted: number;
}

export async function parseQuestionWorkbookBuffer(params: {
  buffer: Buffer;
  fileName: string;
  subjectModuleCount: number;
  expectedModuleNumber?: number;
  existingQuestionTexts?: string[];
}): Promise<ParsedQuestionExcelBundle> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(params.buffer as unknown as ArrayBuffer);
  } catch (err) {
    return {
      success: false,
      fatalError: `Failed to read Excel workbook: ${err instanceof Error ? err.message : 'invalid XLSX structure'}.`,
      fileName: params.fileName,
      fileSizeBytes: params.buffer.length,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  const visibleSheet = workbook.worksheets.find((ws) => ws.state !== 'veryHidden' && ws.name !== '_ImageMap');
  if (!visibleSheet || visibleSheet.rowCount < 2) {
    return {
      success: false,
      fatalError: 'The Excel workbook has no question rows below the header row.',
      fileName: params.fileName,
      fileSizeBytes: params.buffer.length,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  const headerRow = visibleSheet.getRow(1);
  const rawHeaders: string[] = [];
  for (let c = 1; c <= Math.max(7, visibleSheet.columnCount); c++) {
    rawHeaders.push(sanitizeCellValue(headerRow.getCell(c).value));
  }
  // Trim trailing empty header slots
  while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === '') {
    rawHeaders.pop();
  }

  const normalizedHeaders = rawHeaders.map((h) => h.toLowerCase());
  const expectedLower = STANDARD_QUESTION_HEADERS.map((h) => h.toLowerCase());

  if (
    rawHeaders.length !== 7 ||
    expectedLower.some((exp, idx) => normalizedHeaders[idx] !== exp)
  ) {
    return {
      success: false,
      fatalError: `Incorrect spreadsheet columns. Expected exactly "${STANDARD_QUESTION_HEADERS.join(', ')}" (no Difficulty, Set Number, or Student columns). Found "${rawHeaders.join(', ')}".`,
      fileName: params.fileName,
      fileSizeBytes: params.buffer.length,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  // Extract all workbook images & map them back to (excelRowNumber, targetField)
  const sheetImages = visibleSheet.getImages();
  const imagesByRowAndField = new Map<string, QuestionImageAsset[]>();
  const brokenImageRefsByRow = new Map<number, string[]>();
  let totalImagesExtracted = 0;

  const mediaById = new Map<string, { base64: string; mimeType: 'image/png' | 'image/jpeg'; sha256: string }>();
  for (const imgRef of sheetImages) {
    const imgIdKey = String(imgRef.imageId);
    if (!mediaById.has(imgIdKey)) {
      const media = workbook.getImage(Number(imgRef.imageId));
      if (media && media.buffer) {
        const rawBuf = Buffer.from(media.buffer as ArrayBuffer);
        const ext = (media.extension || 'png').toLowerCase();
        const mimeType: 'image/png' | 'image/jpeg' =
          ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'image/png';
        mediaById.set(imgIdKey, {
          base64: rawBuf.toString('base64'),
          mimeType,
          sha256: crypto.createHash('sha256').update(rawBuf).digest('hex'),
        });
      }
    }
  }

  const imageMapSheet = workbook.getWorksheet('_ImageMap');
  const mappedExcelRows = new Set<string>();

  if (imageMapSheet && imageMapSheet.rowCount >= 2) {
    for (let r = 2; r <= imageMapSheet.rowCount; r++) {
      const mRow = imageMapSheet.getRow(r);
      const assetId = sanitizeCellValue(mRow.getCell(1).value);
      const excelRowNum = Number(sanitizeCellValue(mRow.getCell(2).value));
      const targetField = sanitizeCellValue(mRow.getCell(4).value) as QuestionImageField;
      const sequence = Number(sanitizeCellValue(mRow.getCell(5).value)) || 1;
      const width = Number(sanitizeCellValue(mRow.getCell(7).value)) || 120;
      const height = Number(sanitizeCellValue(mRow.getCell(8).value)) || 90;
      const altText = sanitizeCellValue(mRow.getCell(9).value);
      const excelImageId = sanitizeCellValue(mRow.getCell(10).value);
      const expectedSha = sanitizeCellValue(mRow.getCell(11).value);

      if (!assetId || !excelRowNum || !FIELD_TO_COL_INDEX[targetField]) {
        if (excelRowNum) {
          const errs = brokenImageRefsByRow.get(excelRowNum) || [];
          errs.push('Invalid workbook _ImageMap association entry.');
          brokenImageRefsByRow.set(excelRowNum, errs);
        }
        continue;
      }

      const media = mediaById.get(excelImageId);
      if (!media || (expectedSha && media.sha256 !== expectedSha)) {
        const errs = brokenImageRefsByRow.get(excelRowNum) || [];
        errs.push(`Broken image reference for ${assetId} (${targetField}).`);
        brokenImageRefsByRow.set(excelRowNum, errs);
        continue;
      }

      const key = `${excelRowNum}:${targetField}`;
      const list = imagesByRowAndField.get(key) || [];
      list.push({
        assetId,
        targetField,
        sequence,
        mimeType: media.mimeType,
        width,
        height,
        base64Data: media.base64,
        altText: altText || undefined,
        sha256: media.sha256,
      });
      imagesByRowAndField.set(key, list);
      mappedExcelRows.add(`${excelRowNum}:${excelImageId}`);
      totalImagesExtracted += 1;
    }
  }

  // Also inspect native workbook drawing anchors directly for any images added/edited manually in Excel
  for (const imgRef of sheetImages) {
    const tl = imgRef.range?.tl as { nativeRow?: number; nativeCol?: number; row?: number; col?: number } | undefined;
    const zeroRow = Math.floor(tl?.nativeRow ?? tl?.row ?? -1);
    const zeroCol = Math.floor(tl?.nativeCol ?? tl?.col ?? -1);
    const excelRowNum = zeroRow + 1;
    const imgIdKey = String(imgRef.imageId);
    if (mappedExcelRows.has(`${excelRowNum}:${imgIdKey}`)) continue;

    const field = COL_INDEX_TO_FIELD[zeroCol];
    const media = mediaById.get(imgIdKey);
    if (!field || excelRowNum < 2) continue;

    if (!media) {
      const errs = brokenImageRefsByRow.get(excelRowNum) || [];
      errs.push(`Missing embedded image asset (Excel imageId ${imgIdKey}) in ${field}.`);
      brokenImageRefsByRow.set(excelRowNum, errs);
      continue;
    }

    const key = `${excelRowNum}:${field}`;
    const list = imagesByRowAndField.get(key) || [];
    const rangeExt = (
      imgRef.range as { ext?: { width?: number; height?: number } } | undefined
    )?.ext;
    list.push({
      assetId: `xlsx-img-r${excelRowNum}-${field.toLowerCase()}-${list.length + 1}`,
      targetField: field,
      sequence: list.length + 1,
      mimeType: media.mimeType,
      width: Math.round(rangeExt?.width || 140),
      height: Math.round(rangeExt?.height || 100),
      base64Data: media.base64,
      sha256: media.sha256,
    });
    imagesByRowAndField.set(key, list);
    totalImagesExtracted += 1;
  }

  const existingSet = new Set(
    (params.existingQuestionTexts || []).map((t) => t.trim().toLowerCase())
  );
  const seenInFile = new Set<string>();
  const rows: ParsedExcelQuestionWithImages[] = [];
  const distinctModulesSeen = new Set<number>();

  for (let r = 2; r <= visibleSheet.rowCount; r++) {
    const row = visibleSheet.getRow(r);
    const moduleRaw = sanitizeCellValue(row.getCell(1).value);
    const questionText = sanitizeCellValue(row.getCell(2).value);
    const optionA = sanitizeCellValue(row.getCell(3).value);
    const optionB = sanitizeCellValue(row.getCell(4).value);
    const optionC = sanitizeCellValue(row.getCell(5).value);
    const optionD = sanitizeCellValue(row.getCell(6).value);
    const correctOption = sanitizeCellValue(row.getCell(7).value).toUpperCase();

    const qImgs = (imagesByRowAndField.get(`${r}:QUESTION_TEXT`) || []).sort((a, b) => a.sequence - b.sequence);
    const aImgs = (imagesByRowAndField.get(`${r}:OPTION_A`) || []).sort((a, b) => a.sequence - b.sequence);
    const bImgs = (imagesByRowAndField.get(`${r}:OPTION_B`) || []).sort((a, b) => a.sequence - b.sequence);
    const cImgs = (imagesByRowAndField.get(`${r}:OPTION_C`) || []).sort((a, b) => a.sequence - b.sequence);
    const dImgs = (imagesByRowAndField.get(`${r}:OPTION_D`) || []).sort((a, b) => a.sequence - b.sequence);
    const hasAnyImage = qImgs.length + aImgs.length + bImgs.length + cImgs.length + dImgs.length > 0;

    if (!moduleRaw && !questionText && !optionA && !optionB && !optionC && !optionD && !correctOption && !hasAnyImage) {
      continue;
    }

    const errors: string[] = [...(brokenImageRefsByRow.get(r) || [])];
    const modNum = Number(moduleRaw);

    if (!moduleRaw || !Number.isInteger(modNum) || modNum < 1 || modNum > params.subjectModuleCount) {
      errors.push(
        `Col A (Module Number): "${moduleRaw || 'blank'}" must be an integer between 1 and ${params.subjectModuleCount}.`
      );
    } else {
      distinctModulesSeen.add(modNum);
      if (
        typeof params.expectedModuleNumber === 'number' &&
        modNum !== params.expectedModuleNumber
      ) {
        errors.push(
          `Strict Module-Wise Rule: Row belongs to Module ${modNum}, but selected upload batch is Module ${params.expectedModuleNumber}. Upload each module separately.`
        );
      }
    }

    if (!questionText && qImgs.length === 0) {
      errors.push('Col B (Question Text): Question text or diagram image is required.');
    } else if (questionText) {
      const norm = questionText.toLowerCase();
      if (seenInFile.has(norm)) {
        errors.push('Col B (Question Text): Duplicate question within the uploaded file.');
      }
      if (existingSet.has(norm)) {
        errors.push('Col B (Question Text): Duplicate of an existing active question in this subject.');
      }
      seenInFile.add(norm);
    }

    const optPairs = [
      { label: 'Option A', text: optionA, imgs: aImgs },
      { label: 'Option B', text: optionB, imgs: bImgs },
      { label: 'Option C', text: optionC, imgs: cImgs },
      { label: 'Option D', text: optionD, imgs: dImgs },
    ];
    if (optPairs.some((o) => !o.text && o.imgs.length === 0)) {
      errors.push('Cols C–F (Options A–D): All four options require text or an embedded option image.');
    } else {
      const sigs = optPairs.map(
        (o) => `${o.text.toLowerCase()}::${o.imgs.map((img) => img.sha256 || img.assetId).join(',')}`
      );
      if (new Set(sigs).size < 4) {
        errors.push('Cols C–F (Options A–D): All four options must be distinct.');
      }
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      errors.push(`Col G (Correct Option): "${correctOption || 'blank'}" must be A, B, C, or D.`);
    }

    rows.push({
      rowNumber: r,
      moduleNumber: Number.isInteger(modNum) ? modNum : null,
      moduleRaw,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      questionImages: qImgs,
      optionAImages: aImgs,
      optionBImages: bImgs,
      optionCImages: cImgs,
      optionDImages: dImgs,
      isValid: errors.length === 0,
      errors,
    });
  }

  if (rows.length === 0) {
    return {
      success: false,
      fatalError: 'No non-empty question rows were found inside the uploaded Excel workbook.',
      fileName: params.fileName,
      fileSizeBytes: params.buffer.length,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted,
    };
  }

  if (distinctModulesSeen.size > 1) {
    return {
      success: false,
      fatalError: `Strict Module-Wise Rule Violation: This workbook mixes multiple modules (${Array.from(distinctModulesSeen)
        .sort((a, b) => a - b)
        .map((m) => `Module ${m}`)
        .join(', ')}). Each Excel upload batch must contain questions from exactly ONE module.`,
      fileName: params.fileName,
      fileSizeBytes: params.buffer.length,
      rows,
      validCount: 0,
      invalidCount: rows.length,
      totalImagesExtracted,
    };
  }

  const validCount = rows.filter((r) => r.isValid).length;
  return {
    success: true,
    fileName: params.fileName,
    fileSizeBytes: params.buffer.length,
    rows,
    validCount,
    invalidCount: rows.length - validCount,
    totalImagesExtracted,
  };
}

export async function parseStudentWorkbookBuffer(buffer: Buffer): Promise<{
  headers: string[];
  rows: { rowNumber: number; usn: string; studentName: string; dob: string }[];
}> {
  if (!buffer || buffer.length < 4) {
    return { headers: [], rows: [] };
  }
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (!isZip) {
    return { headers: [], rows: [] };
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (err) {
    console.warn('[ExcelImageService] parseStudentWorkbookBuffer load error:', err);
    return { headers: [], rows: [] };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { headers: [], rows: [] };
  }
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let c = 1; c <= sheet.columnCount; c++) {
    headers.push(sanitizeCellValue(headerRow.getCell(c).value));
  }
  const rows: { rowNumber: number; usn: string; studentName: string; dob: string }[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const usn = sanitizeCellValue(row.getCell(1).value).toUpperCase();
    const studentName = sanitizeCellValue(row.getCell(2).value);
    const dob = sanitizeCellValue(row.getCell(3).value);
    if (!usn && !studentName && !dob) continue;
    rows.push({ rowNumber: r, usn, studentName, dob });
  }
  return { headers, rows };
}
