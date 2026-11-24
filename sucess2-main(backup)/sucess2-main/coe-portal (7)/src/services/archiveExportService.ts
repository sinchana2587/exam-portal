import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from 'docx';
import {
  ArchivedQuestionSetData,
  ArchivedQuestionItem,
  ArchivedAnswerKeyItem,
} from '../types/examination';

function triggerBrowserDownload(blob: Blob, filename: string): void {
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
 * Exports the complete archived question set and confidential answer key as a genuine
 * multi-sheet Excel (.xlsx) workbook using ExcelJS.
 *
 * Sheet 1: EXAMINATION INFORMATION (Institutional metadata, session details, and security notices)
 * Sheet 2: COMPLETE QUESTION SET (All questions, modules, original question IDs, options, answer keys, marks)
 * Sheet 3: ANSWER KEY (Dedicated official evaluation key with correct option, answer text, and marks)
 */
export async function exportArchivedQuestionSetExcel(
  archiveData: ArchivedQuestionSetData,
  preferredFilename?: string
): Promise<void> {
  const meta = archiveData.metadata || {};
  const questions: ArchivedQuestionItem[] = archiveData.questions || [];
  const answerKey: ArchivedAnswerKeyItem[] = archiveData.answerKey || [];

  const subCode = String(meta.subjectCode || meta.subCode || 'EXAM');
  const setNum = String(meta.paperSetNumber || meta.originalPaperSetNumber || '1');
  const filename = preferredFilename || `${subCode}_Set_${setNum}_Archive.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maharaja Institute of Technology Mysore Examination System';
  workbook.lastModifiedBy = 'COE Office';
  workbook.created = new Date();
  workbook.modified = new Date();

  // -------------------------------------------------------------
  // SHEET 1: EXAMINATION INFORMATION
  // -------------------------------------------------------------
  const s1 = workbook.addWorksheet('EXAMINATION INFORMATION', {
    views: [{ showGridLines: true }],
  });

  s1.columns = [
    { header: '', key: 'prop', width: 32 },
    { header: '', key: 'val', width: 65 },
  ];

  // Header Title Rows
  const titleRow = s1.addRow(['MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE', '']);
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  s1.mergeCells('A1:B1');

  const subTitleRow = s1.addRow([
    'Autonomous Examination Management System — Office of the Controller of Examinations',
    '',
  ]);
  subTitleRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4B5563' } };
  s1.mergeCells('A2:B2');

  const docTypeRow = s1.addRow([
    'ARCHIVED QUESTION SET & STRICTLY CONFIDENTIAL ANSWER KEY',
    '',
  ]);
  docTypeRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } };
  s1.mergeCells('A3:B3');

  s1.addRow([]); // Blank spacer

  const metaHeader = s1.addRow(['METADATA PROPERTY', 'OFFICIAL ARCHIVE RECORD']);
  metaHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  metaHeader.alignment = { vertical: 'middle', horizontal: 'left' };
  metaHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };

  const metaEntries: [string, string][] = [
    ['Institution Name', String(meta.institutionName || 'Maharaja Institute of Technology Mysore')],
    ['Examination Management Portal', String(meta.portalName || 'Autonomous Examination Management System')],
    ['Document Type', String(meta.documentType || 'Archived Question Set & Confidential Answer Key')],
    ['Examination Code', String(meta.examCode || `EXAM-${subCode}`)],
    ['Subject Code', subCode],
    ['Subject Name', String(meta.subjectName || meta.examinationName || 'Semester Examination')],
    ['Department', String(meta.departmentName || meta.departmentCode || 'Computer Science & Engineering')],
    ['Semester', `Semester ${meta.semester || 5}`],
    ['Academic Session', String(meta.academicSession || '2025-2026')],
    ['Examination Date', String(meta.examDate || 'Scheduled Date')],
    ['Sitting Name', String(meta.sittingName || 'Morning Sitting')],
    ['Published Question Set', `Paper Set ${setNum}`],
    ['Question Set Revision', String(meta.questionSetRevision || 'R1')],
    ['Duration (Minutes)', `${meta.durationMinutes || 60} Minutes`],
    ['Maximum Marks', `${meta.totalMarks || 30.00} Marks`],
    ['Passing Minimum', `${meta.passingMarks || 12.00} Marks`],
    ['Assigned Physical Laboratory', String(meta.assignedLab || 'LAB-CSE-01')],
    ['Total Questions Preserved', `${questions.length} Questions`],
    ['Examination Status', String(meta.status || 'COMPLETED')],
    ['Archive Generation Timestamp', String(meta.archiveGeneratedAt || new Date().toISOString())],
    ['Confidentiality Classification', 'STRICTLY CONFIDENTIAL — AUTHORIZED COE / ADMIN ACCESS ONLY'],
  ];

  metaEntries.forEach(([prop, val]) => {
    const row = s1.addRow([prop, val]);
    row.font = { name: 'Calibri', size: 10 };
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F2937' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    row.getCell(1).border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    row.getCell(2).border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });

  // -------------------------------------------------------------
  // SHEET 2: COMPLETE QUESTION SET
  // -------------------------------------------------------------
  const s2 = workbook.addWorksheet('COMPLETE QUESTION SET', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  s2.columns = [
    { header: 'Serial Number', key: 'serialNumber', width: 14 },
    { header: 'Module', key: 'moduleNumber', width: 12 },
    { header: 'Original Question Number', key: 'originalQuestionNumber', width: 22 },
    { header: 'Question', key: 'prompt', width: 50 },
    { header: 'Option A', key: 'optionA', width: 28 },
    { header: 'Option B', key: 'optionB', width: 28 },
    { header: 'Option C', key: 'optionC', width: 28 },
    { header: 'Option D', key: 'optionD', width: 28 },
    { header: 'Correct Answer', key: 'correctAnswer', width: 16 },
    { header: 'Correct Answer Text', key: 'correctAnswerText', width: 32 },
    { header: 'Marks', key: 'marks', width: 12 },
    { header: 'Question Type', key: 'questionType', width: 22 },
  ];

  // Format Header Row
  const s2Header = s2.getRow(1);
  s2Header.height = 28;
  s2Header.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s2Header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  s2Header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1D4ED8' },
  };

  questions.forEach((q) => {
    const row = s2.addRow({
      serialNumber: q.serialNumber,
      moduleNumber: `Module ${q.moduleNumber}`,
      originalQuestionNumber: q.originalQuestionNumber || `Q${q.serialNumber}`,
      prompt: q.prompt,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      correctAnswerText: q.correctAnswerText,
      marks: q.marks || 1.0,
      questionType: q.questionType || 'Multiple Choice (MCQ)',
    });
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell('serialNumber').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('moduleNumber').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('correctAnswer').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('marks').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('correctAnswer').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };

    for (let c = 1; c <= 12; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  });

  s2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: questions.length + 1, column: 12 },
  };

  // -------------------------------------------------------------
  // SHEET 3: ANSWER KEY
  // -------------------------------------------------------------
  const s3 = workbook.addWorksheet('ANSWER KEY', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  s3.columns = [
    { header: 'Question Number', key: 'questionNumber', width: 18 },
    { header: 'Module', key: 'moduleNumber', width: 14 },
    { header: 'Correct Option', key: 'correctOption', width: 16 },
    { header: 'Correct Answer Text', key: 'correctAnswerText', width: 40 },
    { header: 'Marks', key: 'marks', width: 14 },
  ];

  const s3Header = s3.getRow(1);
  s3Header.height = 28;
  s3Header.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  s3Header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  s3Header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' }, // Dark Green for Evaluation Scheme
  };

  const keyItems = answerKey.length > 0 ? answerKey : questions.map(q => ({
    questionNumber: q.serialNumber,
    moduleNumber: q.moduleNumber,
    correctOption: q.correctAnswer,
    correctAnswerText: q.correctAnswerText,
    marks: q.marks || 1.0,
  }));

  keyItems.forEach((ak) => {
    const row = s3.addRow({
      questionNumber: `Question ${ak.questionNumber}`,
      moduleNumber: `Module ${ak.moduleNumber}`,
      correctOption: ak.correctOption,
      correctAnswerText: ak.correctAnswerText,
      marks: ak.marks || 1.0,
    });
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell('questionNumber').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('moduleNumber').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('correctOption').alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell('correctOption').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } };
    row.getCell('marks').alignment = { vertical: 'top', horizontal: 'center' };

    for (let c = 1; c <= 5; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  });

  s3.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: keyItems.length + 1, column: 5 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBrowserDownload(blob, filename);
}

/**
 * Exports the complete archived question set and confidential answer key as a formatted
 * Word document (.docx) using docx library.
 */
export async function exportArchivedQuestionSetDocx(
  archiveData: ArchivedQuestionSetData,
  preferredFilename?: string
): Promise<void> {
  const meta = archiveData.metadata || {};
  const questions: ArchivedQuestionItem[] = archiveData.questions || [];
  const answerKey: ArchivedAnswerKeyItem[] = archiveData.answerKey || [];

  const subCode = String(meta.subjectCode || meta.subCode || 'EXAM');
  const setNum = String(meta.paperSetNumber || meta.originalPaperSetNumber || '1');
  const subName = String(meta.subjectName || meta.examinationName || 'Semester Examination');
  const filename = preferredFilename || `${subCode}_Set_${setNum}_Archive.docx`;

  const docChildren: any[] = [];

  // Header Title
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE',
          bold: true,
          size: 28, // 14pt
          color: '1E3A8A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Autonomous Examination Management System — Office of the Controller of Examinations',
          italics: true,
          size: 20, // 10pt
          color: '4B5563',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `ARCHIVED QUESTION PAPER — SET ${setNum} : ${subCode} (${subName})`,
          bold: true,
          size: 24, // 12pt
          color: '111827',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Duration: ${meta.durationMinutes || 60} Minutes   |   Maximum Marks: ${meta.totalMarks || 30.00}   |   Semester: ${meta.semester || 5}   |   Date: ${meta.examDate || 'Scheduled Date'}`,
          size: 18, // 9pt
          color: '374151',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'CONFIDENTIAL ARCHIVE RECORD — AUTHORIZED COE / ADMIN USE ONLY',
          bold: true,
          size: 16, // 8pt
          color: 'DC2626',
        }),
      ],
    }),
    new Paragraph({ text: '' }) // Blank line
  );

  // Questions Section
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: 'SECTION A: EXAMINATION QUESTIONS',
          bold: true,
          size: 22,
          color: '1E40AF',
        }),
      ],
    })
  );

  questions.forEach((q) => {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Q${q.serialNumber}. [Module ${q.moduleNumber}] `,
            bold: true,
            size: 20,
            color: '1F2937',
          }),
          new TextRun({
            text: q.prompt,
            size: 20,
            color: '111827',
          }),
        ],
        spacing: { before: 120, after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `    A) ${q.optionA || '—'}        B) ${q.optionB || '—'}`, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `    C) ${q.optionC || '—'}        D) ${q.optionD || '—'}`, size: 18 }),
        ],
        spacing: { after: 120 },
      })
    );
  });

  // Section B: Confidential Answer Key Table
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: 'SECTION B: OFFICIAL ANSWER KEY & EVALUATION SCHEME',
          bold: true,
          size: 22,
          color: '047857',
        }),
      ],
      spacing: { before: 240, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'The following evaluation scheme is confidential and permanently linked to this examination sitting.',
          italics: true,
          size: 18,
          color: '4B5563',
        }),
      ],
      spacing: { after: 120 },
    })
  );

  const tableRows: TableRow[] = [];

  // Header row for table
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: 'Q#', alignment: AlignmentType.CENTER })],
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: '047857' },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Module', alignment: AlignmentType.CENTER })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { fill: '047857' },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Correct Option', alignment: AlignmentType.CENTER })],
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: '047857' },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Correct Answer Text', alignment: AlignmentType.LEFT })],
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { fill: '047857' },
        }),
        new TableCell({
          children: [new Paragraph({ text: 'Marks', alignment: AlignmentType.CENTER })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { fill: '047857' },
        }),
      ],
    })
  );

  const keyItems = answerKey.length > 0 ? answerKey : questions.map(q => ({
    questionNumber: q.serialNumber,
    moduleNumber: q.moduleNumber,
    correctOption: q.correctAnswer,
    correctAnswerText: q.correctAnswerText,
    marks: q.marks || 1.0,
  }));

  keyItems.forEach((ak) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: String(ak.questionNumber), alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            children: [new Paragraph({ text: `Module ${ak.moduleNumber}`, alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            children: [new Paragraph({ text: ak.correctOption, alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            children: [new Paragraph({ text: ak.correctAnswerText })],
          }),
          new TableCell({
            children: [new Paragraph({ text: String(ak.marks || 1.0), alignment: AlignmentType.CENTER })],
          }),
        ],
      })
    );
  });

  const answerTable = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  docChildren.push(answerTable);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBrowserDownload(blob, filename);
}
