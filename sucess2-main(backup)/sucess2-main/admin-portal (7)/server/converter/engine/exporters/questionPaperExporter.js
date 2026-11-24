import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidateTemplatePaths = [
  path.resolve(__dirname, '../../../../public/templates/q_template.xlsx'),
  path.resolve(__dirname, '../../../public/templates/q_template.xlsx'),
  path.resolve(__dirname, '../../../../dist/templates/q_template.xlsx'),
  path.resolve(process.cwd(), 'admin-portal (7)/public/templates/q_template.xlsx'),
  path.resolve(process.cwd(), 'public/templates/q_template.xlsx'),
  path.resolve(__dirname, '../../../../client/public/templates/q_template.xlsx')
];
const QUESTION_TEMPLATE_PATH = candidateTemplatePaths.find(p => fs.existsSync(p)) || candidateTemplatePaths[0];
const IMAGE_DIR = path.resolve(__dirname, '../../../uploads/images');

function loadImageSource(source) {
  const dataUrl = String(source || '').match(/^data:image\/(png|jpe?g);base64,([\s\S]+)$/i);
  let buffer;
  let extension;

  if (dataUrl) {
    extension = dataUrl[1].toLowerCase().replace('jpg', 'jpeg');
    buffer = Buffer.from(dataUrl[2], 'base64');
  } else {
    const sourcePath = String(source || '').split(/[?#]/, 1)[0];
    let filename = path.basename(sourcePath);
    try { filename = decodeURIComponent(filename); } catch (_) { /* keep literal filename */ }
    const imagePath = path.resolve(IMAGE_DIR, filename);
    if (!imagePath.startsWith(`${IMAGE_DIR}${path.sep}`)) {
      throw new Error('Image path is outside the image upload directory.');
    }
    buffer = fs.readFileSync(imagePath);
    extension = path.extname(filename).slice(1).toLowerCase().replace('jpg', 'jpeg');
  }

  if (buffer.length < 8) throw new Error('Image file is empty or truncated.');
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString() === 'PNG') extension = 'png';
  else if (buffer[0] === 0xff && buffer[1] === 0xd8) extension = 'jpeg';
  else throw new Error('Image must be a valid PNG or JPEG file to embed in Excel.');

  return { buffer, extension };
}

/**
 * Standard Question Paper Exporter
 * Generates:
 * 1. Standardized Excel (.xlsx) with module separation & standard columns
 * 2. Structured JSON for ProTick examination portal integration
 * 3. Standard CSV
 */

export async function exportQuestionPaperToExcel(paperData) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(QUESTION_TEMPLATE_PATH);
  const normalize = header => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const templateSheet = workbook.getWorksheet('Module 1') || workbook.worksheets[0];
  const getModuleSheet = (moduleNumber) => {
    const name = `Module ${moduleNumber}`;
    const existing = workbook.getWorksheet(name);
    if (existing) return existing;
    const worksheet = workbook.addWorksheet(name);
    worksheet.columns = templateSheet.columns.map(column => ({
      width: column.width,
      hidden: column.hidden,
      outlineLevel: column.outlineLevel,
      style: column.style
    }));
    const templateHeader = templateSheet.getRow(1);
    const header = worksheet.getRow(1);
    header.height = templateHeader.height;
    templateHeader.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const target = header.getCell(columnNumber);
      target.value = cell.value;
      target.style = structuredClone(cell.style);
    });
    return worksheet;
  };

  for (const [moduleIndex, module] of (paperData.modules || []).entries()) {
    const moduleNumber = Number(module.moduleNumber) || moduleIndex + 1;
    const worksheet = getModuleSheet(moduleNumber);
    const headers = worksheet.getRow(1).values.slice(1).map(header => String(header || ''));
    const imageColumns = new Map(headers.map((header, index) => [normalize(header), index]));

    for (const [index, question] of (module.questions || []).entries()) {
      const rowValues = {
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
      const row = worksheet.addRow(headers.map(header => rowValues[normalize(header)] ?? ''));
      row.height = 55;
      row.alignment = { vertical: 'middle', wrapText: true };

      const imageValues = {
        questionimage: question.questionImage,
        optionaimg: question.options?.A?.image,
        optionbimg: question.options?.B?.image,
        optioncimg: question.options?.C?.image,
        optiondimg: question.options?.D?.image
      };
      for (const [header, source] of Object.entries(imageValues)) {
        const column = imageColumns.get(header);
        if (column === undefined || !source) continue;
        try {
          const { buffer, extension } = loadImageSource(source);
          const imageId = workbook.addImage({ buffer, extension });
          worksheet.addImage(imageId, {
            tl: { col: column + 0.1, row: row.number - 0.9 },
            ext: { width: header === 'questionimage' ? 82 : 72, height: 42 }
          });
          row.getCell(column + 1).value = '';
        } catch (err) {
          throw new Error(`Could not embed ${header} for question ${question.questionNumber || index + 1}: ${err.message}`);
        }
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function exportQuestionPaperToCsv(paperData) {
  const rows = [];
  const meta = paperData.metadata || {};
  const modules = paperData.modules || [];
  const totalModules = modules.length;

  modules.forEach(mod => {
    (mod.questions || []).forEach(q => {
      rows.push({
        'Semester': meta.semester || '',
        'Subject Name': meta.subjectName || '',
        'Subject Code': meta.subjectCode || '',
        'Total Number of Modules': totalModules,
        'Module Number': mod.moduleNumber,
        'Question Number': q.questionNumber,
        'Question Text': (q.questionText || '').replace(/\r?\n/g, ' '),
        'Question Image': q.questionImage || '',
        'Option A': (q.options?.A?.text || '').replace(/\r?\n/g, ' '),
        'Option A Image': q.options?.A?.image || '',
        'Option B': (q.options?.B?.text || '').replace(/\r?\n/g, ' '),
        'Option B Image': q.options?.B?.image || '',
        'Option C': (q.options?.C?.text || '').replace(/\r?\n/g, ' '),
        'Option C Image': q.options?.C?.image || '',
        'Option D': (q.options?.D?.text || '').replace(/\r?\n/g, ' '),
        'Option D Image': q.options?.D?.image || '',
        'Correct Answer': q.correctAnswer || ''
      });
    });
  });

  const ws = xlsx.utils.json_to_sheet(rows);
  return xlsx.utils.sheet_to_csv(ws);
}

export function exportQuestionPaperToJson(paperData) {
  // Return formatted ProTick Portal integration JSON schema
  const meta = paperData.metadata || {};
  const modules = paperData.modules || [];

  return {
    portal: 'ProTick Examination Portal - Maharaja Institute of Technology Mysore',
    exportTimestamp: new Date().toISOString(),
    course: {
      courseCode: meta.subjectCode || '',
      courseTitle: meta.subjectName || '',
      semester: meta.semester || 1,
      totalModules: modules.length,
      totalQuestions: paperData.verification?.totalQuestions || 0
    },
    modules: modules.map(mod => ({
      moduleNumber: mod.moduleNumber,
      title: mod.title,
      questions: (mod.questions || []).map(q => ({
        id: q.questionId,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        questionImage: q.questionImage || null,
        options: [
          { key: 'A', text: q.options?.A?.text || '', image: q.options?.A?.image || null },
          { key: 'B', text: q.options?.B?.text || '', image: q.options?.B?.image || null },
          { key: 'C', text: q.options?.C?.text || '', image: q.options?.C?.image || null },
          { key: 'D', text: q.options?.D?.text || '', image: q.options?.D?.image || null }
        ],
        correctAnswer: q.correctAnswer || null
      }))
    }))
  };
}

