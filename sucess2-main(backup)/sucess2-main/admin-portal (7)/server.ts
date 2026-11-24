import express, { NextFunction, Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import type { CourseOutcomeDocumentRevision } from './src/types';
import {
  cleanupExpiredStudentSessions,
  createStudentConversionSession,
  getStudentConversionSession,
  updateStudentConversionSession,
} from './server/services/studentExtractor';
import {
  cleanupExpiredQuestionSessions,
  createQuestionConversionSession,
  getQuestionConversionSession,
  updateQuestionConversionSession,
} from './server/services/questionExtractor';
import {
  buildQuestionWorkbookBuffer,
  buildStudentWorkbookBuffer,
  parseQuestionWorkbookBuffer,
  parseStudentWorkbookBuffer,
} from './server/services/excelImageService';
import { DocumentProcessingError } from './server/services/pdfAndOcrEngine';
import converterApiRouter from './server/converter/routes/apiRoutes.js';

interface HodRequestContext {
  hodUserId: string;
  departmentId: string;
  departmentCode: string;
}

interface ServerAuditRecord {
  timestamp: string;
  event: string;
  hodUserId: string;
  departmentCode: string;
  details: string;
}

interface StoredCourseOutcomeEntry {
  revision: CourseOutcomeDocumentRevision;
  buffer: Buffer;
}

const courseOutcomeStore = new Map<string, StoredCourseOutcomeEntry[]>();

const serverAuditTrail: ServerAuditRecord[] = [];
function recordServerAudit(
  ctx: HodRequestContext,
  event: string,
  details: string
): void {
  serverAuditTrail.unshift({
    timestamp: new Date().toISOString(),
    event,
    hodUserId: ctx.hodUserId,
    departmentCode: ctx.departmentCode,
    details,
  });
  if (serverAuditTrail.length > 500) serverAuditTrail.length = 500;
}

function extractHodContext(req: Request): HodRequestContext {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 12) {
    throw new DocumentProcessingError(
      'Authenticated HOD session token is required for document conversion.',
      'UNSUPPORTED_FORMAT',
      401
    );
  }

  const hodUserId =
    String(req.headers['x-hod-user-id'] || req.body?.hodUserId || '').trim();
  const departmentId =
    String(req.headers['x-hod-department-id'] || req.body?.departmentId || '').trim();
  const departmentCode =
    String(req.headers['x-hod-department-code'] || req.body?.departmentCode || '')
      .trim()
      .toUpperCase();

  if (!hodUserId || !departmentId || !departmentCode) {
    throw new DocumentProcessingError(
      'Authenticated HOD department scope headers are required.',
      'UNSUPPORTED_FORMAT',
      403
    );
  }

  return { hodUserId, departmentId, departmentCode };
}

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB upload limit
  },
});

export function createApiRouter(): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '35mb' }));

  // Periodic ephemeral session cleanup
  const cleanupTimer = setInterval(() => {
    cleanupExpiredStudentSessions();
    cleanupExpiredQuestionSessions();
  }, 60 * 1000);
  cleanupTimer.unref?.();

  // Smart Examination Document Converter API (from sibling Converter implementation)
  router.use(converterApiRouter);

  router.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'UP',
        service: 'MIT Mysore Document Conversion & Excel Processing Service',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // STUDENT LIST CONVERSION APIs (PART 7)
  // =========================================================================

  router.post(
    '/hod/student-lists/conversions',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            code: 'MISSING_FILE',
            message: 'Please select a PDF, JPG, JPEG, or PNG student list document.',
          });
          return;
        }

        const semesterNumber = Number(req.body?.semesterNumber);
        const section = String(req.body?.section || '').trim();
        if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || !section) {
          res.status(400).json({
            success: false,
            code: 'INVALID_CONTEXT',
            message: 'Semester number and target section must be selected before conversion.',
          });
          return;
        }

        const existingUsnConflicts = parseJsonField<Record<string, string>>(
          req.body?.existingUsnConflicts,
          {}
        );

        const session = await createStudentConversionSession({
          fileBuffer: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          hodUserId: ctx.hodUserId,
          departmentId: ctx.departmentId,
          departmentCode: ctx.departmentCode,
          semesterNumber,
          section,
          existingUsnConflicts,
        });

        recordServerAudit(
          ctx,
          'STUDENT_CONVERSION_CREATED',
          `Processed ${session.fileType} (${session.records.length} rows) for ${ctx.departmentCode} Sem ${semesterNumber} ${section}.`
        );

        res.status(200).json({
          success: true,
          data: session,
          message: session.statusMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/hod/student-lists/conversions/:conversionId',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const sess = getStudentConversionSession(
          req.params.conversionId,
          ctx.hodUserId,
          ctx.departmentId
        );
        if (!sess) {
          res.status(404).json({
            success: false,
            code: 'CONVERSION_NOT_FOUND',
            message: 'Conversion session not found or unauthorized.',
          });
          return;
        }
        res.json({ success: true, data: sess, timestamp: new Date().toISOString() });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/hod/student-lists/conversions/:conversionId/records',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const updated = updateStudentConversionSession({
          conversionId: req.params.conversionId,
          hodUserId: ctx.hodUserId,
          departmentId: ctx.departmentId,
          records: req.body?.records,
          sectionConfirmed: req.body?.sectionConfirmed,
          existingUsnConflicts: req.body?.existingUsnConflicts,
        });
        recordServerAudit(
          ctx,
          'STUDENT_CONVERSION_UPDATED',
          `Updated ${updated.records.length} student review row(s) (${updated.status}).`
        );
        res.json({
          success: true,
          data: updated,
          message: updated.statusMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/hod/student-lists/conversions/:conversionId/validate',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const updated = updateStudentConversionSession({
          conversionId: req.params.conversionId,
          hodUserId: ctx.hodUserId,
          departmentId: ctx.departmentId,
          records: req.body?.records,
          sectionConfirmed: req.body?.sectionConfirmed,
          existingUsnConflicts: req.body?.existingUsnConflicts,
        });
        res.json({
          success: true,
          data: updated,
          message: updated.statusMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/hod/student-lists/conversions/:conversionId/excel',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const sess = getStudentConversionSession(
          req.params.conversionId,
          ctx.hodUserId,
          ctx.departmentId
        );
        if (!sess) {
          res.status(404).json({
            success: false,
            code: 'CONVERSION_NOT_FOUND',
            message: 'Conversion session not found or expired.',
          });
          return;
        }
        if (!sess.downloadEligible) {
          res.status(400).json({
            success: false,
            code: 'VALIDATION_FAILED',
            message:
              sess.statusMessage ||
              'Excel download is blocked until all validation errors and context checks are resolved.',
          });
          return;
        }

        const buffer = await buildStudentWorkbookBuffer(sess.records);
        recordServerAudit(
          ctx,
          'STUDENT_EXCEL_DOWNLOADED',
          `Generated standard 3-column Excel (${sess.records.length} students) for ${sess.departmentCode} Sem ${sess.semesterNumber} ${sess.section}.`
        );

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${sess.recommendedFileName}"`
        );
        res.send(buffer);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get('/hod/student-lists/template', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = String(req.query.departmentCode || 'DEPT').toUpperCase();
      const sem = String(req.query.semesterNumber || '1');
      const sec = String(req.query.section || 'SectionA').replace(/\s+/g, '');
      const buffer = await buildStudentWorkbookBuffer([]);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${dept}_Sem${sem}_${sec}_Student_Template.xlsx"`
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/hod/student-lists/import',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        if (req.file) {
          const parsed = await parseStudentWorkbookBuffer(req.file.buffer);
          res.json({
            success: true,
            data: parsed,
            message: `Parsed ${parsed.rows.length} student row(s) from ${req.file.originalname}.`,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        const rows = req.body?.rows;
        if (!Array.isArray(rows) || rows.length === 0) {
          res.status(400).json({
            success: false,
            code: 'INVALID_IMPORT',
            message: 'Provide a valid student Excel file or validated rows for import.',
          });
          return;
        }
        recordServerAudit(
          ctx,
          'STUDENT_LIST_IMPORTED',
          `Validated manual student-list import (${rows.length} students).`
        );
        res.json({
          success: true,
          data: { importedCount: rows.length },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // =========================================================================
  // MODULE-WISE QUESTION CONVERSION & IMAGE-ENABLED EXCEL APIs (PART 7)
  // =========================================================================

  router.post(
    '/hod/question-banks/conversions',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            code: 'MISSING_FILE',
            message: 'Please select a PDF, JPG, JPEG, or PNG question document.',
          });
          return;
        }

        const semesterNumber = Number(req.body?.semesterNumber);
        const subjectId = String(req.body?.subjectId || '').trim();
        const subjectCode = String(req.body?.subjectCode || '').trim().toUpperCase();
        const subjectName = String(req.body?.subjectName || '').trim();
        const subjectModuleCount = Number(req.body?.subjectModuleCount);
        const selectedPageRange = req.body?.selectedPageRange
          ? String(req.body.selectedPageRange).trim()
          : undefined;
        const existingQuestionTexts = parseJsonField<string[]>(
          req.body?.existingQuestionTexts,
          []
        );

        if (
          !subjectId ||
          !subjectCode ||
          !Number.isInteger(semesterNumber) ||
          !Number.isInteger(subjectModuleCount)
        ) {
          res.status(400).json({
            success: false,
            code: 'INVALID_CONTEXT',
            message: 'Semester and Subject must be selected before converting questions.',
          });
          return;
        }

        const session = await createQuestionConversionSession({
          fileBuffer: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          hodUserId: ctx.hodUserId,
          departmentId: ctx.departmentId,
          departmentCode: ctx.departmentCode,
          semesterNumber,
          subjectId,
          subjectCode,
          subjectName,
          subjectModuleCount,
          existingQuestionTexts,
          selectedPageRange,
        });

        recordServerAudit(
          ctx,
          'QUESTION_CONVERSION_CREATED',
          `Converted ${session.fileType} for ${subjectCode}: ${session.records.length} question(s) across ${session.detectedModules.length} detected module(s) (${session.needsModuleReviewCount} needing review), ${session.totalImageCount} image(s).`
        );

        res.json({
          success: true,
          data: session,
          message: session.statusMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/hod/question-banks/conversions/:conversionId',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const sess = getQuestionConversionSession(
          req.params.conversionId,
          ctx.hodUserId,
          ctx.departmentId
        );
        if (!sess) {
          res.status(404).json({
            success: false,
            code: 'CONVERSION_NOT_FOUND',
            message: 'Question conversion session not found or unauthorized.',
          });
          return;
        }
        res.json({ success: true, data: sess, timestamp: new Date().toISOString() });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/hod/question-banks/conversions/:conversionId/records',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const updated = updateQuestionConversionSession({
          conversionId: req.params.conversionId,
          hodUserId: ctx.hodUserId,
          departmentId: ctx.departmentId,
          records: req.body?.records,
          unassignedImages: req.body?.unassignedImages,
          existingQuestionTexts: req.body?.existingQuestionTexts,
        });
        recordServerAudit(
          ctx,
          'QUESTION_CONVERSION_UPDATED',
          `Updated ${updated.records.length} question record(s) for ${updated.subjectCode} (${updated.readyModuleCount}/${updated.detectedModules.length} module(s) ready, status: ${updated.status}).`
        );
        res.json({
          success: true,
          data: updated,
          message: updated.statusMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/hod/question-banks/conversions/:conversionId/validate',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const updated = updateQuestionConversionSession({
          conversionId: req.params.conversionId,
          hodUserId: ctx.hodUserId,
          departmentId: ctx.departmentId,
          records: req.body?.records,
          unassignedImages: req.body?.unassignedImages,
          existingQuestionTexts: req.body?.existingQuestionTexts,
        });
        res.json({
          success: true,
          data: updated,
          message: updated.statusMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/hod/question-banks/conversions/:conversionId/excel',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const sess = getQuestionConversionSession(
          req.params.conversionId,
          ctx.hodUserId,
          ctx.departmentId
        );
        if (!sess) {
          res.status(404).json({
            success: false,
            code: 'CONVERSION_NOT_FOUND',
            message: 'Question conversion session not found or expired.',
          });
          return;
        }

        const reqModuleRaw = req.query?.moduleNumber;
        const targetModuleNumber = reqModuleRaw !== undefined ? Number(reqModuleRaw) : NaN;

        if (
          !Number.isInteger(targetModuleNumber) ||
          targetModuleNumber < 1 ||
          targetModuleNumber > sess.subjectModuleCount
        ) {
          res.status(400).json({
            success: false,
            code: 'INVALID_CONTEXT',
            message: `Specify a valid moduleNumber (1–${sess.subjectModuleCount}) to download that module Excel workbook.`,
          });
          return;
        }

        const moduleGroup = sess.detectedModules.find(
          (g) => g.moduleNumber === targetModuleNumber
        );
        if (!moduleGroup) {
          res.status(400).json({
            success: false,
            code: 'VALIDATION_FAILED',
            message: `No questions assigned to Module ${targetModuleNumber} were found in this conversion session.`,
          });
          return;
        }

        const rowsForWorkbook = sess.records.filter(
          (r) => r.assignedModuleNumber === targetModuleNumber
        );

        if (
          !moduleGroup.downloadEligible ||
          rowsForWorkbook.length === 0 ||
          rowsForWorkbook.some((r) => !r.isValid)
        ) {
          res.status(400).json({
            success: false,
            code: 'VALIDATION_FAILED',
            message: `Module ${targetModuleNumber} Excel download is blocked until its ${moduleGroup.issueCount || 'remaining'} validation/image issue(s) are resolved.`,
          });
          return;
        }

        const buffer = await buildQuestionWorkbookBuffer({
          moduleNumber: targetModuleNumber,
          subjectCode: sess.subjectCode,
          rows: rowsForWorkbook,
        });

        const downloadFileName =
          moduleGroup.recommendedFileName ||
          `${sess.departmentCode}_Sem${sess.semesterNumber}_${sess.subjectCode}_Module_${targetModuleNumber}_Questions.xlsx`;

        recordServerAudit(
          ctx,
          'QUESTION_EXCEL_DOWNLOADED',
          `Generated image-enabled Excel for ${sess.subjectCode} Module ${targetModuleNumber} (${rowsForWorkbook.length} question(s)).`
        );

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${downloadFileName}"`
        );
        res.send(buffer);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get('/hod/question-banks/template', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subjectCode = String(req.query.subjectCode || 'SUBJECT').toUpperCase();
      const moduleNumber = Math.max(1, Number(req.query.moduleNumber) || 1);
      const buffer = await buildQuestionWorkbookBuffer({
        moduleNumber,
        subjectCode,
        rows: [],
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="MITM_${subjectCode}_Module_${moduleNumber}_Template.xlsx"`
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  // Parse normal bulk-upload Excel workbook with full embedded drawing & _ImageMap reconstruction
  router.post(
    '/hod/question-banks/parse-excel',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        extractHodContext(req);
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            code: 'MISSING_FILE',
            message: 'Please select an Excel workbook (.xlsx) to parse.',
          });
          return;
        }
        const subjectModuleCount = Number(req.body?.subjectModuleCount) || 5;
        const expectedModuleNumber = req.body?.selectedModuleNumber
          ? Number(req.body.selectedModuleNumber)
          : undefined;
        const existingQuestionTexts = parseJsonField<string[]>(
          req.body?.existingQuestionTexts,
          []
        );

        const parsed = await parseQuestionWorkbookBuffer({
          buffer: file.buffer,
          fileName: file.originalname,
          subjectModuleCount,
          expectedModuleNumber,
          existingQuestionTexts,
        });

        res.json({
          success: true,
          data: parsed,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // Authoritative Question Bank Import Endpoint (assigns permanent Question IDs after validation)
  router.post(
    '/hod/question-banks/import',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const { subjectId, subjectCode, selectedModuleNumber, rows } = req.body || {};
        if (!subjectId || !subjectCode || !Array.isArray(rows) || rows.length === 0) {
          res.status(400).json({
            success: false,
            code: 'INVALID_IMPORT',
            message: 'Subject context and validated question rows are required for import.',
          });
          return;
        }
        const expectedMod = Number(selectedModuleNumber);
        for (const r of rows) {
          if (Number(r.moduleNumber) !== expectedMod) {
            res.status(400).json({
              success: false,
              code: 'MODULE_MISMATCH',
              message: `Import rejected: strict module-wise policy requires every question in this batch to belong to Module ${expectedMod}.`,
            });
            return;
          }
        }

        const assignedQuestionIds = rows.map(
          (_r: unknown, idx: number) =>
            `QID-${String(subjectCode).toUpperCase()}-M${expectedMod}-${Date.now().toString(36).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`
        );

        recordServerAudit(
          ctx,
          'QUESTION_BANK_IMPORTED',
          `Imported ${rows.length} validated question(s) into ${subjectCode} Module ${expectedMod}.`
        );

        res.json({
          success: true,
          data: {
            importedCount: rows.length,
            skippedDuplicates: 0,
            assignedQuestionIds,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // =========================================================================
  // COURSE OUTCOMES PDF DOCUMENT SUBMISSION & REVISION HISTORY APIs
  // =========================================================================

  router.get(
    '/hod/subjects/:subjectId/course-outcomes',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const subjectId = String(req.params.subjectId || '').trim();
        const key = `${ctx.departmentId}::${subjectId}`;
        const entries = courseOutcomeStore.get(key) || [];
        res.json({
          success: true,
          data: entries.map((e) => e.revision),
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/hod/subjects/:subjectId/course-outcomes',
    upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const subjectId = String(req.params.subjectId || '').trim();
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            code: 'MISSING_FILE',
            message: 'Please select a Course Outcomes PDF document (.pdf).',
          });
          return;
        }

        const lowerName = file.originalname.toLowerCase();
        const isPdfMagic = file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
        if (!lowerName.endsWith('.pdf') || !isPdfMagic) {
          res.status(400).json({
            success: false,
            code: 'UNSUPPORTED_FORMAT',
            message:
              'Invalid Course Outcomes file. Only genuine PDF documents (.pdf) are accepted.',
          });
          return;
        }

        const semesterNumber = Number(req.body?.semesterNumber);
        const subjectCode = String(req.body?.subjectCode || '').trim().toUpperCase();
        const subjectName = String(req.body?.subjectName || '').trim();
        const notes = req.body?.notes ? String(req.body.notes).trim() : undefined;

        if (!subjectId || !subjectCode || !Number.isInteger(semesterNumber) || semesterNumber < 1) {
          res.status(400).json({
            success: false,
            code: 'INVALID_CONTEXT',
            message: 'Semester and Subject context are required to submit Course Outcomes.',
          });
          return;
        }

        const key = `${ctx.departmentId}::${subjectId}`;
        const existingEntries = courseOutcomeStore.get(key) || [];
        existingEntries.forEach((entry) => {
          if (entry.revision.status === 'Active') {
            entry.revision.status = 'Superseded';
          }
        });

        const nextRevNum = existingEntries.length + 1;
        const uploadedBy =
          String(req.headers['x-hod-user-name'] || '').trim() || ctx.hodUserId;
        const now = new Date();
        const uploadedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const revision: CourseOutcomeDocumentRevision = {
          id: `co-doc-${crypto.randomUUID().slice(0, 12)}`,
          revisionNumber: `CO-REV-${nextRevNum}.0`,
          departmentId: ctx.departmentId,
          departmentCode: ctx.departmentCode,
          semesterNumber,
          subjectId,
          subjectCode,
          subjectName,
          fileName: file.originalname,
          fileSizeBytes: file.size,
          mimeType: 'application/pdf',
          uploadedBy,
          uploadedAt,
          status: 'Active',
          coeAccessible: true,
          notes,
        };

        const updatedEntries: StoredCourseOutcomeEntry[] = [
          { revision, buffer: Buffer.from(file.buffer) },
          ...existingEntries,
        ];
        courseOutcomeStore.set(key, updatedEntries);

        recordServerAudit(
          ctx,
          'COURSE_OUTCOMES_SUBMITTED',
          `Submitted Course Outcomes PDF "${file.originalname}" (${revision.revisionNumber}) for ${subjectCode} (Sem ${semesterNumber}).`
        );

        res.status(200).json({
          success: true,
          data: {
            uploadedRevision: revision,
            revisions: updatedEntries.map((e) => e.revision),
          },
          message: `Course Outcomes PDF submitted as ${revision.revisionNumber} and made available to the COE Portal.`,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/hod/subjects/:subjectId/course-outcomes/:documentId/file',
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = extractHodContext(req);
        const subjectId = String(req.params.subjectId || '').trim();
        const documentId = String(req.params.documentId || '').trim();
        const key = `${ctx.departmentId}::${subjectId}`;
        const entries = courseOutcomeStore.get(key) || [];
        const match = entries.find((e) => e.revision.id === documentId);

        if (!match) {
          res.status(404).json({
            success: false,
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Course Outcomes PDF revision not found or unauthorized.',
          });
          return;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${match.revision.fileName}"`
        );
        res.send(match.buffer);
      } catch (err) {
        next(err);
      }
    }
  );

  // Catch-all for Java backend endpoints not hosted by this local document-processing Express layer
  router.use((req: Request, res: Response) => {
    res.status(503).json({
      success: false,
      code: 'BACKEND_UNAVAILABLE',
      message: `Central Java backend API is not connected for ${req.method} ${req.originalUrl}.`,
    });
  });

  // Centralized error handler
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DocumentProcessingError) {
      res.status(err.status).json({
        success: false,
        code: err.code,
        message: err.message,
      });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        success: false,
        code: err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Uploaded file exceeds the 25 MB limit.'
            : err.message,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : 'Unexpected server processing error.';
    res.status(500).json({
      success: false,
      code: 'INTERNAL_PROCESSING_ERROR',
      message: msg,
    });
  });

  return router;
}

function resolveServerPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = Number(process.argv[portArgIdx + 1]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.DEFAULT_APP_PORT || process.env.PORT || 3000);
  return Number.isInteger(envPort) && envPort > 0 ? envPort : 3000;
}

export async function startServer(): Promise<void> {
  const app = express();
  const httpServer = http.createServer(app);
  const port = resolveServerPort();

  const apiRouter = createApiRouter();
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {
          server: httpServer,
        },
        hmr: !disableHmr,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[MITM-EMS] Server listening on http://0.0.0.0:${port}`);
  });
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('[MITM-EMS] Failed to start server:', err);
    process.exit(1);
  });
}