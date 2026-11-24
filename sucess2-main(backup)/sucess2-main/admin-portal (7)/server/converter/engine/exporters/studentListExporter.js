import { normalizeDobToYyyyMmDd } from '../smartRoutingEngine.js';
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidateStudentTemplatePaths = [
  path.resolve(__dirname, '../../../../public/templates/std_template.xlsx'),
  path.resolve(__dirname, '../../../public/templates/std_template.xlsx'),
  path.resolve(__dirname, '../../../../dist/templates/std_template.xlsx'),
  path.resolve(process.cwd(), 'admin-portal (7)/public/templates/std_template.xlsx'),
  path.resolve(process.cwd(), 'public/templates/std_template.xlsx'),
  path.resolve(__dirname, '../../../../client/public/templates/std_template.xlsx')
];
const STUDENT_TEMPLATE_PATH = candidateStudentTemplatePaths.find(p => fs.existsSync(p)) || candidateStudentTemplatePaths[0];

/**
 * Standard Student List Exporter
 * Strictly generates output with the 7 locked standard columns:
 * 1. S.No
 * 2. USN
 * 3. Student Name
 * 4. DOB
 * 5. Section
 * 6. Semester
 * 7. Department
 */

const STANDARD_HEADERS = [
  'S.No',
  'USN',
  'Student Name',
  'DOB',
  'Section',
  'Semester',
  'Department'
];

function formatRecordsToStandardRows(records) {
  return records.map((r, idx) => ({
    'S.No': r.serialNumber || (idx + 1),
    'USN': (r.usn || '').toUpperCase(),
    'Student Name': r.studentName || '',
    'DOB': r.dob || 'Missing DOB',
    'Section': (r.section || 'A').toUpperCase(),
    'Semester': r.semester || 1,
    'Department': r.department || ''
  }));
}

export async function exportStudentListToExcel(records, meta = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(STUDENT_TEMPLATE_PATH);
  const worksheet = workbook.worksheets[0];
  const headers = worksheet.getRow(1).values.slice(1).map(header => String(header || ''));
  const normalize = header => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  records.forEach((record, index) => {
    const values = {
      slno: record.serialNumber || index + 1,
      studentname: record.studentName || '',
      usn: (record.usn || '').toUpperCase(),
      dateofbirth: normalizeDobToYyyyMmDd(record.dateOfBirth || record.dob || record['Date of Birth'] || '')
    };
    const row = worksheet.addRow(headers.map(header => values[normalize(header)] ?? ''));
    row.height = 24;
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function exportStudentListToCsv(records, meta = {}) {
  const rows = formatRecordsToStandardRows(records);
  const ws = xlsx.utils.json_to_sheet(rows, { header: STANDARD_HEADERS });
  return xlsx.utils.sheet_to_csv(ws);
}

export function exportStudentListToJson(records, meta = {}) {
  return {
    portal: 'Student Examination Portal - Maharaja Institute of Technology Mysore',
    documentType: 'student_list',
    semester: meta.semester || 1,
    exportTimestamp: new Date().toISOString(),
    totalStudents: records.length,
    columns: STANDARD_HEADERS,
    students: records.map((r, idx) => ({
      serialNumber: r.serialNumber || (idx + 1),
      usn: (r.usn || '').toUpperCase(),
      studentName: r.studentName || '',
      dob: r.dob || 'Missing DOB',
      section: (r.section || 'A').toUpperCase(),
      semester: Number(r.semester) || 1,
      department: r.department || ''
    }))
  };
}
