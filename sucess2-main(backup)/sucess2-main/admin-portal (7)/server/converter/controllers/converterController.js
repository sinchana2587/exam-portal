import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { getAllTemplates, getTemplate, validateDestinationTemplate, normalizeTemplateId, TEMPLATE_IDS } from '../engine/registry/templateRegistry.js';
import { ingestDocument } from '../engine/ingestion/universalIngestionService.js';
import { createDocumentEnvelope } from '../engine/models/documentEnvelope.js';
import { mapToQuestionPaperTemplate, mapToStudentListTemplate } from '../engine/mapping/intelligentMappingEngine.js';
import { validateMappedContent } from '../engine/validation/validationEngine.js';
import { generateInstitutionalWorkbook } from '../engine/exporters/universalExcelExporter.js';
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
 * 1. GET /api/converter/templates
 * Returns available fixed institutional destination templates
 */
export async function getTemplates(req, res) {
  try {
    const templates = getAllTemplates();
    res.json({
      success: true,
      statusCode: 200,
      message: 'Fixed institutional destination templates retrieved successfully',
      data: {
        templates,
        total: templates.length
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'TEMPLATE_FETCH_ERROR', message: err.message }
    });
  }
}

/**
 * 2. POST /api/converter/upload
 * Centralized upload and conversion endpoint:
 * Ingests any supported source file -> maps to selected destination template -> validates -> saves
 */
export async function uploadAndConvert(req, res) {
  const conversionId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'FILE_REQUIRED', message: 'Please select a source document to upload.' }
      });
    }

    const requestedTemplate = req.body.templateId || req.body.destinationTemplate || req.body.documentType;
    if (!requestedTemplate) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: {
          code: 'TEMPLATE_REQUIRED',
          message: 'Destination template must be specified. Valid options: QUESTION_PAPER, STUDENT_LIST.'
        }
      });
    }

    // Step 1: Validate destination template against registry
    const templateValidation = validateDestinationTemplate(requestedTemplate);
    if (!templateValidation.valid) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'INVALID_TEMPLATE', message: templateValidation.error }
      });
    }

    const templateId = templateValidation.templateId;
    const templateDef = templateValidation.template;
    const department = req.body.department || 'CSE';
    const semester = req.body.semester ? Number(req.body.semester) : 5;
    const subjectName = req.body.subjectName || '';
    const subjectCode = req.body.subjectCode || '';
    const uploadedBy = req.headers['x-user-name'] || req.body.uploadedBy || 'Institutional User';

    logStep(1, 'Receive source file and validate destination template', {
      filename: file.originalname,
      size: file.size,
      destinationTemplate: templateId
    });

    // Step 2: Store original file securely
    logStep(2, 'Store original document securely');
    const storedFileName = `${conversionId}_${path.basename(file.originalname)}`;
    const destinationPath = path.join(ORIGINALS_DIR, storedFileName);
    fs.copyFileSync(file.path, destinationPath);

    // Step 3: Ingest document and extract content
    logStep(3, 'Ingest document and execute format-specific extraction');
    const ingestionResult = await ingestDocument({
      ...file,
      path: destinationPath
    });

    logStep(4, 'Extraction complete', {
      method: ingestionResult.extraction.method,
      durationMs: ingestionResult.extraction.durationMs,
      warningsCount: ingestionResult.extraction.warnings.length
    });

    // Step 4: Intelligent Field Mapping to Destination Template
    logStep(5, `Intelligently map extracted content to ${templateDef.displayName}`);
    let mappedData = null;
    const mappingOptions = { department, semester, subjectName, subjectCode };

    if (templateId === TEMPLATE_IDS.QUESTION_PAPER) {
      mappedData = mapToQuestionPaperTemplate(ingestionResult.extractedData, mappingOptions);
    } else {
      mappedData = mapToStudentListTemplate(ingestionResult.extractedData, mappingOptions);
    }

    // Step 5: Validate Mapped Data
    logStep(6, 'Execute template-specific validation checks');
    const validationResult = validateMappedContent(templateId, mappedData);

    // Step 6: Create Universal Document Envelope
    const envelope = createDocumentEnvelope({
      documentId: conversionId,
      sourceFile: {
        filename: file.originalname,
        format: ingestionResult.sourceFile.format,
        size: file.size,
        mimeType: file.mimetype,
        originalPath: destinationPath,
        checksum: ingestionResult.sourceFile.checksum
      },
      documentType: templateId === TEMPLATE_IDS.QUESTION_PAPER ? 'question_paper' : 'student_list',
      extraction: ingestionResult.extraction,
      content: mappedData,
      metadata: {
        uploadedBy,
        department,
        semester,
        subjectName,
        subjectCode
      }
    });

    // Step 7: Persist Conversion Session and Record
    const record = {
      id: conversionId,
      department,
      originalFilename: file.originalname,
      storedFilename: storedFileName,
      originalFilePath: destinationPath,
      documentType: templateId === TEMPLATE_IDS.QUESTION_PAPER ? 'question_paper' : 'student_list',
      destinationTemplate: templateId,
      fileFormat: ingestionResult.sourceFile.format,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      uploadedBy,
      status: validationResult.errors.length > 0 ? 'awaiting_correction' : 'awaiting_verification',
      errorDetails: validationResult.errors.length > 0 ? validationResult.errors[0].message : null,
      metadata: {
        semester,
        subjectName,
        subjectCode,
        department,
        totalItems: validationResult.summary.totalItems
      },
      stats: validationResult.summary,
      stepLogs,
      exportHistory: []
    };

    db.saveConversionRecord(record);

    db.saveUniversalConversion(conversionId, {
      envelope,
      templateId,
      templateDef: {
        id: templateDef.id,
        displayName: templateDef.displayName,
        standardHeaders: templateDef.standardHeaders
      },
      mappedData,
      validation: validationResult,
      generatedBuffer: null,
      generatedFilename: null
    });

    // Also maintain backward-compatible database stores
    if (templateId === TEMPLATE_IDS.QUESTION_PAPER) {
      db.saveQuestionPaper(conversionId, {
        modules: mappedData.modules,
        metadata: { semester, subjectName, subjectCode, department },
        verification: validationResult.summary,
        templateFields: templateDef.standardHeaders
      });
    } else {
      db.saveStudentList(conversionId, {
        records: mappedData.records,
        summary: validationResult.summary,
        duplicateRecords: validationResult.warnings.filter(w => w.code === 'DUPLICATE_USN')
      });
    }

    db.addAuditLog({
      user: uploadedBy,
      role: 'Department User',
      department,
      action: 'UNIVERSAL_DOCUMENT_CONVERTED',
      entityType: templateId,
      entityId: conversionId,
      details: {
        filename: file.originalname,
        format: ingestionResult.sourceFile.format,
        destinationTemplate: templateId,
        validationScore: validationResult.summary.confidenceScore
      }
    });

    res.json({
      success: true,
      statusCode: 200,
      message: `Document successfully ingested and mapped to ${templateDef.displayName}`,
      data: {
        conversionId,
        destinationTemplate: templateId,
        templateName: templateDef.displayName,
        detectedFormat: ingestionResult.sourceFile.format,
        extractionMethod: ingestionResult.extraction.method,
        validation: validationResult,
        preview: mappedData,
        envelope
      }
    });
  } catch (err) {
    console.error('[Universal Converter Controller Error]', err);
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'CONVERSION_PIPELINE_ERROR', message: err.message }
    });
  }
}

/**
 * 3. GET /api/converter/:conversionId/preview
 * Returns extracted, mapped, and validation information for preview
 */
export async function getConversionPreview(req, res) {
  try {
    const { conversionId } = req.params;
    const session = db.getUniversalConversion(conversionId);

    if (!session) {
      // Check legacy conversion record
      const legacyRecord = db.getConversionRecord(conversionId);
      if (!legacyRecord) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          error: { code: 'NOT_FOUND', message: `Conversion session "${conversionId}" not found.` }
        });
      }

      const qp = db.getQuestionPaper(conversionId);
      const sl = db.getStudentList(conversionId);
      return res.json({
        success: true,
        statusCode: 200,
        data: {
          conversionId,
          record: legacyRecord,
          data: qp || sl
        }
      });
    }

    res.json({
      success: true,
      statusCode: 200,
      data: {
        conversionId,
        templateId: session.templateId,
        templateDef: session.templateDef,
        validation: session.validation,
        preview: session.mappedData,
        envelope: session.envelope,
        hasGeneratedExcel: Boolean(session.generatedBuffer)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'PREVIEW_ERROR', message: err.message }
    });
  }
}

/**
 * 4. PUT /api/converter/:conversionId/correct
 * Accepts manual corrections to records and updates validation
 */
export async function applyCorrections(req, res) {
  try {
    const { conversionId } = req.params;
    const session = db.getUniversalConversion(conversionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: `Conversion session "${conversionId}" not found.` }
      });
    }

    const { records, modules, metadata } = req.body;

    if (session.templateId === TEMPLATE_IDS.STUDENT_LIST && Array.isArray(records)) {
      session.mappedData.records = records;
      session.mappedData.totalRecords = records.length;
    } else if (session.templateId === TEMPLATE_IDS.QUESTION_PAPER && Array.isArray(modules)) {
      session.mappedData.modules = modules;
      session.mappedData.totalModules = modules.length;
      session.mappedData.totalQuestions = modules.reduce((sum, m) => sum + (m.questions?.length || 0), 0);
    }

    if (metadata) {
      session.envelope.metadata = { ...session.envelope.metadata, ...metadata };
    }

    // Re-run validation on corrected data
    const updatedValidation = validateMappedContent(session.templateId, session.mappedData);
    session.validation = updatedValidation;

    // Reset generated buffer since data changed
    session.generatedBuffer = null;

    db.saveUniversalConversion(conversionId, session);

    // Update parent record status
    const rec = db.getConversionRecord(conversionId);
    if (rec) {
      rec.status = updatedValidation.errors.length > 0 ? 'awaiting_correction' : 'awaiting_verification';
      rec.stats = updatedValidation.summary;
      db.saveConversionRecord(rec);
    }

    db.addAuditLog({
      user: req.headers['x-user-name'] || 'User',
      role: 'Reviewer',
      action: 'CONVERSION_DATA_CORRECTED',
      entityType: session.templateId,
      entityId: conversionId,
      details: {
        errorCount: updatedValidation.errors.length,
        warningCount: updatedValidation.warnings.length
      }
    });

    res.json({
      success: true,
      statusCode: 200,
      message: 'Corrections applied and validated successfully',
      data: {
        conversionId,
        validation: updatedValidation,
        preview: session.mappedData
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'CORRECTION_ERROR', message: err.message }
    });
  }
}

/**
 * 5. POST /api/converter/:conversionId/generate
 * Generates the final Excel (.xlsx) workbook for the institutional template
 */
export async function generateExcel(req, res) {
  try {
    const { conversionId } = req.params;
    const session = db.getUniversalConversion(conversionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: `Conversion session "${conversionId}" not found.` }
      });
    }

    const filenamePrefix = (session.envelope?.source_file?.filename || 'Document')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const generated = await generateInstitutionalWorkbook(
      session.templateId,
      session.mappedData,
      { filenamePrefix }
    );

    // Store generated buffer as base64 in session
    session.generatedBuffer = generated.buffer.toString('base64');
    session.generatedFilename = generated.filename;
    db.saveUniversalConversion(conversionId, session);

    const rec = db.getConversionRecord(conversionId);
    if (rec) {
      rec.status = 'converted';
      rec.exportHistory = rec.exportHistory || [];
      rec.exportHistory.push({
        format: 'xlsx',
        filename: generated.filename,
        timestamp: new Date().toISOString()
      });
      db.saveConversionRecord(rec);
    }

    res.json({
      success: true,
      statusCode: 200,
      message: 'Institutional Excel workbook generated successfully',
      data: {
        conversionId,
        templateId: session.templateId,
        filename: generated.filename,
        summary: generated.summary,
        downloadUrl: `/api/converter/${conversionId}/download`
      }
    });
  } catch (err) {
    console.error('[Generate Excel Error]', err);
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'EXCEL_GENERATION_ERROR', message: err.message }
    });
  }
}

/**
 * 6. GET /api/converter/:conversionId/download
 * Downloads the generated .xlsx workbook file
 */
export async function downloadExcel(req, res) {
  try {
    const { conversionId } = req.params;
    let session = db.getUniversalConversion(conversionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: `Conversion session "${conversionId}" not found.` }
      });
    }

    let buffer = null;
    let filename = session.generatedFilename;

    if (session.generatedBuffer) {
      buffer = Buffer.from(session.generatedBuffer, 'base64');
    } else {
      // Generate on-the-fly if not already generated
      const filenamePrefix = (session.envelope?.source_file?.filename || 'Document')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      const generated = await generateInstitutionalWorkbook(
        session.templateId,
        session.mappedData,
        { filenamePrefix }
      );
      buffer = generated.buffer;
      filename = generated.filename;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DOWNLOAD_ERROR', message: err.message }
    });
  }
}

/**
 * 7. POST /api/converter/:conversionId/process
 * Reprocesses or resets a conversion pipeline
 */
export async function processConversion(req, res) {
  try {
    const { conversionId } = req.params;
    const session = db.getUniversalConversion(conversionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: `Conversion session "${conversionId}" not found.` }
      });
    }

    const { templateId = session.templateId, department, semester } = req.body;
    const origPath = session.envelope?.source_file?.originalPath;

    if (!origPath || !fs.existsSync(origPath)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'SOURCE_FILE_MISSING', message: 'Original source document is no longer on disk.' }
      });
    }

    const ingestionResult = await ingestDocument({ path: origPath, originalname: session.envelope.source_file.filename });
    const mappingOptions = {
      department: department || session.envelope.metadata.department,
      semester: semester ? Number(semester) : session.envelope.metadata.semester
    };

    let mappedData = null;
    if (templateId === TEMPLATE_IDS.QUESTION_PAPER) {
      mappedData = mapToQuestionPaperTemplate(ingestionResult.extractedData, mappingOptions);
    } else {
      mappedData = mapToStudentListTemplate(ingestionResult.extractedData, mappingOptions);
    }

    const validation = validateMappedContent(templateId, mappedData);

    session.templateId = templateId;
    session.mappedData = mappedData;
    session.validation = validation;
    session.generatedBuffer = null;
    db.saveUniversalConversion(conversionId, session);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Conversion re-processed successfully',
      data: {
        conversionId,
        templateId,
        validation,
        preview: mappedData
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'REPROCESS_ERROR', message: err.message }
    });
  }
}
