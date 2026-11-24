// @ts-nocheck
import ExcelJS from 'exceljs';

/**
 * Converts a base64 or image data URL to a pure base64 string and extension
 */
function parseImageData(dataUrl) {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('data:image/')) {
    const parts = dataUrl.split(',');
    const match = dataUrl.match(/data:image\/(png|jpeg|jpg);base64/);
    const ext = (match && match[1] === 'jpg') ? 'jpeg' : ((match && match[1]) || 'png');
    return {
      base64: parts[1],
      extension: ext
    };
  }
  return null;
}

async function resolveImageData(source) {
  const direct = parseImageData(source || '');
  if (direct || !source) return direct;

  try {
    const imageUrl = source.startsWith('/') ? source : `/uploads/images/${source}`;
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return parseImageData(dataUrl);
  } catch (_) {
    return null;
  }
}

function createFallbackQuestionWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MIT Mysore Examination Management System';
  wb.lastModifiedBy = 'Document Converter Engine';
  wb.created = new Date();
  wb.modified = new Date();

  const headers = [
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
  ];
  const colWidths = [10, 38.4, 29, 11.7, 21.1, 12.7, 17, 12.4, 15.3, 13.4, 17, 19];

  for (let m = 1; m <= 5; m++) {
    const ws = wb.addWorksheet(`Module ${m}`);
    ws.columns = headers.map((header, idx) => ({
      header,
      key: `col_${idx + 1}`,
      width: colWidths[idx] || 15
    }));
    const headerRow = ws.getRow(1);
    headerRow.height = 30;
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF101B46' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  return wb;
}

function createFallbackStudentWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MIT Mysore Examination Management System';
  wb.lastModifiedBy = 'Document Converter Engine';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Sheet1');
  const headers = ['Sl.no.', 'Student Name', 'USN', 'Date of Birth'];
  const colWidths = [10, 38.3, 18, 21];
  ws.columns = headers.map((header, idx) => ({
    header,
    key: `col_${idx + 1}`,
    width: colWidths[idx] || 15
  }));
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF101B46' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  return wb;
}

async function loadTemplateWorkbook(filename) {
  try {
    const response = await fetch(`/templates/${filename}`);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      // Guard against Vite SPA fallback returning index.html as 200 OK
      if (!contentType.includes('text/html')) {
        const buffer = await response.arrayBuffer();
        if (buffer && buffer.byteLength >= 4) {
          const magic = new Uint8Array(buffer, 0, 4);
          // Check ZIP header: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
          if (magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            return workbook;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Converter] Built-in template /templates/${filename} fetch/load warning, utilizing resilient in-memory generator:`, err);
  }

  // Resilient fallback: authentic standard institutional workbook
  if (filename.includes('q_template')) {
    return createFallbackQuestionWorkbook();
  }
  if (filename.includes('std_template')) {
    return createFallbackStudentWorkbook();
  }

  const fallback = new ExcelJS.Workbook();
  fallback.addWorksheet('Sheet1');
  return fallback;
}

const normalizeTemplateHeader = (header) => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Creates and formats the Question Paper ExcelJS Workbook
 */
export async function createQuestionPaperWorkbook(paper, configuredFields = []) {
  const workbook = await loadTemplateWorkbook('q_template.xlsx');
  const templateSheet = workbook.getWorksheet('Module 1') || workbook.worksheets[0];
  const getModuleWorksheet = (moduleNumber) => {
    const sheetName = `Module ${moduleNumber}`;
    const existing = workbook.getWorksheet(sheetName);
    if (existing) return existing;
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = templateSheet.columns.map(column => ({
      width: column.width,
      hidden: column.hidden,
      outlineLevel: column.outlineLevel,
      style: column.style
    }));
    const sourceHeader = templateSheet.getRow(1);
    const newHeader = worksheet.getRow(1);
    newHeader.height = sourceHeader.height;
    sourceHeader.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const target = newHeader.getCell(columnNumber);
      target.value = cell.value;
      target.style = structuredClone(cell.style);
    });
    return worksheet;
  };
  const headers = templateSheet.getRow(1).values.slice(1).map(header => String(header || ''));
  if (configuredFields.length && headers.some((header, index) => header !== configuredFields[index])) {
    throw new Error('The question-paper workbook does not match the configured template headers.');
  }

  const fieldsByKey = new Map(headers.map((header, index) => [normalizeTemplateHeader(header), index]));
  const imageHeaders = {
    questionimage: (question) => question.questionImage,
    optionaimg: (question) => question.options?.A?.image,
    optionbimg: (question) => question.options?.B?.image,
    optioncimg: (question) => question.options?.C?.image,
    optiondimg: (question) => question.options?.D?.image
  };

  for (const [moduleIndex, module] of (paper.modules || []).entries()) {
    const moduleNumber = Number(module.moduleNumber) || moduleIndex + 1;
    const ws = getModuleWorksheet(moduleNumber);
    const moduleHeaders = ws.getRow(1).values.slice(1).map(header => String(header || ''));
    for (const [index, question] of (module.questions || []).entries()) {
      const values = {
        slno: question.questionNumber || index + 1,
        questions: question.questionText || '',
        questionimage: question.questionImage || '',
        optiona: question.options?.A?.text || '',
        optionaimg: question.options?.A?.image || '',
        optionb: question.options?.B?.text || '',
        optionbimg: question.options?.B?.image || '',
        optionc: question.options?.C?.text || '',
        optioncimg: question.options?.C?.image || '',
        optiond: question.options?.D?.text || '',
        optiondimg: question.options?.D?.image || '',
        keyanswer: question.correctAnswer || ''
      };
      const rowValues = moduleHeaders.map(header => values[normalizeTemplateHeader(header)] ?? '');
      const row = ws.addRow(rowValues);
      const rowIndex = row.number;
      row.height = 55;
      row.alignment = { vertical: 'middle', wrapText: true };

      for (const [headerKey, getImage] of Object.entries(imageHeaders)) {
        const imageColumn = fieldsByKey.get(headerKey);
        const source = getImage(question);
        if (imageColumn === undefined || !source) continue;

        const parsed = await resolveImageData(source);
        if (!parsed) continue;
        try {
          const imageId = workbook.addImage({ base64: parsed.base64, extension: parsed.extension });
          ws.addImage(imageId, {
            tl: { col: imageColumn + 0.1, row: rowIndex - 0.9 },
            ext: { width: 82, height: 42 }
          });
          row.getCell(imageColumn + 1).value = '';
        } catch (_) { }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { workbook, buffer };
}

export function normalizeDobToYyyyMmDd(rawVal) {
  if (!rawVal || String(rawVal).trim() === '') return '[UNCLEAR: missing]';
  const str = String(rawVal).trim();
  if (str.startsWith('[UNCLEAR:')) return str;
  const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) {
    const num1 = parseInt(ddmmyyyy[1], 10);
    const num2 = parseInt(ddmmyyyy[2], 10);
    const y = ddmmyyyy[3];
    if (num1 > 12 && num1 <= 31 && num2 <= 12) return `${y}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
    if (num2 > 12 && num2 <= 31 && num1 <= 12) return `${y}-${String(num1).padStart(2, '0')}-${String(num2).padStart(2, '0')}`;
    return `${y}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
  }
  const yyyymmdd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`;
  }
  return `[UNCLEAR: ${str}]`;
}

/**
 * Creates and formats the Student List ExcelJS Workbook
 */
export async function createStudentListWorkbook(students) {
  const workbook = await loadTemplateWorkbook('std_template.xlsx');
  const ws = workbook.worksheets[0];
  const headers = ws.getRow(1).values.slice(1).map(header => String(header || ''));
  const valuesByKey = (student, index) => ({
    slno: student.serialNumber || student['Sl.no.'] || index + 1,
    studentname: (student.studentName || student['Student Name'] || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(),
    usn: (student.usn || student['USN'] || '').replace(/\s+/g, '').toUpperCase(),
    dateofbirth: normalizeDobToYyyyMmDd(student.dateOfBirth || student.dob || student['Date of Birth'])
  });

  students.forEach((student, index) => {
    const values = valuesByKey(student, index);
    const row = ws.addRow(headers.map(header => values[normalizeTemplateHeader(header)] ?? ''));
    row.height = 24;
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { workbook, buffer };
}

/**
 * Triggers browser download for a workbook buffer
 */
export function triggerFileDownload(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads question paper excel
 */
export async function downloadQuestionPaperExcel(paper, filename = 'Question_Paper_Standard.xlsx') {
  const { buffer } = await createQuestionPaperWorkbook(paper);
  triggerFileDownload(buffer, filename);
}

/**
 * Downloads student list excel
 */
export async function downloadStudentListExcel(students, filename = 'Student_List_Standard.xlsx') {
  const { buffer } = await createStudentListWorkbook(students);
  triggerFileDownload(buffer, filename);
}

