import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const samplesDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'protick_data', 'sample_documents')
  : path.resolve(__dirname, '../data/sample_documents');

const sampleDefinitions = [
  { id: 1, name: 'Digitally generated PDF with selectable text', filename: '01_digital_question_paper_3modules.pdf', type: 'question_paper' },
  { id: 2, name: 'Scanned PDF simulation', filename: '02_scanned_question_paper.pdf', type: 'question_paper' },
  { id: 3, name: 'PDF containing code snippets', filename: '03_code_snippets_paper.pdf', type: 'question_paper' },
  { id: 4, name: 'PDF containing diagrams', filename: '04_diagram_question_paper.pdf', type: 'question_paper' },
  { id: 5, name: 'PDF with images inside answer options', filename: '05_images_in_options_paper.pdf', type: 'question_paper' },
  { id: 6, name: 'PDF with dynamic 8 modules', filename: '06_dynamic_8_modules_paper.pdf', type: 'question_paper' },
  { id: 7, name: 'PDF with inconsistent question numbering', filename: '07_inconsistent_numbering_paper.pdf', type: 'question_paper' },
  { id: 8, name: 'Student list in Excel (.xlsx)', filename: '08_student_list_standard.xlsx', type: 'student_list' },
  { id: 9, name: 'Student list in PDF', filename: '09_student_list_table.pdf', type: 'student_list' },
  { id: 10, name: 'Student list with different column arrangements & duplicates', filename: '10_student_list_messy_headers.xlsx', type: 'student_list' }
];

/** Return the checked-in sample files without regenerating or overwriting them. */
export async function generateAllSampleDocuments() {
  const missing = sampleDefinitions
    .filter(sample => !fs.existsSync(path.join(samplesDir, sample.filename)))
    .map(sample => sample.filename);

  if (missing.length > 0) {
    throw new Error(`Sample documents are missing: ${missing.join(', ')}`);
  }

  return sampleDefinitions.map(sample => ({
    ...sample,
    path: path.join(samplesDir, sample.filename)
  }));
}
