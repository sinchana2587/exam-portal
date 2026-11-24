import type ExcelJS from 'exceljs';
import type {
  ExtractedQuestionPreviewRow,
  ExtractedStudentPreviewRow,
  QuestionImageAsset,
  QuestionImageField,
} from '../types';
import { triggerBlobDownload } from './exportUtils';
import {
  base64ToUint8Array,
  ensureImageDataUrl,
  sha256Hex,
  uint8ArrayToBase64,
} from './browserPdfOcr';
import type { ParsedQuestionRow, QuestionExcelParseResult } from './fileHandlers';

export const STANDARD_STUDENT_HEADERS = ['Sl.no.', 'Student Name', 'USN', 'Date of Birth'] as const;
export const STANDARD_QUESTION_HEADERS = [
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
] as const;

export const LEGACY_QUESTION_HEADERS = [
  'Module Number',
  'Question Text',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Correct Option',
] as const;

const FIELD_TO_IMAGE_COL_INDEX: Record<QuestionImageField, number> = {
  QUESTION_TEXT: 2, // col C (0-based)
  OPTION_A: 4,      // col E
  OPTION_B: 6,      // col G
  OPTION_C: 8,      // col I
  OPTION_D: 10,     // col K
};

const FIELD_TO_COL_INDEX: Record<QuestionImageField, number> = {
  QUESTION_TEXT: 1, // col B (0-based)
  OPTION_A: 2,      // col C
  OPTION_B: 3,      // col D
  OPTION_C: 4,      // col E
  OPTION_D: 5,      // col F
};

const COL_INDEX_TO_FIELD: Record<number, QuestionImageField> = {
  1: 'QUESTION_TEXT',
  2: 'OPTION_A',
  3: 'OPTION_B',
  4: 'OPTION_C',
  5: 'OPTION_D',
};

async function loadExcelJs(): Promise<typeof ExcelJS> {
  const mod = await import('exceljs');
  return ((mod as unknown as { default?: typeof ExcelJS }).default || mod) as typeof ExcelJS;
}

async function loadJsZip() {
  const mod = await import('jszip');
  return ((mod as unknown as { default?: typeof import('jszip') }).default || mod) as typeof import('jszip');
}

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

export async function buildStudentWorkbookBlob(
  rows: Pick<ExtractedStudentPreviewRow, 'usn' | 'studentName' | 'dob'>[]
): Promise<Blob> {
  const Excel = await loadExcelJs();
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet('Student List');

  // Exact 3-column specification: USN | Student Name | DOB
  sheet.columns = [
    { header: 'USN', key: 'usn', width: 22 },
    { header: 'Student Name', key: 'studentName', width: 36 },
    { header: 'DOB', key: 'dob', width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  rows.forEach((row) => {
    const cleanUsn = row.usn.trim().toUpperCase();
    const cleanName = row.studentName.trim();
    const rawDob = (row.dob || '').trim();

    let dateVal: Date | string = rawDob;
    let isDate = false;

    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
      const [y, m, d] = rawDob.split('-').map(Number);
      dateVal = new Date(Date.UTC(y, m - 1, d));
      isDate = true;
    } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(rawDob)) {
      const parts = rawDob.split(/[-/]/).map(Number);
      dateVal = new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
      isDate = true;
    }

    const added = sheet.addRow([cleanUsn, cleanName, dateVal]);
    added.height = 20;

    const cellUsn = added.getCell(1);
    cellUsn.numFmt = '@';
    cellUsn.alignment = { vertical: 'middle', horizontal: 'left' };

    const cellName = added.getCell(2);
    cellName.numFmt = '@';
    cellName.alignment = { vertical: 'middle', horizontal: 'left' };

    const cellDob = added.getCell(3);
    if (isDate) {
      cellDob.numFmt = 'DD-MM-YYYY';
    } else {
      cellDob.numFmt = '@';
    }
    cellDob.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function buildQuestionWorkbookBytes(params: {
  moduleNumber: number;
  subjectCode: string;
  rows: ExtractedQuestionPreviewRow[];
}): Promise<Uint8Array> {
  const Excel = await loadExcelJs();
  let workbook: InstanceType<typeof Excel.Workbook>;
  try {
    const res = await fetch('/templates/q_template.xlsx');
    if (res.ok) {
      workbook = new Excel.Workbook();
      await workbook.xlsx.load(await res.arrayBuffer());
    } else {
      throw new Error();
    }
  } catch (_) {
    workbook = new Excel.Workbook();
    for (let m = 1; m <= 5; m++) {
      const ws = workbook.addWorksheet(`Module ${m}`);
      ws.columns = [
        { header: 'Sl.no.', width: 10 },
        { header: 'Questions', width: 38.42 },
        { header: 'Question image', width: 29 },
        { header: 'option A', width: 11.71 },
        { header: 'option A img', width: 21.14 },
        { header: 'option B', width: 12.71 },
        { header: 'option B img', width: 17 },
        { header: 'option C', width: 12.42 },
        { header: 'option C img', width: 15.28 },
        { header: 'option D ', width: 13.42 },
        { header: 'option D  img', width: 17 },
        { header: 'Key Answer', width: 19 },
      ];
    }
  }

  const sheet = workbook.getWorksheet(`Module ${params.moduleNumber}`) || workbook.worksheets[0];
  const imageMapSheet = workbook.getWorksheet('_ImageMap') || workbook.addWorksheet('_ImageMap', { state: 'veryHidden' });

  for (let i = 0; i < params.rows.length; i++) {
    const q = params.rows[i];
    const excelRowNumber = i + 2;

    const added = sheet.addRow([
      i + 1,
      q.questionText.trim(),
      '',
      q.optionA.trim(),
      '',
      q.optionB.trim(),
      '',
      q.optionC.trim(),
      '',
      q.optionD.trim(),
      '',
      q.correctOption.trim().toUpperCase(),
    ]);

    added.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: 'top',
        horizontal: colNumber === 1 || colNumber === 12 ? 'center' : 'left',
        wrapText: true,
      };
    });

    const textLines = Math.max(
      2,
      Math.ceil(q.questionText.length / 44),
      Math.ceil(q.optionA.length / 24),
      Math.ceil(q.optionB.length / 24),
      Math.ceil(q.optionC.length / 24),
      Math.ceil(q.optionD.length / 24)
    );
    let maxImageDisplayH = 0;

    const byField = new Map<QuestionImageField, QuestionImageAsset[]>();
    for (const img of q.images || []) {
      const list = byField.get(img.targetField) || [];
      list.push(img);
      byField.set(img.targetField, list);
    }

    for (const [field, fieldImgs] of byField.entries()) {
      fieldImgs.sort((a, b) => a.sequence - b.sequence);
      const colIdx0 = FIELD_TO_IMAGE_COL_INDEX[field] ?? 2;

      for (let seqIdx = 0; seqIdx < fieldImgs.length; seqIdx++) {
        const asset = fieldImgs[seqIdx];
        const imgBytes = base64ToUint8Array(asset.base64Data);
        const sha256 = asset.sha256 || (await sha256Hex(imgBytes));

        const excelImageId = workbook.addImage({
          buffer: imgBytes.buffer.slice(imgBytes.byteOffset, imgBytes.byteOffset + imgBytes.byteLength) as unknown as ExcelJS.Buffer,
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
      36,
      textLines * 15 + (maxImageDisplayH > 0 ? Math.ceil(maxImageDisplayH * 0.78) + 18 : 8)
    );
    added.height = Math.min(240, rowPtHeight);
  }

  const out = await workbook.xlsx.writeBuffer();
  return new Uint8Array(out as ArrayBuffer);
}

export async function buildQuestionWorkbookBlob(params: {
  moduleNumber: number;
  subjectCode: string;
  rows: ExtractedQuestionPreviewRow[];
}): Promise<Blob> {
  const bytes = await buildQuestionWorkbookBytes(params);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function buildMultiModuleZipBlob(params: {
  subjectCode: string;
  files: { fileName: string; moduleNumber: number; rows: ExtractedQuestionPreviewRow[] }[];
}): Promise<Blob> {
  const JSZip = await loadJsZip();
  const zip = new JSZip();

  for (const item of params.files) {
    const xlsxBytes = await buildQuestionWorkbookBytes({
      moduleNumber: item.moduleNumber,
      subjectCode: params.subjectCode,
      rows: item.rows,
    });
    zip.file(item.fileName, xlsxBytes);
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function downloadStudentExcelTemplateLocal(
  departmentCode: string,
  semesterNumber: number,
  section: string
): Promise<void> {
  const blob = await buildStudentWorkbookBlob([]);
  const cleanSection = section.replace(/\s+/g, '');
  triggerBlobDownload(blob, `${departmentCode}_Sem${semesterNumber}_${cleanSection}_Student_Template.xlsx`);
}

export async function downloadQuestionExcelTemplateLocal(
  subjectCode: string,
  moduleNumber: number
): Promise<void> {
  const blob = await buildQuestionWorkbookBlob({
    moduleNumber,
    subjectCode,
    rows: [],
  });
  triggerBlobDownload(blob, `MITM_${subjectCode}_Module_${moduleNumber}_Template.xlsx`);
}

/**
 * Pre-processes an XLSX ArrayBuffer using JSZip to normalize relationship targets.
 * Desktop Excel or certain generators write Target="/xl/worksheets/sheet1.xml" which causes
 * ExcelJS to fail to locate worksheets (resulting in 0 worksheets found).
 */
async function normalizeXlsxZip(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const JSZip = await loadJsZip();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let modified = false;

    for (const filename of Object.keys(zip.files)) {
      if (filename.endsWith('.rels')) {
        const content = await zip.file(filename)?.async('text');
        if (content && (content.includes('Target="/xl/') || content.includes('Target="/'))) {
          const fixed = content
            .replace(/Target="\/xl\//g, 'Target="')
            .replace(/Target="\//g, 'Target="');
          zip.file(filename, fixed);
          modified = true;
        }
      }
    }

    if (modified) {
      return await zip.generateAsync({ type: 'arraybuffer' });
    }
  } catch {
    // If JSZip normalization fails, fallback to original buffer
  }
  return arrayBuffer;
}

interface RawExtractedDrawing {
  sheetName: string;
  zeroRow: number;
  zeroCol: number;
  excelRowNum: number;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  base64Data: string;
  sha256: string;
}

/**
 * Universal DrawingML extractor across all worksheets in the XLSX package.
 * Directly inspects DrawingML anchors and relationships via JSZip to ensure diagrams
 * in all worksheets (Module 1, Module 2, ..., Module N) are captured even when ExcelJS
 * sheet.getImages() does not enumerate them.
 */
async function extractAllWorksheetDrawings(arrayBuffer: ArrayBuffer): Promise<RawExtractedDrawing[]> {
  const result: RawExtractedDrawing[] = [];
  try {
    const JSZip = await loadJsZip();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const wbXml = await zip.file('xl/workbook.xml')?.async('text');
    const wbRels = await zip.file('xl/_rels/workbook.xml.rels')?.async('text');
    if (!wbXml || !wbRels) return result;

    const sheetTargetByRelId = new Map<string, string>();
    const relMatches = wbRels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g);
    for (const match of relMatches) {
      let target = match[2].replace(/^\/?xl\//, '').replace(/^\.\.\//, '');
      if (!target.startsWith('worksheets/')) target = `worksheets/${target}`;
      sheetTargetByRelId.set(match[1], `xl/${target}`);
    }

    const sheetMatches = wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g);
    for (const match of sheetMatches) {
      const sheetName = match[1];
      const relId = match[2];
      const wsPath = sheetTargetByRelId.get(relId);
      if (!wsPath) continue;

      const wsXml = await zip.file(wsPath)?.async('text');
      const wsRelsPath = wsPath.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels');
      const wsRels = await zip.file(wsRelsPath)?.async('text');
      if (!wsXml || !wsRels) continue;

      const drawRelMatch = wsXml.match(/<drawing[^>]*r:id="([^"]+)"/i);
      if (!drawRelMatch) continue;
      const drawRelId = drawRelMatch[1];

      const drawRelEntry = wsRels.match(new RegExp(`<Relationship[^>]*Id="${drawRelId}"[^>]*Target="([^"]+)"`, 'i'));
      if (!drawRelEntry) continue;
      let drawTarget = drawRelEntry[1].replace(/^\.\.\//, '');
      if (!drawTarget.startsWith('xl/')) drawTarget = `xl/${drawTarget}`;

      const drawXml = await zip.file(drawTarget)?.async('text');
      const drawRelsPath = drawTarget.replace(/drawings\/([^/]+)$/, 'drawings/_rels/$1.rels');
      const drawRels = await zip.file(drawRelsPath)?.async('text');
      if (!drawXml || !drawRels) continue;

      const mediaByRelId = new Map<string, string>();
      const drawRelEntries = drawRels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g);
      for (const m of drawRelEntries) {
        let mediaTarget = m[2].replace(/^\.\.\//, '');
        if (!mediaTarget.startsWith('xl/')) mediaTarget = `xl/${mediaTarget}`;
        mediaByRelId.set(m[1], mediaTarget);
      }

      const anchorRegex = /<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/g;
      for (const anchorMatch of drawXml.matchAll(anchorRegex)) {
        const anchorContent = anchorMatch[1];
        const fromMatch = anchorContent.match(/<(?:xdr:)?from>[\s\S]*?<(?:xdr:)?col>(\d+)<\/(?:xdr:)?col>[\s\S]*?<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>/);
        const blipMatch = anchorContent.match(/<(?:a:)?blip[^>]*r:embed="([^"]+)"/);
        if (!fromMatch || !blipMatch) continue;

        const zeroCol = parseInt(fromMatch[1], 10);
        const zeroRow = parseInt(fromMatch[2], 10);
        const embedId = blipMatch[1];
        const mediaPath = mediaByRelId.get(embedId);
        if (!mediaPath) continue;

        const mediaFile = zip.file(mediaPath);
        if (!mediaFile) continue;

        const mediaBytes = await mediaFile.async('uint8array');
        const hash = await sha256Hex(mediaBytes);
        const lower = mediaPath.toLowerCase();
        const mimeType: 'image/png' | 'image/jpeg' =
          lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';

        result.push({
          sheetName,
          zeroRow,
          zeroCol,
          excelRowNum: zeroRow + 1,
          mimeType,
          width: 140,
          height: 100,
          base64Data: ensureImageDataUrl(uint8ArrayToBase64(mediaBytes), mimeType),
          sha256: hash,
        });
      }
    }
  } catch {
    // DrawingML extraction fallback error handling
  }
  return result;
}

export async function parseQuestionWorkbookInBrowser(params: {
  file: File;
  subjectModuleCount: number;
  expectedModuleNumber?: number;
  existingQuestionTexts?: string[];
}): Promise<QuestionExcelParseResult> {
  const Excel = await loadExcelJs();
  const rawArrayBuffer = await params.file.arrayBuffer();
  const normalizedBuffer = await normalizeXlsxZip(rawArrayBuffer);
  const workbook = new Excel.Workbook();

  try {
    await workbook.xlsx.load(normalizedBuffer);
  } catch (err) {
    return {
      success: false,
      fatalError: `Failed to read Excel workbook: ${err instanceof Error ? err.message : 'invalid XLSX structure'}.`,
      fileName: params.file.name,
      fileSizeBytes: params.file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  const allVisibleSheets = workbook.worksheets.filter(
    (ws) => ws.state !== 'veryHidden' && ws.name !== '_ImageMap'
  );
  if (allVisibleSheets.length === 0) {
    return {
      success: false,
      fatalError: 'The Excel workbook has no visible worksheets.',
      fileName: params.file.name,
      fileSizeBytes: params.file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted: 0,
    };
  }

  // Multi-worksheet DrawingML extraction
  const fallbackDrawings = await extractAllWorksheetDrawings(normalizedBuffer);

  // Determine target sheets:
  // If single-module mode and there is a sheet named Module X, select it; otherwise inspect all visible sheets with rows
  let targetSheets = allVisibleSheets;
  if (typeof params.expectedModuleNumber === 'number') {
    const specificModuleSheet = allVisibleSheets.find((ws) => {
      const match = ws.name.match(/module\s*(\d+)/i);
      return match && Number(match[1]) === params.expectedModuleNumber;
    });
    if (specificModuleSheet) {
      targetSheets = [specificModuleSheet];
    }
  }

  const existingSet = new Set(
    (params.existingQuestionTexts || []).map((t) => t.trim().toLowerCase())
  );
  const seenInFile = new Set<string>();
  const rows: ParsedQuestionRow[] = [];
  const distinctModulesSeen = new Set<number>();
  let totalImagesExtracted = 0;

  for (const sheet of targetSheets) {
    if (sheet.rowCount < 2) continue;

    const sheetModMatch = sheet.name.match(/module\s*(\d+)/i);
    const sheetDefaultModule = sheetModMatch ? Number(sheetModMatch[1]) : (params.expectedModuleNumber || 1);

    const headerRow = sheet.getRow(1);
    const rawHeaders: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      rawHeaders.push(sanitizeCellValue(headerRow.getCell(c).value));
    }
    while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === '') {
      rawHeaders.pop();
    }

    const cleanHeaders = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Detect columns
    let slNoCol = cleanHeaders.findIndex((h) => h === 'slno' || h === 'sl' || h === 'sno' || h === 'serial');
    let questionCol = cleanHeaders.findIndex((h) => h === 'questions' || h.includes('questiontext') || h === 'prompt');
    let qImgCol = cleanHeaders.findIndex((h) => h === 'questionimage' || h === 'questionimg');
    let optACol = cleanHeaders.findIndex((h) => h === 'optiona');
    let aImgCol = cleanHeaders.findIndex((h) => h === 'optionaimg');
    let optBCol = cleanHeaders.findIndex((h) => h === 'optionb');
    let bImgCol = cleanHeaders.findIndex((h) => h === 'optionbimg');
    let optCCol = cleanHeaders.findIndex((h) => h === 'optionc');
    let cImgCol = cleanHeaders.findIndex((h) => h === 'optioncimg');
    let optDCol = cleanHeaders.findIndex((h) => h === 'optiond');
    let dImgCol = cleanHeaders.findIndex((h) => h === 'optiondimg');
    let keyCol = cleanHeaders.findIndex((h) => h === 'keyanswer' || h === 'correctoption' || h === 'correct' || h === 'answer');
    let modCol = cleanHeaders.findIndex((h) => h === 'modulenumber' || h === 'module');

    const is12ColFormat = rawHeaders.length >= 10 || qImgCol >= 0 || aImgCol >= 0;

    // Fallbacks if 12-column standard template (q_template.xlsx)
    if (is12ColFormat) {
      if (slNoCol === -1) slNoCol = 0;
      if (questionCol === -1) questionCol = 1;
      if (qImgCol === -1) qImgCol = 2;
      if (optACol === -1) optACol = 3;
      if (aImgCol === -1) aImgCol = 4;
      if (optBCol === -1) optBCol = 5;
      if (bImgCol === -1) bImgCol = 6;
      if (optCCol === -1) optCCol = 7;
      if (cImgCol === -1) cImgCol = 8;
      if (optDCol === -1) optDCol = 9;
      if (dImgCol === -1) dImgCol = 10;
      if (keyCol === -1) keyCol = 11;
    } else if (rawHeaders.length === 7) {
      // Legacy 7-column template fallback
      if (modCol === -1) modCol = 0;
      if (questionCol === -1) questionCol = 1;
      if (optACol === -1) optACol = 2;
      if (optBCol === -1) optBCol = 3;
      if (optCCol === -1) optCCol = 4;
      if (optDCol === -1) optDCol = 5;
      if (keyCol === -1) keyCol = 6;
    }

    if (questionCol === -1 || optACol === -1 || keyCol === -1) {
      continue; // Skip non-question worksheets
    }

    // Map images from ExcelJS sheet.getImages()
    const sheetImages = sheet.getImages();
    const imagesByRowAndField = new Map<string, QuestionImageAsset[]>();

    const mediaById = new Map<
      string,
      { base64DataUrl: string; mimeType: 'image/png' | 'image/jpeg'; sha256: string }
    >();

    for (const imgRef of sheetImages) {
      const imgIdKey = String(imgRef.imageId);
      if (!mediaById.has(imgIdKey)) {
        const media = workbook.getImage(Number(imgRef.imageId));
        if (media && media.buffer) {
          const rawBytes =
            media.buffer instanceof Uint8Array
              ? media.buffer
              : new Uint8Array(media.buffer as ArrayBuffer);
          const ext = (media.extension || 'png').toLowerCase();
          const mimeType: 'image/png' | 'image/jpeg' =
            ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'image/png';
          mediaById.set(imgIdKey, {
            base64DataUrl: ensureImageDataUrl(uint8ArrayToBase64(rawBytes), mimeType),
            mimeType,
            sha256: await sha256Hex(rawBytes),
          });
        }
      }
    }

    const addAssetToMap = (
      excelRowNum: number,
      field: QuestionImageField,
      img: {
        mimeType: 'image/png' | 'image/jpeg';
        width?: number;
        height?: number;
        base64Data: string;
        sha256: string;
      }
    ) => {
      const key = `${excelRowNum}:${field}`;
      const list = imagesByRowAndField.get(key) || [];
      if (!list.some((existing) => existing.sha256 === img.sha256)) {
        list.push({
          assetId: `xlsx-img-s${sheet.id}-r${excelRowNum}-${field.toLowerCase()}-${list.length + 1}`,
          targetField: field,
          sequence: list.length + 1,
          mimeType: img.mimeType,
          width: Math.round(img.width || 140),
          height: Math.round(img.height || 100),
          base64Data: img.base64Data,
          sha256: img.sha256,
        });
        imagesByRowAndField.set(key, list);
        totalImagesExtracted += 1;
      }
    };

    // 1. Process ExcelJS images
    for (const imgRef of sheetImages) {
      const tl = imgRef.range?.tl as
        | { nativeRow?: number; nativeCol?: number; row?: number; col?: number }
        | undefined;
      const zeroRow = Math.floor(tl?.nativeRow ?? tl?.row ?? -1);
      const zeroCol = Math.floor(tl?.nativeCol ?? tl?.col ?? -1);
      const excelRowNum = zeroRow + 1;
      const imgIdKey = String(imgRef.imageId);

      let field: QuestionImageField | undefined;
      if (is12ColFormat) {
        if (zeroCol === qImgCol || zeroCol === questionCol) field = 'QUESTION_TEXT';
        else if (zeroCol === aImgCol || zeroCol === optACol) field = 'OPTION_A';
        else if (zeroCol === bImgCol || zeroCol === optBCol) field = 'OPTION_B';
        else if (zeroCol === cImgCol || zeroCol === optCCol) field = 'OPTION_C';
        else if (zeroCol === dImgCol || zeroCol === optDCol) field = 'OPTION_D';
      } else {
        if (zeroCol === questionCol) field = 'QUESTION_TEXT';
        else if (zeroCol === optACol) field = 'OPTION_A';
        else if (zeroCol === optBCol) field = 'OPTION_B';
        else if (zeroCol === optCCol) field = 'OPTION_C';
        else if (zeroCol === optDCol) field = 'OPTION_D';
      }

      const media = mediaById.get(imgIdKey);
      if (!field || excelRowNum < 2 || !media) continue;

      const rangeExt = (imgRef.range as { ext?: { width?: number; height?: number } } | undefined)?.ext;
      addAssetToMap(excelRowNum, field, {
        mimeType: media.mimeType,
        width: rangeExt?.width,
        height: rangeExt?.height,
        base64Data: media.base64DataUrl,
        sha256: media.sha256,
      });
    }

    // 2. Process DrawingML fallback images for this sheet
    const matchingDrawings = fallbackDrawings.filter(
      (d) => d.sheetName.toLowerCase() === sheet.name.toLowerCase()
    );
    for (const d of matchingDrawings) {
      let field: QuestionImageField | undefined;
      if (is12ColFormat) {
        if (d.zeroCol === qImgCol || d.zeroCol === questionCol) field = 'QUESTION_TEXT';
        else if (d.zeroCol === aImgCol || d.zeroCol === optACol) field = 'OPTION_A';
        else if (d.zeroCol === bImgCol || d.zeroCol === optBCol) field = 'OPTION_B';
        else if (d.zeroCol === cImgCol || d.zeroCol === optCCol) field = 'OPTION_C';
        else if (d.zeroCol === dImgCol || d.zeroCol === optDCol) field = 'OPTION_D';
      } else {
        if (d.zeroCol === questionCol) field = 'QUESTION_TEXT';
        else if (d.zeroCol === optACol) field = 'OPTION_A';
        else if (d.zeroCol === optBCol) field = 'OPTION_B';
        else if (d.zeroCol === optCCol) field = 'OPTION_C';
        else if (d.zeroCol === optDCol) field = 'OPTION_D';
      }

      if (field && d.excelRowNum >= 2) {
        addAssetToMap(d.excelRowNum, field, d);
      }
    }

    const seenSerialsInSheet = new Set<string>();

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      let moduleRaw = modCol >= 0 ? sanitizeCellValue(row.getCell(modCol + 1).value) : '';
      if (!moduleRaw && sheetDefaultModule) {
        moduleRaw = String(sheetDefaultModule);
      }
      const slNoRaw = slNoCol >= 0 ? sanitizeCellValue(row.getCell(slNoCol + 1).value) : '';
      const questionText = questionCol >= 0 ? sanitizeCellValue(row.getCell(questionCol + 1).value) : '';
      const optionA = optACol >= 0 ? sanitizeCellValue(row.getCell(optACol + 1).value) : '';
      const optionB = optBCol >= 0 ? sanitizeCellValue(row.getCell(optBCol + 1).value) : '';
      const optionC = optCCol >= 0 ? sanitizeCellValue(row.getCell(optCCol + 1).value) : '';
      const optionD = optDCol >= 0 ? sanitizeCellValue(row.getCell(optDCol + 1).value) : '';
      const rawKey = keyCol >= 0 ? sanitizeCellValue(row.getCell(keyCol + 1).value) : '';
      let correctOption = rawKey.toUpperCase();
      if (correctOption.startsWith('OPTION ')) correctOption = correctOption.substring(7).trim();
      if (correctOption.startsWith('OPTION')) correctOption = correctOption.substring(6).trim();

      const qImgs = (imagesByRowAndField.get(`${r}:QUESTION_TEXT`) || []).sort((a, b) => a.sequence - b.sequence);
      const aImgs = (imagesByRowAndField.get(`${r}:OPTION_A`) || []).sort((a, b) => a.sequence - b.sequence);
      const bImgs = (imagesByRowAndField.get(`${r}:OPTION_B`) || []).sort((a, b) => a.sequence - b.sequence);
      const cImgs = (imagesByRowAndField.get(`${r}:OPTION_C`) || []).sort((a, b) => a.sequence - b.sequence);
      const dImgs = (imagesByRowAndField.get(`${r}:OPTION_D`) || []).sort((a, b) => a.sequence - b.sequence);
      const hasAnyImage = qImgs.length + aImgs.length + bImgs.length + cImgs.length + dImgs.length > 0;

      if (!questionText && !optionA && !optionB && !optionC && !optionD && !correctOption && !hasAnyImage) {
        continue;
      }

      const errors: string[] = [];

      // Duplicate serial numbers check in Column A (Sl.no.) per worksheet
      if (slNoRaw) {
        if (seenSerialsInSheet.has(slNoRaw)) {
          errors.push(`Sl.no.: Duplicate serial number "${slNoRaw}" in worksheet "${sheet.name}".`);
        }
        seenSerialsInSheet.add(slNoRaw);
      }

      let modNum = Number(moduleRaw) || sheetDefaultModule;

      if (!Number.isInteger(modNum) || modNum < 1 || modNum > params.subjectModuleCount) {
        errors.push(
          `Module Number: "${moduleRaw || 'blank'}" must be an integer between 1 and ${params.subjectModuleCount}.`
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

      // Question Stem: support image-only question
      if (!questionText && qImgs.length === 0) {
        errors.push('Question Text: Question text or diagram image is required.');
      } else if (questionText) {
        const norm = questionText.toLowerCase();
        if (seenInFile.has(norm)) {
          errors.push('Question Text: Duplicate question within the uploaded file.');
        }
        if (existingSet.has(norm)) {
          errors.push('Question Text: Duplicate of an existing active question in this subject.');
        }
        seenInFile.add(norm);
      } else if (qImgs.length > 0) {
        const imgSig = `[img:${qImgs.map((im) => im.sha256).sort().join(',')}]`;
        if (seenInFile.has(imgSig)) {
          errors.push('Question Image: Duplicate image-only question within the uploaded file.');
        }
        seenInFile.add(imgSig);
      }

      // Options A-D: support image-only options
      const optPairs = [
        { label: 'Option A', text: optionA, imgs: aImgs },
        { label: 'Option B', text: optionB, imgs: bImgs },
        { label: 'Option C', text: optionC, imgs: cImgs },
        { label: 'Option D', text: optionD, imgs: dImgs },
      ];
      if (optPairs.some((o) => !o.text && o.imgs.length === 0)) {
        errors.push('Options A–D: All four options require text or an embedded option image.');
      } else {
        const sigs = optPairs.map(
          (o) => `${o.text.trim().toLowerCase()}::${o.imgs.map((img) => img.sha256 || img.assetId).sort().join(',')}`
        );
        if (new Set(sigs).size < 4) {
          errors.push('Options A–D: All four options must be distinct (by text or image).');
        }
      }

      if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
        errors.push(`Correct Option: "${rawKey || correctOption || 'blank'}" must be A, B, C, or D.`);
      }

      rows.push({
        rowNumber: rows.length + 1,
        worksheetName: sheet.name,
        moduleNumber: Number.isInteger(modNum) ? modNum : null,
        moduleRaw: String(modNum),
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
  }

  if (rows.length === 0) {
    return {
      success: false,
      fatalError: 'No non-empty question rows were found inside the uploaded Excel workbook.',
      fileName: params.file.name,
      fileSizeBytes: params.file.size,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      totalImagesExtracted,
      questionsWithImagesCount: 0,
      optionsWithImagesCount: 0,
      moduleBreakdown: {},
    };
  }

  if (typeof params.expectedModuleNumber === 'number' && distinctModulesSeen.size > 1) {
    return {
      success: false,
      fatalError: `Strict Module-Wise Rule Violation: This workbook mixes multiple modules (${Array.from(distinctModulesSeen)
        .sort((a, b) => a - b)
        .map((m) => `Module ${m}`)
        .join(', ')}). Single-module upload requires every question to belong to Module ${params.expectedModuleNumber}.`,
      fileName: params.file.name,
      fileSizeBytes: params.file.size,
      rows,
      validCount: 0,
      invalidCount: rows.length,
      totalImagesExtracted,
      questionsWithImagesCount: 0,
      optionsWithImagesCount: 0,
      moduleBreakdown: {},
    };
  }

  let questionsWithImagesCount = 0;
  let optionsWithImagesCount = 0;
  const moduleBreakdown: Record<number, number> = {};

  for (const r of rows) {
    if (r.questionImages.length > 0) questionsWithImagesCount++;
    if (
      r.optionAImages.length > 0 ||
      r.optionBImages.length > 0 ||
      r.optionCImages.length > 0 ||
      r.optionDImages.length > 0
    ) {
      optionsWithImagesCount++;
    }
    if (r.moduleNumber !== null) {
      moduleBreakdown[r.moduleNumber] = (moduleBreakdown[r.moduleNumber] || 0) + 1;
    }
  }

  const validCount = rows.filter((r) => r.isValid).length;
  return {
    success: true,
    fileName: params.file.name,
    fileSizeBytes: params.file.size,
    rows,
    validCount,
    invalidCount: rows.length - validCount,
    totalImagesExtracted,
    questionsWithImagesCount,
    optionsWithImagesCount,
    moduleBreakdown,
  };
}
