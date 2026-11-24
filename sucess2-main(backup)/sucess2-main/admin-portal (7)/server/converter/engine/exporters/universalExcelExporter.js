/**
 * Universal Institutional Excel Generator
 *
 * Populates predefined institutional Excel templates and validates output binaries:
 * 1. QUESTION_PAPER: Multi-sheet (Module 1..N), 12 columns, image embedding
 * 2. STUDENT_LIST: 4 locked columns (Sl.no., Student Name, USN, Date of Birth)
 *
 * Validates generated workbooks before returning.
 */

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportQuestionPaperToExcel } from './questionPaperExporter.js';
import { exportStudentListToExcel } from './studentListExporter.js';
import { TEMPLATE_IDS } from '../registry/templateRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../../../../client/public/templates');
const IMAGES_DIR = path.resolve(__dirname, '../../../uploads/images');

/**
 * Validates that an Excel workbook buffer can be parsed back and has expected worksheets
 */
export async function validateWorkbookBuffer(buffer, expectedSheetNames = []) {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Generated workbook buffer is empty.');
  }

  const testWb = new ExcelJS.Workbook();
  await testWb.xlsx.load(buffer);

  if (testWb.worksheets.length === 0) {
    throw new Error('Generated workbook has no worksheets.');
  }

  const existingSheetNames = testWb.worksheets.map(w => w.name);
  if (expectedSheetNames.length > 0) {
    for (const name of expectedSheetNames) {
      if (!existingSheetNames.includes(name)) {
        throw new Error(`Generated workbook is missing expected sheet "${name}".`);
      }
    }
  }

  return {
    valid: true,
    sheetCount: testWb.worksheets.length,
    sheetNames: existingSheetNames,
    byteLength: buffer.byteLength
  };
}

/**
 * Universal Excel Generator Dispatcher
 */
export async function generateInstitutionalWorkbook(templateId, data, options = {}) {
  if (templateId === TEMPLATE_IDS.STUDENT_LIST) {
    const records = Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []);
    const res = await exportStudentListToExcel(records, options);
    const buffer = Buffer.isBuffer(res) ? res : res.buffer;

    // Verify generated workbook
    await validateWorkbookBuffer(buffer, ['Sheet1']);

    return {
      templateId: TEMPLATE_IDS.STUDENT_LIST,
      filename: `${options.filenamePrefix || 'Student_List'}_${Date.now()}.xlsx`,
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      summary: {
        totalRecords: records.length,
        sheets: ['Sheet1'],
        columns: 4
      }
    };
  }

  if (templateId === TEMPLATE_IDS.QUESTION_PAPER) {
    const paperData = data.modules ? data : { modules: data };
    const res = await exportQuestionPaperToExcel(paperData);
    const buffer = Buffer.isBuffer(res) ? res : res.buffer;

    const expectedSheets = (paperData.modules || []).map((m, idx) => `Module ${m.moduleNumber || idx + 1}`);
    await validateWorkbookBuffer(buffer, expectedSheets.slice(0, 1));

    const totalQuestions = (paperData.modules || []).reduce((sum, m) => sum + (m.questions?.length || 0), 0);

    return {
      templateId: TEMPLATE_IDS.QUESTION_PAPER,
      filename: `${options.filenamePrefix || 'Question_Paper'}_${Date.now()}.xlsx`,
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      summary: {
        totalQuestions,
        totalModules: (paperData.modules || []).length,
        sheets: expectedSheets,
        columns: 12
      }
    };
  }

  throw new Error(`Unsupported destination template: ${templateId}`);
}
