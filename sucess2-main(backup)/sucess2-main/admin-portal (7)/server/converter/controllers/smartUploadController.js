import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { processSmartDocumentExtraction } from '../engine/smartRoutingEngine.js';
import { exportQuestionOutputToExcel, exportStudentOutputToExcel } from '../engine/exporters/smartExporter.js';
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

/**
 * Smart Multi-Format Document Upload and Extraction Handler
 * Inspects any uploaded file across all pages/sheets and routes content strictly by data type:
 * 1. Question Output -> q_template.xlsx (12 columns)
 * 2. Student Output -> std_template.xlsx (4 columns, DOB: YYYY-MM-DD)
 */
export async function smartUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'MISSING_FILE', message: 'No document file was uploaded.' }
      });
    }

    const {
      department = 'CSE',
      semester = 5
    } = req.body;

    const uploadedBy = req.headers['x-user-name'] || 'Department Lecturer';
    const recordId = `rec_smart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Store original document securely
    const storedFileName = `${recordId}_${path.basename(req.file.originalname)}`;
    const destinationPath = path.join(ORIGINALS_DIR, storedFileName);
    fs.copyFileSync(req.file.path, destinationPath);

    // Run smart multi-format extraction and routing engine
    const extractionResult = await processSmartDocumentExtraction(destinationPath, {
      department,
      semester: parseInt(semester, 10) || 5,
      originalFilename: req.file.originalname
    });

    // Record in DB
    const record = {
      id: recordId,
      department,
      originalFilename: req.file.originalname,
      storedFilename: storedFileName,
      originalFilePath: destinationPath,
      documentType: extractionResult.detectedTypes.length > 0 ? extractionResult.detectedTypes.join('+') : 'unknown',
      fileFormat: path.extname(req.file.originalname).replace('.', '').toLowerCase(),
      fileSize: req.file.size,
      uploadTime: new Date().toISOString(),
      uploadedBy,
      status: 'completed',
      detectedTypes: extractionResult.detectedTypes,
      hasQuestions: extractionResult.hasQuestions,
      hasStudents: extractionResult.hasStudents,
      stats: {
        totalQuestions: extractionResult.questionOutput.totalQuestions,
        totalStudents: extractionResult.studentOutput.totalStudents
      }
    };

    db.saveConversionRecord(record);
    db.saveSmartExtraction(recordId, {
      ...extractionResult,
      recordId
    });

    db.addAuditLog({
      user: uploadedBy,
      role: 'Department User',
      department,
      action: 'SMART_DOCUMENT_CONVERTED',
      entityType: 'smart_document',
      entityId: recordId,
      details: {
        filename: req.file.originalname,
        detectedTypes: extractionResult.detectedTypes,
        totalQuestions: extractionResult.questionOutput.totalQuestions,
        totalStudents: extractionResult.studentOutput.totalStudents
      }
    });

    res.json({
      success: true,
      statusCode: 200,
      message: 'Document inspected, extracted, and routed successfully by data type',
      data: {
        recordId,
        record,
        detectedTypes: extractionResult.detectedTypes,
        hasQuestions: extractionResult.hasQuestions,
        hasStudents: extractionResult.hasStudents,
        questionOutput: extractionResult.questionOutput,
        studentOutput: extractionResult.studentOutput,
        downloadUrls: {
          questions: extractionResult.hasQuestions ? `/api/smart-upload/${recordId}/export/questions` : null,
          students: extractionResult.hasStudents ? `/api/smart-upload/${recordId}/export/students` : null
        }
      }
    });
  } catch (err) {
    console.error('[Smart Upload Controller Error]', err);
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'SMART_CONVERSION_ERROR', message: err.message }
    });
  }
}

/**
 * Retrieves the smart extraction record
 */
export function getSmartExtraction(req, res) {
  try {
    const { recordId } = req.params;
    const extraction = db.getSmartExtraction(recordId);
    const record = db.getConversionRecord(recordId);

    if (!extraction) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Smart extraction record not found' }
      });
    }

    res.json({
      success: true,
      statusCode: 200,
      data: {
        record,
        extraction
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'FETCH_ERROR', message: err.message }
    });
  }
}

/**
 * Exports QUESTION OUTPUT -> q_template.xlsx (Sheet1 & Module sheets)
 */
export async function exportSmartQuestions(req, res) {
  try {
    const { recordId } = req.params;
    const extraction = db.getSmartExtraction(recordId);

    if (!extraction || !extraction.questionOutput?.rows) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'No question data available for this document' }
      });
    }

    const rows = extraction.questionOutput.rows;
    const buffer = await exportQuestionOutputToExcel(rows);

    const filename = `q_template_${recordId}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[Export Questions Error]', err);
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'EXPORT_ERROR', message: err.message }
    });
  }
}

/**
 * Exports STUDENT OUTPUT -> std_template.xlsx (Sheet1)
 */
export async function exportSmartStudents(req, res) {
  try {
    const { recordId } = req.params;
    const extraction = db.getSmartExtraction(recordId);

    if (!extraction || !extraction.studentOutput?.rows) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'No student data available for this document' }
      });
    }

    const rows = extraction.studentOutput.rows;
    const buffer = await exportStudentOutputToExcel(rows);

    const filename = `std_template_${recordId}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[Export Students Error]', err);
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'EXPORT_ERROR', message: err.message }
    });
  }
}
