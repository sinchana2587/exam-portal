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

async function loadTemplateWorkbook(filename) {
  const response = await fetch(`/templates/${filename}`);
  if (!response.ok) {
    throw new Error(`Could not load the built-in ${filename} workbook template.`);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return workbook;
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

/**
 * Creates and formats the Student List ExcelJS Workbook
 */
export async function createStudentListWorkbook(students) {
  const workbook = await loadTemplateWorkbook('std_template.xlsx');
  const ws = workbook.worksheets[0];
  const headers = ws.getRow(1).values.slice(1).map(header => String(header || ''));
  const valuesByKey = (student, index) => ({
    slno: student.serialNumber || index + 1,
    studentname: student.studentName || '',
    usn: (student.usn || '').toUpperCase(),
    dateofbirth: student.dob || ''
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
