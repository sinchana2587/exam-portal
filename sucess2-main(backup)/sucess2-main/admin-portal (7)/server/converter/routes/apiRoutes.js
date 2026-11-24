import express from 'express';
import { documentUpload, imageUpload } from '../middleware/uploadMiddleware.js';

import * as dashboardController from '../controllers/dashboardController.js';
import * as templateController from '../controllers/templateController.js';
import * as questionPaperController from '../controllers/questionPaperController.js';
import * as studentListController from '../controllers/studentListController.js';
import * as studentDatabaseController from '../controllers/studentDatabaseController.js';
import * as historyController from '../controllers/historyController.js';
import * as sampleTestController from '../controllers/sampleTestController.js';
import * as smartUploadController from '../controllers/smartUploadController.js';
import * as converterController from '../controllers/converterController.js';

const router = express.Router();

// --- Health ---
router.get('/health', (req, res) => {
  res.json({
    success: true,
    statusCode: 200,
    message: 'Smart Examination Document Converter API is operational',
    data: {
      institution: 'Maharaja Institute of Technology Mysore',
      system: 'ProTick Smart Document Converter',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// --- Dashboard ---
router.get('/dashboard/stats', dashboardController.getDashboardStats);


// --- Universal Input-to-Fixed-Template Converter System ---
router.get('/converter/templates', converterController.getTemplates);
router.post('/converter/upload', documentUpload.single('file'), converterController.uploadAndConvert);
router.post('/converter/:conversionId/process', converterController.processConversion);
router.get('/converter/:conversionId/preview', converterController.getConversionPreview);
router.put('/converter/:conversionId/correct', converterController.applyCorrections);
router.post('/converter/:conversionId/generate', converterController.generateExcel);
router.get('/converter/:conversionId/download', converterController.downloadExcel);

// --- Reference Templates ---
router.get('/templates', templateController.getTemplates);
router.put('/templates/question-paper', templateController.updateQuestionPaperTemplate);
router.put('/templates/student-list', templateController.updateStudentListTemplate);

// --- Smart Multi-Format Document Routing Engine ---
router.post('/smart-upload', documentUpload.single('file'), smartUploadController.smartUpload);
router.get('/smart-upload/:recordId', smartUploadController.getSmartExtraction);
router.get('/smart-upload/:recordId/export/questions', smartUploadController.exportSmartQuestions);
router.get('/smart-upload/:recordId/export/students', smartUploadController.exportSmartStudents);

// --- Question Paper Converter ---
router.post('/question-paper/upload', documentUpload.single('file'), questionPaperController.uploadQuestionPaper);
router.get('/question-paper/:recordId', questionPaperController.getQuestionPaper);
router.put('/question-paper/:recordId/questions/:questionId', questionPaperController.updateQuestion);
router.post('/question-paper/:recordId/questions', questionPaperController.addQuestion);
router.delete('/question-paper/:recordId/questions/:questionId', questionPaperController.deleteQuestion);
router.post('/question-paper/:recordId/questions/:questionId/duplicate', questionPaperController.duplicateQuestion);
router.post('/question-paper/:recordId/questions/:questionId/move', questionPaperController.moveQuestion);
router.post('/question-paper/:recordId/reorder', questionPaperController.reorderQuestions);
router.post('/question-paper/:recordId/modules', questionPaperController.addModule);
router.delete('/question-paper/:recordId/modules/:moduleNumber', questionPaperController.deleteModule);
router.post('/question-paper/upload-image', imageUpload.single('image'), questionPaperController.uploadMediaImage);
router.post('/question-paper/:recordId/verify', questionPaperController.verifyQuestionPaper);
router.get('/question-paper/:recordId/export', questionPaperController.exportQuestionPaper);

// --- Student List Converter ---
router.post('/student-list/upload', documentUpload.single('file'), studentListController.uploadStudentList);
router.get('/student-list/:recordId', studentListController.getStudentList);
router.put('/student-list/:recordId/records/:studentId', studentListController.updateStudentRow);
router.post('/student-list/:recordId/records', studentListController.addStudentRow);
router.delete('/student-list/:recordId/records/:studentId', studentListController.deleteStudentRow);
router.post('/student-list/:recordId/verify', studentListController.verifyStudentList);
router.post('/student-list/:recordId/import-central', studentListController.importToCentralDatabase);
router.get('/student-list/:recordId/export', studentListController.exportStudentList);

// --- Central Student Database ---
router.get('/central-students', studentDatabaseController.getCentralStudents);
router.post('/central-students', studentDatabaseController.addCentralStudent);
router.put('/central-students/:id', studentDatabaseController.updateCentralStudent);
router.delete('/central-students/:id', studentDatabaseController.deleteCentralStudent);
router.get('/central-students/export', studentDatabaseController.exportCentralRoster);

// --- Conversion History & Audits ---
router.get('/history', historyController.getConversionHistory);
router.get('/history/:recordId/download-original', historyController.downloadOriginalDocument);
router.post('/history/:recordId/reprocess', historyController.reprocessDocument);
router.delete('/history/:recordId', historyController.deleteRecord);
router.get('/history/audit-logs', historyController.getAuditLogs);

// --- Automated Sample Tests ---
router.get('/samples', sampleTestController.listSampleDocuments);
router.post('/samples/run/:testId', sampleTestController.runSampleTest);
router.post('/samples/run-all', sampleTestController.runAllTests);

export default router;

