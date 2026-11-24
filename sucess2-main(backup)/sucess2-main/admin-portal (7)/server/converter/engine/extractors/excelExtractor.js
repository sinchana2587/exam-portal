import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.resolve(__dirname, '../../../uploads/images');
const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const QUESTION_HEADERS = new Set(['question', 'questions', 'questiontext', 'questionstatement', 'questiondescription', 'problem', 'statement']);
const OPTION_HEADERS = {
  a: new Set(['a', 'optiona', 'choicea', 'answera', 'option1', 'choice1']),
  b: new Set(['b', 'optionb', 'choiceb', 'answerb', 'option2', 'choice2']),
  c: new Set(['c', 'optionc', 'choicec', 'answerc', 'option3', 'choice3']),
  d: new Set(['d', 'optiond', 'choiced', 'answerd', 'option4', 'choice4'])
};

function getQuestionHeaderScore(headers) {
  const normalized = headers.map(normalizeHeader);
  if (!normalized.some(header => QUESTION_HEADERS.has(header))) return 0;
  const optionCount = Object.entries(OPTION_HEADERS).filter(([key, aliases]) => normalized.some(header =>
    aliases.has(header) ||
    new RegExp(`^(?:option|choice|answer)${key}(?:text|value)?$`).test(header) ||
    new RegExp(`^${key}(?:option|choice|answer|text)$`).test(header)
  )).length;
  return optionCount >= 2 ? 100 + optionCount : 0;
}

function inferModuleNumber(sheetName, fallback) {
  const match = String(sheetName || '').match(/\b(?:module|unit|part|section)\s*[-_ ]?\s*(\d+|[ivxlcdm]+)\b/i);
  if (!match) return fallback;
  const value = match[1].toUpperCase();
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
  return Number(value) || roman[value] || fallback;
}

function findImageColumnHeader(headers, anchorColumn) {
  const anchorHeader = String(headers[anchorColumn] || '').trim();
  const normalized = normalizeHeader(anchorHeader);
  if (/(image|img|diagram|figure|photo|picture)/.test(normalized)) return anchorHeader;

  const optionMatch = normalized.match(/(?:option|choice|answer)([abcd1-4])/);
  if (optionMatch) {
    const option = ({ 1: 'a', 2: 'b', 3: 'c', 4: 'd' })[optionMatch[1]] || optionMatch[1];
    const preferred = headers.find(header => {
      const key = normalizeHeader(header);
      return [`option${option}img`, `option${option}image`, `image${option}`, `img${option}`, `choice${option}img`, `choice${option}image`].includes(key);
    });
    return preferred || `option ${option.toUpperCase()} img`;
  }

  if (/(question|problem|statement)/.test(normalized)) {
    const preferred = headers.find(header => /^(question|imagequestion|questionimage|questionimg|questionfigure|questiondiagram)$/.test(normalizeHeader(header)) && /(image|img|figure|diagram)/.test(normalizeHeader(header)));
    return preferred || 'Question image';
  }

  return 'Question image';
}

async function attachEmbeddedImages(filePath, sheetName, headers, rows, sourceRowNumbers) {
  if (!sheetName || rows.length === 0) return [];

  try {
    const headerBuf = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuf, 0, 4, 0);
    fs.closeSync(fd);
    const isZip = headerBuf[0] === 0x50 && headerBuf[1] === 0x4B && headerBuf[2] === 0x03 && headerBuf[3] === 0x04;
    if (!isZip) return [];
  } catch (_) {
    return [];
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (err) {
    console.warn(`[Excel Extractor] Image extraction skipped for non-zip workbook: ${err.message}`);
    return [];
  }

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) return [];

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const rowIndexes = new Map(sourceRowNumbers.map((rowNumber, index) => [rowNumber, index]));
  const extractedImages = [];
  for (const imageAnchor of worksheet.getImages()) {
    const rowNumber = Math.floor(imageAnchor.range.tl.nativeRow) + 1;
    const rowIndex = rowIndexes.get(rowNumber);
    if (rowIndex === undefined) continue;

    const media = workbook.getImage(Number(imageAnchor.imageId));
    if (!media) continue;
    const imageBuffer = media.buffer || (media.base64 ? Buffer.from(media.base64, 'base64') : null);
    if (!imageBuffer) continue;

    const extension = String(media.extension || 'png').toLowerCase().replace(/^jpeg$/, 'jpg');
    const filename = `question_bank_${randomUUID()}.${extension}`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), imageBuffer);

    const targetHeader = findImageColumnHeader(headers, Math.floor(imageAnchor.range.tl.nativeCol));
    const existingValue = rows[rowIndex][targetHeader];
    const imageUrl = `/uploads/images/${filename}`;
    rows[rowIndex][targetHeader] = existingValue ? `${existingValue} ${imageUrl}` : imageUrl;
    extractedImages.push({ filename, url: imageUrl, rowNumber, column: targetHeader });
  }
  return extractedImages;
}

export async function extractFromExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const sheetsData = {};
  const populatedSheets = [];
  const questionBankSheets = [];
  let extractedImages = [];

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to 2D array first to scan for actual header row
    const rawMatrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawMatrix || rawMatrix.length === 0) continue;

    // Prefer a recognizable MCQ header so a question containing words like
    // "option" cannot be mistaken for the table header.
    let headerRowIndex = 0;
    let maxMatchCount = 0;
    let questionHeaderIndex = -1;
    let questionHeaderScore = 0;

    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      const score = getQuestionHeaderScore(row.map(value => String(value || '').trim()));
      if (score > questionHeaderScore) {
        questionHeaderScore = score;
        questionHeaderIndex = i;
      }
    }

    const keywords = [
      'usn', 'roll', 'reg', 'student', 'name', 'sec', 'sem', 'sl', 'serial',
      'question', 'question no', 'qno', 'option', 'choice', 'answer', 'module', 'unit'
    ];

    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      const matchCount = row.filter(cell => {
        const str = String(cell || '').toLowerCase().trim();
        return keywords.some(k => str.includes(k));
      }).length;

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        headerRowIndex = i;
      }
    }

    if (questionHeaderIndex >= 0) headerRowIndex = questionHeaderIndex;
    const headers = rawMatrix[headerRowIndex].map(h => String(h || '').trim());
    const questionSheet = getQuestionHeaderScore(headers) > 0;
    const dataRows = [];
    const sourceRowNumbers = [];

    for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
      const rowArr = rawMatrix[r];
      // Skip empty rows
      if (!rowArr || rowArr.every(c => c === '' || c === null || c === undefined)) continue;

      const rowObj = {};
      headers.forEach((h, colIdx) => {
        const key = h || `col_${colIdx}`;
        rowObj[key] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : '';
      });
      dataRows.push(rowObj);
      sourceRowNumbers.push(r + 1);
    }

    sheetsData[sheetName] = {
      headers,
      rows: dataRows,
      rawMatrix
    };

    if (dataRows.length > 0) {
      const entry = { sheetName, headers, rows: dataRows, sourceRowNumbers, questionSheet };
      populatedSheets.push(entry);
      if (questionSheet) questionBankSheets.push(entry);
    }
  }

  const rowsToConvert = questionBankSheets.length ? questionBankSheets : populatedSheets.slice(0, 1);
  const headers = rowsToConvert[0]?.headers || [];
  const primaryRows = [];

  rowsToConvert.forEach((sheet, sheetIndex) => {
    const moduleNumber = inferModuleNumber(sheet.sheetName, sheetIndex + 1);
    for (const row of sheet.rows) {
      const explicitModule = Object.entries(row).some(([key, value]) =>
        ['module', 'moduleno', 'modulenumber', 'unit', 'unitno', 'part', 'section'].includes(normalizeHeader(key)) && String(value || '').trim()
      );
      if (!explicitModule && sheet.questionSheet) row['Module Number'] = moduleNumber;
    }
    primaryRows.push(...sheet.rows);
  });

  if (path.extname(filePath).toLowerCase() === '.xlsx') {
    for (const sheet of rowsToConvert) {
      try {
        extractedImages.push(...await attachEmbeddedImages(filePath, sheet.sheetName, sheet.headers, sheet.rows, sheet.sourceRowNumbers));
      } catch (err) {
        console.warn(`[Excel Extractor] Embedded image extraction warning in ${sheet.sheetName}:`, err.message);
      }
    }
  }

  return {
    sheetNames,
    primaryRows,
    headers,
    sheets: sheetsData,
    images: extractedImages
  };
}

