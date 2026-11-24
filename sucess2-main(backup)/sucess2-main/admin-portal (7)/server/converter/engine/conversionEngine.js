import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { validateFile } from './fileValidator.js';
import { extractFromPdf } from './extractors/pdfExtractor.js';
import { extractWithOcr, extractPdfWithOcr } from './extractors/ocrExtractor.js';
import { extractFromDocx } from './extractors/docxExtractor.js';
import { extractFromExcel } from './extractors/excelExtractor.js';
import { parseQuestionPaper, parseQuestionPaperRows } from './parsers/questionPaperParser.js';
import { parseStudentList } from './parsers/studentListParser.js';
import { extractStudentsFromTextLines } from './smartRoutingEngine.js';
import { db } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = !!process.env.VERCEL;
const ORIGINALS_DIR = isVercel
  ? path.join(os.tmpdir(), 'protick_uploads', 'originals')
  : path.resolve(__dirname, '../../uploads/originals');

if (!fs.existsSync(ORIGINALS_DIR)) {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
}

export function associateVectorImagesWithQuestions(images, ocrPages) {
  const imagesByPage = new Map();
  for (const image of images.filter(item => item.vectorFigure && item.pageNumber)) {
    const group = imagesByPage.get(image.pageNumber) || [];
    group.push(image);
    imagesByPage.set(image.pageNumber, group);
  }

  let currentModuleNumber = 1;
  for (const page of [...(ocrPages || [])].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const pageImages = imagesByPage.get(page.pageNumber) || [];
    const lines = [...(page.lines || [])].sort((a, b) => (a.bbox?.y0 ?? 0) - (b.bbox?.y0 ?? 0));
    const lastLineBefore = (image) => {
      let questionNumber = null;
      let moduleNumber = currentModuleNumber;
      for (const line of lines) {
        if (!line.bbox || line.bbox.y0 / image.pagePixelHeight > image.yRatio) break;
        const moduleMatch = line.text.match(/\b(?:MODULE|UNIT|PART|SECTION)\s*[-:]?\s*(\d+|[IVX]+)\b/i);
        if (moduleMatch) {
          const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
          moduleNumber = Number(moduleMatch[1]) || roman[moduleMatch[1].toUpperCase()] || moduleNumber;
        }
        const questionMatch = line.text.match(/^\s*(?:Q(?:UESTION)?\s*)?(\d{1,3})\s*[.)\-:]\s+\S/i);
        if (questionMatch) questionNumber = Number(questionMatch[1]);
      }
      return { moduleNumber, questionNumber };
    };

    for (const image of pageImages) {
      Object.assign(image, lastLineBefore(image));
    }
    // Carry the module forward from recognized section headings on this page.
    for (const line of lines) {
      const moduleMatch = line.text.match(/\b(?:MODULE|UNIT|PART|SECTION)\s*[-:]?\s*(\d+|[IVX]+)\b/i);
      if (!moduleMatch) continue;
      const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
      currentModuleNumber = Number(moduleMatch[1]) || roman[moduleMatch[1].toUpperCase()] || currentModuleNumber;
    }
  }
}

export async function processDocumentConversion(file, options = {}) {
  const {
    documentType, // 'question_paper' | 'student_list'
    department = 'CSE',
    semester = null,
    subjectName = '',
    subjectCode = '',
    uploadedBy = 'Department Lecturer'
  } = options;

  const recordId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stepLogs = [];

  const logStep = (stepNumber, title, details = {}) => {
    stepLogs.push({
      step: stepNumber,
      title,
      timestamp: new Date().toISOString(),
      ...details
    });
  };

  try {
    // Step 1: Receive uploaded file
    logStep(1, 'Receive uploaded file', { filename: file.originalname, size: file.size });

    // Step 2: Validate file type and size
    logStep(2, 'Validate file type and size');
    const validation = validateFile(file, documentType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Step 3: Store original document securely
    logStep(3, 'Store the original document securely');
    const storedFileName = `${recordId}_${path.basename(file.originalname)}`;
    const destinationPath = path.join(ORIGINALS_DIR, storedFileName);
    fs.copyFileSync(file.path, destinationPath);

    // Initial record in DB
    const record = {
      id: recordId,
      department,
      originalFilename: file.originalname,
      storedFilename: storedFileName,
      originalFilePath: destinationPath,
      documentType,
      fileFormat: validation.fileFormat,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      uploadedBy,
      status: 'processing',
      errorDetails: null,
      metadata: { semester, subjectName, subjectCode, department },
      stepLogs,
      exportHistory: []
    };
    db.saveConversionRecord(record);

    // Step 4: Extract text, tables and images
    logStep(4, 'Extract text, tables, and images');
    let rawText = '';
    let extractedImages = [];
    let tableRows = [];
    let isScanned = false;

    if (validation.fileFormat === 'pdf') {
      const pdfResult = await extractFromPdf(destinationPath);
      rawText = pdfResult.text;
      extractedImages = pdfResult.images || [];
      isScanned = pdfResult.isScannedLikely;
      const hasVectorFigures = extractedImages.some(image => image.vectorFigure);

      // OCR also supplies page coordinates for mapping vector figures to their
      // question, even when the PDF already has a readable text layer.
      if (isScanned || hasVectorFigures) {
        logStep(5, isScanned ? 'Perform OCR on scanned PDF / image-only content' : 'Locate vector figures with OCR page coordinates');
        const vectorFigurePages = !isScanned && hasVectorFigures
          ? [...new Set(extractedImages.filter(image => image.vectorFigure).map(image => image.pageNumber).filter(Boolean))]
          : null;
        const ocrResult = await extractPdfWithOcr(destinationPath, pdfResult.numPages, 'eng', vectorFigurePages);
        if (ocrResult.success && ocrResult.text.trim()) {
          associateVectorImagesWithQuestions(extractedImages, ocrResult.pages);
          if (isScanned) rawText = ocrResult.text;
        } else if (!rawText || !rawText.trim()) {
          throw new Error(`This PDF appears to be scanned, but OCR could not read it: ${ocrResult.error || 'no text was recognized'}`);
        }
      } else {
        logStep(5, 'OCR not required (digital text stream detected)');
      }
    } else if (validation.fileFormat === 'docx') {
      const docxResult = await extractFromDocx(destinationPath);
      rawText = docxResult.textWithImageMarkers || docxResult.text;
      extractedImages = docxResult.images || [];
      logStep(5, 'DOCX media extraction complete');
    } else if (['xlsx', 'xls', 'csv'].includes(validation.fileFormat)) {
      const excelResult = await extractFromExcel(destinationPath);
      tableRows = excelResult.primaryRows || [];
      extractedImages = excelResult.images || [];
      logStep(5, 'Spreadsheet tabular matrix and embedded images extracted', {
        rows: tableRows.length,
        embeddedImages: extractedImages.length
      });
    } else if (validation.fileFormat === 'txt') {
      rawText = fs.readFileSync(destinationPath, 'utf8');
      logStep(5, 'Plain text extraction complete');
    } else if (['png', 'jpg', 'jpeg'].includes(validation.fileFormat)) {
      const ocrResult = await extractWithOcr(destinationPath);
      if (!ocrResult.success || !ocrResult.text.trim()) {
        throw new Error(`OCR could not read the uploaded image: ${ocrResult.error || 'no text was recognized'}`);
      }
      rawText = ocrResult.text;
      logStep(5, 'OCR extraction from uploaded image complete', { confidence: ocrResult.confidence });
    }

    // Step 6: Identify document type
    logStep(6, 'Identify and confirm document type', { documentType });

    // Step 7: Detect and map relevant fields
    logStep(7, 'Detect and map relevant fields to reference schema');

    let convertedData = null;

    if (documentType === 'question_paper') {
      // Step 8: Transform into configured reference template
      logStep(8, 'Transform into Question Paper Reference Template with dynamic modules');
      const parseOptions = {
        semester,
        subjectName,
        subjectCode,
        department
      };
      const parsedPaper = tableRows.length > 0
        ? parseQuestionPaperRows(tableRows, parseOptions)
        : parseQuestionPaper(rawText, extractedImages, parseOptions);

      if (parsedPaper.verification.totalQuestions === 0) {
        throw new Error('No questions could be identified. Use a document with numbered questions and clearly marked A–D options, or a spreadsheet with Question, Option A–D, and Answer columns.');
      }

      parsedPaper.templateFields = db.getTemplates().questionPaper.standardFields;

      // Step 9: Run validation
      logStep(9, 'Run Question Paper Validation Checks', parsedPaper.verification);

      convertedData = parsedPaper;
      db.saveQuestionPaper(recordId, parsedPaper);

      record.metadata = {
        ...record.metadata,
        ...parsedPaper.metadata
      };
      record.stats = {
        totalItems: parsedPaper.verification.totalQuestions,
        confidenceScore: parsedPaper.verification.confidenceScore,
        missingQuestions: parsedPaper.verification.missingQuestionText,
        missingOptions: parsedPaper.verification.missingOptions,
        missingAnswers: parsedPaper.verification.missingAnswers
      };
    } else {
      // Student List Converter
      logStep(8, 'Transform into Student List Reference Template');
      
      // If student list was uploaded as PDF or DOCX, parse lines into table rows
      if (['pdf', 'docx', 'doc'].includes(validation.fileFormat) && tableRows.length === 0) {
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const parsedRows = [];
        let rowCount = 0;
        let lastStandaloneNum = null;

        lines.forEach((line) => {
          // Broad USN pattern: VTU (e.g., 4XX23CS001, 4MT21IS002) or College ID (e.g., MIT24CS001, 1MS20EC015)
          const usnMatch = line.match(/\b([0-9][A-Z]{2}\s*[0-9]{2}\s*[A-Z]{2,4}\s*[0-9]{3}|[A-Z]{3}\s*[0-9]{2}\s*[A-Z]{2,4}\s*[0-9]{3})\b/i);
          if (!usnMatch) {
            const numMatch = line.match(/^\s*(\d{1,4})\s*$/);
            if (numMatch) lastStandaloneNum = parseInt(numMatch[1], 10);
            return;
          }

          rowCount++;
          const usn = usnMatch[1].replace(/\s+/g, '').toUpperCase();

          // DOB extraction: DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
          const dobMatch = line.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/);
          const dob = dobMatch ? dobMatch[1].replace(/\//g, '-') : '';

          // Serial number extraction
          const slMatch = line.match(/^\s*(\d{1,4})\b/);
          const serialNumber = slMatch ? parseInt(slMatch[1], 10) : (lastStandaloneNum || rowCount);
          lastStandaloneNum = null;

          const lineWithoutSl = line.replace(/^\s*\d+\s*/, '');

          // Room / Hall / Seat extraction
          const roomMatch = lineWithoutSl.match(/(?:Room|Hall|Lab|Seat)\s*[:\-#]?\s*([A-Za-z0-9\-\s]{2,15})(?=[,;|]|$)/i) ||
                            lineWithoutSl.match(/\b(L[1-9]-\d{2}|Room\s*\d+|Hall\s*[A-Z0-9]+|Lab\s*\d+)\b/i);
          const room = roomMatch ? roomMatch[1].trim() : '';

          // Branch / Department extraction
          const deptMatch = lineWithoutSl.match(/\b(CSE\s*AI|AI\s*&?\s*ML|Information\s*Science|Internet\s*of\s*Things|IoT|CSBS|CSDS|Computer\s*Engineering|Civil|Mechanical|Electronics|ECE|ISE|CSE|ME|CV)\b/i);
          const rawDept = deptMatch ? deptMatch[1] : department;

          // Section extraction
          const secMatch = lineWithoutSl.match(/\bSec(?:tion)?\s*[:\-]?\s*([A-D])\b/i) ||
                           lineWithoutSl.match(/(?:^|\s{2,}|[,|;])([A-D])(?:\s{2,}|[,|;]|$)/);
          const section = secMatch ? secMatch[1].toUpperCase() : 'A';

          // Semester extraction
          const semMatch = lineWithoutSl.match(/\b(?:Sem(?:ester)?)\s*[:\-]?\s*([1-8])\b/i) ||
                           lineWithoutSl.match(/\b([1-8])(?:th|st|nd|rd)\s*Sem/i) ||
                           lineWithoutSl.match(/(?:^|\s{2,}|[,|;])([1-8])(?:\s{2,}|[,|;]|$)/);
          const sem = semMatch ? parseInt(semMatch[1], 10) : (semester || 5);

          // Name extraction: split line by delimiters, find the longest alphabetic segment that is not USN, DOB, or Room
          const tokens = line.split(/[\t,;|]|\s{2,}/).map(s => s.trim()).filter(Boolean);
          let candidateName = '';

          for (const token of tokens) {
            if (token === usn || (dob && token.includes(dob)) || /^\d+$/.test(token)) continue;
            if (/^(usn|dob|name|sec|section|sem|semester|room|hall|seat|dept|sl|sno)/i.test(token)) continue;
            if (secMatch && token === secMatch[1]) continue;
            // Name should contain at least 2 letters
            if (/^[A-Za-z\s.]{3,40}$/.test(token) && token.length > candidateName.length) {
              candidateName = token;
            }
          }

          if (!candidateName) {
            // Fallback from raw line after removing USN, DOB, room, and leading serial number
            let cleanLine = line
              .replace(usnMatch[0], '')
              .replace(dobMatch ? dobMatch[0] : '', '')
              .replace(roomMatch ? roomMatch[0] : '')
              .replace(/^\s*\d+\s*/, '')
              .trim();

            if (secMatch && secMatch[1]) {
              cleanLine = cleanLine.replace(new RegExp(`\\b${secMatch[1]}\\b`, 'g'), '').trim();
            }

            const words = cleanLine.split(/\s+/).filter(w => /^[A-Za-z.]{1,}$/.test(w) && !/^(usn|dob|sl|sno|si|no|sec|section|sem|semester|dept|department|room|hall|seat|name|student)$/i.test(w));
            candidateName = words.join(' ') || 'Student';
          }

          parsedRows.push({
            'Serial Number': serialNumber,
            'USN': usn,
            'Student Name': candidateName,
            'DOB': dob,
            'Section': section,
            'Semester': sem,
            'Department': rawDept,
            'Room Number': room
          });
        });

        tableRows = parsedRows;
      }

      let parsedStudents = parseStudentList(tableRows, { department, semester });

      if (parsedStudents.records.length === 0 && rawText.trim()) {
        const fallbackStudents = extractStudentsFromTextLines(rawText.split(/\r?\n/));
        if (fallbackStudents.length > 0) {
          const fallbackRows = fallbackStudents.map((st, i) => ({
            'Serial Number': st.serialNumber || (i + 1),
            'USN': st.usn,
            'Student Name': st.studentName,
            'DOB': st.dateOfBirth,
            'Section': 'A',
            'Semester': semester || 5,
            'Department': department || 'CSE AI',
            'Room Number': ''
          }));
          parsedStudents = parseStudentList(fallbackRows, { department, semester });
        }
      }

      // Step 9: Run validation
      logStep(9, 'Run Student List Validation Checks', parsedStudents.summary);

      convertedData = parsedStudents;
      db.saveStudentList(recordId, parsedStudents);

      record.metadata = {
        ...record.metadata,
        totalRecords: parsedStudents.records.length,
        duplicateCount: parsedStudents.duplicateRecords.length
      };
      record.stats = {
        totalItems: parsedStudents.records.length,
        validCount: parsedStudents.summary.validCount,
        duplicateCount: parsedStudents.summary.duplicateUsnCount,
        confidenceScore: parsedStudents.summary.confidenceScore
      };
    }

    // Step 10: Ready for review interface
    logStep(10, 'Display in Review & Verification Interface');
    record.status = 'awaiting_verification';
    record.stepLogs = stepLogs;
    db.saveConversionRecord(record);

    db.addAuditLog({
      user: uploadedBy,
      role: 'Department User',
      department,
      action: 'DOCUMENT_UPLOADED_AND_CONVERTED',
      entityType: documentType,
      entityId: recordId,
      details: {
        filename: file.originalname,
        format: validation.fileFormat,
        status: record.status
      }
    });

    return {
      success: true,
      recordId,
      record,
      data: convertedData
    };
  } catch (err) {
    console.error('[Conversion Engine Error]', err);
    logStep(0, 'Extraction Failure', { error: err.message });

    const failedRecord = {
      id: recordId,
      department,
      originalFilename: file?.originalname || 'unknown',
      documentType,
      status: 'error',
      errorDetails: err.message,
      uploadTime: new Date().toISOString(),
      uploadedBy,
      stepLogs
    };
    db.saveConversionRecord(failedRecord);

    return {
      success: false,
      recordId,
      error: err.message
    };
  }
}

