import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, '../../../uploads/images');
const TEMPLATES_DIR = path.resolve(__dirname, '../../../../client/public/templates');

export const QUESTION_COLUMNS = [
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

export const STUDENT_COLUMNS = [
  'Sl.no.',
  'Student Name',
  'USN',
  'Date of Birth'
];

/**
 * Builds an Excel workbook for Questions aligned to q_template.xlsx (Sheet1 & Module sheets)
 */
export async function exportQuestionOutputToExcel(questionRows = []) {
  const templatePath = path.join(TEMPLATES_DIR, 'q_template.xlsx');
  const workbook = new ExcelJS.Workbook();

  let hasTemplate = false;
  if (fs.existsSync(templatePath)) {
    try {
      await workbook.xlsx.readFile(templatePath);
      hasTemplate = true;
    } catch (_) {
      hasTemplate = false;
    }
  }

  // Ensure Sheet1 exists as primary output per specification
  let sheet1 = workbook.getWorksheet('Sheet1');
  if (!sheet1) {
    sheet1 = workbook.addWorksheet('Sheet1', { index: 0 });
    sheet1.columns = QUESTION_COLUMNS.map(col => ({
      header: col,
      key: col,
      width: col.includes('Questions') ? 45 : (col.includes('img') || col.includes('image')) ? 20 : 18
    }));
    // Style header row
    const headerRow = sheet1.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF101B46' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  } else {
    // Clear any dummy template data below row 1
    const totalRows = sheet1.rowCount;
    if (totalRows > 1) {
      sheet1.spliceRows(2, totalRows - 1);
    }
  }

  // Helper to add rows and embed images
  const populateWorksheet = async (ws, rows) => {
    for (const q of rows) {
      const rowValues = QUESTION_COLUMNS.map(col => q[col] ?? '');
      const newRow = ws.addRow(rowValues);
      newRow.height = 45;
      newRow.alignment = { vertical: 'middle', wrapText: true };

      // Embed images if local file exists
      const imgHeaders = [
        { key: 'Question image', colIdx: 3 },
        { key: 'option A img', colIdx: 5 },
        { key: 'option B img', colIdx: 7 },
        { key: 'option C img', colIdx: 9 },
        { key: 'option D  img', colIdx: 11 }
      ];

      for (const item of imgHeaders) {
        const imgVal = q[item.key];
        if (!imgVal) continue;

        let localPath = null;
        if (imgVal.startsWith('/uploads/images/')) {
          localPath = path.join(IMAGES_DIR, path.basename(imgVal));
        } else if (fs.existsSync(imgVal)) {
          localPath = imgVal;
        } else if (fs.existsSync(path.join(IMAGES_DIR, imgVal))) {
          localPath = path.join(IMAGES_DIR, imgVal);
        }

        if (localPath && fs.existsSync(localPath)) {
          try {
            const ext = path.extname(localPath).slice(1).toLowerCase().replace(/^jpg$/, 'jpeg');
            const imgId = workbook.addImage({
              filename: localPath,
              extension: ext === 'png' ? 'png' : 'jpeg'
            });
            ws.addImage(imgId, {
              tl: { col: item.colIdx - 0.9, row: newRow.number - 0.85 },
              ext: { width: 80, height: 40 }
            });
          } catch (_) { }
        }
      }
    }
  };

  // Populate Sheet1 with all sequential questions
  await populateWorksheet(sheet1, questionRows);

  // Also populate Module sheets if module groupings exist
  const moduleGroups = new Map();
  questionRows.forEach(q => {
    const modNum = q.moduleNumber || 1;
    if (!moduleGroups.has(modNum)) moduleGroups.set(modNum, []);
    moduleGroups.get(modNum).push(q);
  });

  if (moduleGroups.size > 1 || !hasTemplate) {
    for (const [modNum, modRows] of moduleGroups.entries()) {
      const sheetName = `Module ${modNum}`;
      let modSheet = workbook.getWorksheet(sheetName);
      if (!modSheet) {
        modSheet = workbook.addWorksheet(sheetName);
        modSheet.columns = sheet1.columns.map(c => ({ header: c.header, key: c.key, width: c.width }));
        const hRow = modSheet.getRow(1);
        hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101B46' } };
      } else {
        const rowCount = modSheet.rowCount;
        if (rowCount > 1) modSheet.spliceRows(2, rowCount - 1);
      }
      await populateWorksheet(modSheet, modRows);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Builds an Excel workbook for Students aligned to std_template.xlsx (Sheet1)
 */
export async function exportStudentOutputToExcel(studentRows = []) {
  const templatePath = path.join(TEMPLATES_DIR, 'std_template.xlsx');
  const workbook = new ExcelJS.Workbook();

  if (fs.existsSync(templatePath)) {
    try {
      await workbook.xlsx.readFile(templatePath);
    } catch (_) { }
  }

  let sheet1 = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
  if (!sheet1) {
    sheet1 = workbook.addWorksheet('Sheet1');
    sheet1.columns = [
      { header: 'Sl.no.', key: 'slno', width: 10 },
      { header: 'Student Name', key: 'studentName', width: 35 },
      { header: 'USN', key: 'usn', width: 20 },
      { header: 'Date of Birth', key: 'dateOfBirth', width: 18 }
    ];
    const headerRow = sheet1.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1263F5' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  } else {
    // Clear any template sample rows below row 1
    const totalRows = sheet1.rowCount;
    if (totalRows > 1) {
      sheet1.spliceRows(2, totalRows - 1);
    }
  }

  // Populate student records
  studentRows.forEach((st, idx) => {
    const slNo = st['Sl.no.'] ?? (st.serialNumber || idx + 1);
    const name = st['Student Name'] ?? (st.studentName || '');
    const usn = (st['USN'] ?? (st.usn || '')).toUpperCase();
    const dob = st['Date of Birth'] ?? (st.dateOfBirth || st.dob || '');

    const row = sheet1.addRow([slNo, name, usn, dob]);
    row.height = 24;
    row.alignment = { vertical: 'middle' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
