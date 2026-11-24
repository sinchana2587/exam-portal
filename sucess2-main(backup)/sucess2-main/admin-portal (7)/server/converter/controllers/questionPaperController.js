import { processDocumentConversion } from '../engine/conversionEngine.js';
import { db } from '../database/db.js';
import {
  exportQuestionPaperToExcel,
  exportQuestionPaperToCsv,
  exportQuestionPaperToJson
} from '../engine/exporters/questionPaperExporter.js';

export async function uploadQuestionPaper(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'MISSING_FILE', message: 'No question paper file was uploaded.' }
      });
    }

    const {
      department = 'CSE',
      semester = 5,
      subjectName = '',
      subjectCode = ''
    } = req.body;

    const uploadedBy = req.headers['x-user-name'] || 'Department Lecturer';

    const result = await processDocumentConversion(req.file, {
      documentType: 'question_paper',
      department,
      semester: parseInt(semester, 10) || 5,
      subjectName,
      subjectCode,
      uploadedBy
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        statusCode: 422,
        error: { code: 'CONVERSION_FAILED', message: result.error },
        recordId: result.recordId
      });
    }

    res.json({
      success: true,
      statusCode: 200,
      message: 'Question paper uploaded and parsed successfully',
      data: {
        recordId: result.recordId,
        record: result.record,
        paper: result.data
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'UPLOAD_ERROR', message: err.message }
    });
  }
}

export function getQuestionPaper(req, res) {
  try {
    const { recordId } = req.params;
    const paper = db.getQuestionPaper(recordId);
    const record = db.getConversionRecord(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    res.json({
      success: true,
      statusCode: 200,
      data: {
        record,
        paper
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

export function updateQuestion(req, res) {
  try {
    const { recordId, questionId } = req.params;
    const updates = req.body;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    let found = false;
    for (const mod of paper.modules) {
      const qIdx = mod.questions.findIndex(q => q.questionId === questionId);
      if (qIdx >= 0) {
        mod.questions[qIdx] = {
          ...mod.questions[qIdx],
          ...updates
        };
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'QUESTION_NOT_FOUND', message: 'Question not found in paper' }
      });
    }

    // Recompute verification stats
    recomputePaperVerification(paper);
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Question updated successfully',
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'UPDATE_ERROR', message: err.message }
    });
  }
}

export function addQuestion(req, res) {
  try {
    const { recordId } = req.params;
    const { moduleNumber = 1, question } = req.body;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    let targetMod = paper.modules.find(m => m.moduleNumber === Number(moduleNumber));
    if (!targetMod) {
      targetMod = {
        moduleNumber: Number(moduleNumber),
        title: `Module ${moduleNumber}`,
        questions: []
      };
      paper.modules.push(targetMod);
      paper.modules.sort((a, b) => a.moduleNumber - b.moduleNumber);
    }

    const nextQNum = (targetMod.questions.length > 0)
      ? Math.max(...targetMod.questions.map(q => q.questionNumber)) + 1
      : 1;

    const newQ = {
      questionId: `q_${moduleNumber}_${nextQNum}_${Date.now()}`,
      questionNumber: nextQNum,
      moduleNumber: Number(moduleNumber),
      questionText: question?.questionText || 'Enter question text here...',
      questionImage: question?.questionImage || null,
      options: question?.options || {
        A: { text: 'Option A', image: null },
        B: { text: 'Option B', image: null },
        C: { text: 'Option C', image: null },
        D: { text: 'Option D', image: null }
      },
      correctAnswer: question?.correctAnswer || null,
      confidence: 1.0,
      uncertainModule: false,
      validationErrors: []
    };

    targetMod.questions.push(newQ);
    recomputePaperVerification(paper);
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 201,
      message: 'Question added successfully',
      data: {
        newQuestion: newQ,
        paper
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'ADD_ERROR', message: err.message }
    });
  }
}

export function deleteQuestion(req, res) {
  try {
    const { recordId, questionId } = req.params;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    let deleted = false;
    for (const mod of paper.modules) {
      const qIdx = mod.questions.findIndex(q => q.questionId === questionId);
      if (qIdx >= 0) {
        mod.questions.splice(qIdx, 1);
        deleted = true;
        // Re-sequence question numbers in module
        mod.questions.forEach((q, idx) => {
          q.questionNumber = idx + 1;
        });
        break;
      }
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question not found' }
      });
    }

    recomputePaperVerification(paper);
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Question deleted successfully',
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DELETE_ERROR', message: err.message }
    });
  }
}

export function duplicateQuestion(req, res) {
  try {
    const { recordId, questionId } = req.params;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    let cloned = null;
    for (const mod of paper.modules) {
      const qIdx = mod.questions.findIndex(q => q.questionId === questionId);
      if (qIdx >= 0) {
        const sourceQ = mod.questions[qIdx];
        cloned = JSON.parse(JSON.stringify(sourceQ));
        cloned.questionId = `q_${mod.moduleNumber}_${Date.now()}`;
        cloned.questionNumber = mod.questions.length + 1;
        cloned.questionText = `${cloned.questionText} (Copy)`;
        mod.questions.splice(qIdx + 1, 0, cloned);
        // Re-sequence
        mod.questions.forEach((q, idx) => {
          q.questionNumber = idx + 1;
        });
        break;
      }
    }

    if (!cloned) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question not found' }
      });
    }

    recomputePaperVerification(paper);
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 201,
      message: 'Question duplicated successfully',
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DUPLICATE_ERROR', message: err.message }
    });
  }
}

export function moveQuestion(req, res) {
  try {
    const { recordId, questionId } = req.params;
    const { targetModuleNumber } = req.body;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    let movingQ = null;
    for (const mod of paper.modules) {
      const qIdx = mod.questions.findIndex(q => q.questionId === questionId);
      if (qIdx >= 0) {
        movingQ = mod.questions.splice(qIdx, 1)[0];
        // Re-sequence source module
        mod.questions.forEach((q, idx) => {
          q.questionNumber = idx + 1;
        });
        break;
      }
    }

    if (!movingQ) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question not found' }
      });
    }

    let targetMod = paper.modules.find(m => m.moduleNumber === Number(targetModuleNumber));
    if (!targetMod) {
      targetMod = {
        moduleNumber: Number(targetModuleNumber),
        title: `Module ${targetModuleNumber}`,
        questions: []
      };
      paper.modules.push(targetMod);
      paper.modules.sort((a, b) => a.moduleNumber - b.moduleNumber);
    }

    movingQ.moduleNumber = Number(targetModuleNumber);
    movingQ.uncertainModule = false;
    targetMod.questions.push(movingQ);

    // Re-sequence target module
    targetMod.questions.forEach((q, idx) => {
      q.questionNumber = idx + 1;
    });

    recomputePaperVerification(paper);
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 200,
      message: `Question moved to Module ${targetModuleNumber}`,
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'MOVE_ERROR', message: err.message }
    });
  }
}

export function reorderQuestions(req, res) {
  try {
    const { recordId } = req.params;
    const { moduleNumber, questionIds } = req.body;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    const targetMod = paper.modules.find(m => m.moduleNumber === Number(moduleNumber));
    if (!targetMod) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'MODULE_NOT_FOUND', message: 'Module not found' }
      });
    }

    const qMap = new Map(targetMod.questions.map(q => [q.questionId, q]));
    const reordered = [];

    questionIds.forEach((id, index) => {
      if (qMap.has(id)) {
        const q = qMap.get(id);
        q.questionNumber = index + 1;
        reordered.push(q);
      }
    });

    targetMod.questions = reordered;
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Questions reordered successfully',
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'REORDER_ERROR', message: err.message }
    });
  }
}

export function addModule(req, res) {
  try {
    const { recordId } = req.params;
    const { title } = req.body;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    const nextModNum = paper.modules.length > 0
      ? Math.max(...paper.modules.map(m => m.moduleNumber)) + 1
      : 1;

    paper.modules.push({
      moduleNumber: nextModNum,
      title: title || `Module ${nextModNum}`,
      questions: []
    });

    paper.metadata.totalModules = paper.modules.length;
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 201,
      message: `Module ${nextModNum} added`,
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'ADD_MODULE_ERROR', message: err.message }
    });
  }
}

export function deleteModule(req, res) {
  try {
    const { recordId, moduleNumber } = req.params;
    const paper = db.getQuestionPaper(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper record not found' }
      });
    }

    const modNum = Number(moduleNumber);
    paper.modules = paper.modules.filter(m => m.moduleNumber !== modNum);
    paper.metadata.totalModules = paper.modules.length;

    recomputePaperVerification(paper);
    db.saveQuestionPaper(recordId, paper);

    res.json({
      success: true,
      statusCode: 200,
      message: `Module ${modNum} deleted`,
      data: paper
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DELETE_MODULE_ERROR', message: err.message }
    });
  }
}

export function uploadMediaImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'NO_IMAGE', message: 'No image file uploaded' }
      });
    }

    const imgUrl = `/uploads/images/${req.file.filename}`;
    res.json({
      success: true,
      statusCode: 200,
      message: 'Image uploaded successfully',
      data: {
        filename: req.file.filename,
        url: imgUrl,
        size: req.file.size
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'IMAGE_UPLOAD_ERROR', message: err.message }
    });
  }
}

export function verifyQuestionPaper(req, res) {
  try {
    const { recordId } = req.params;
    const paper = db.getQuestionPaper(recordId);
    const record = db.getConversionRecord(recordId);

    if (!paper || !record) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper not found' }
      });
    }

    record.status = 'verified';
    record.verifiedAt = new Date().toISOString();
    record.verifiedBy = req.headers['x-user-name'] || 'COE Administrator';
    db.saveConversionRecord(record);

    db.addAuditLog({
      user: record.verifiedBy,
      role: 'COE',
      department: record.department,
      action: 'QUESTION_PAPER_VERIFIED',
      entityType: 'question_paper',
      entityId: recordId,
      details: { totalQuestions: paper.verification.totalQuestions }
    });

    res.json({
      success: true,
      statusCode: 200,
      message: 'Question paper verified successfully and ready for export',
      data: { record, paper }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'VERIFY_ERROR', message: err.message }
    });
  }
}

export async function exportQuestionPaper(req, res) {
  try {
    const { recordId } = req.params;
    const { format = 'xlsx' } = req.query; // 'xlsx' | 'json' | 'csv'
    const paper = db.getQuestionPaper(recordId);
    const record = db.getConversionRecord(recordId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Question paper not found' }
      });
    }

    const exportedBy = req.headers['x-user-name'] || 'COE Admin';
    const subCode = paper.metadata?.subjectCode || 'EXAM';
    const filename = `Question_Paper_${subCode}_${Date.now()}.${format}`;

    if (record) {
      record.exportHistory = record.exportHistory || [];
      record.exportHistory.push({
        format,
        filename,
        exportedAt: new Date().toISOString(),
        exportedBy
      });
      db.saveConversionRecord(record);
    }

    if (format === 'json') {
      const jsonData = exportQuestionPaperToJson(paper);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(jsonData);
    }

    if (format === 'csv') {
      const csvData = exportQuestionPaperToCsv(paper);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvData);
    }

    // Default: Excel
    const excelBuffer = await exportQuestionPaperToExcel(paper);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'EXPORT_ERROR', message: err.message }
    });
  }
}

function recomputePaperVerification(paper) {
  let totalQuestions = 0;
  let missingText = 0;
  let missingOptions = 0;
  let missingAnswers = 0;
  let uncertainAnswers = 0;
  let unassignedModules = 0;
  const seenNumbers = new Set();
  const duplicateNumbers = [];

  for (const mod of paper.modules) {
    totalQuestions += mod.questions.length;
    for (const q of mod.questions) {
      const errors = [];
      if (!q.questionText?.trim() && !q.questionImage) {
        missingText++;
        errors.push('Missing question text and image');
      }

      const emptyOpts = ['A', 'B', 'C', 'D'].filter(k => !q.options?.[k]?.text?.trim() && !q.options?.[k]?.image);
      if (emptyOpts.length > 0) {
        missingOptions++;
        errors.push(`Missing options: ${emptyOpts.join(', ')}`);
      }

      if (!q.correctAnswer) {
        missingAnswers++;
        q.isAnswerUncertain = true;
      } else {
        q.isAnswerUncertain = false;
      }

      if (q.isAnswerUncertain) uncertainAnswers++;
      if (q.uncertainModule) unassignedModules++;

      if (seenNumbers.has(q.questionNumber)) {
        duplicateNumbers.push(q.questionNumber);
        errors.push(`Duplicate Question #${q.questionNumber}`);
      } else {
        seenNumbers.add(q.questionNumber);
      }

      q.validationErrors = errors;
    }
  }

  const confidenceScore = totalQuestions > 0
    ? Math.max(0.4, Math.round((1 - ((missingText + missingOptions * 0.5 + missingAnswers * 0.2) / (totalQuestions * 2))) * 100) / 100)
    : 0.5;

  paper.verification = {
    totalQuestions,
    missingQuestionText: missingText,
    missingOptions,
    missingAnswers,
    duplicateQuestionNumbers: duplicateNumbers.length,
    duplicateNumbersList: duplicateNumbers,
    unassignedModules,
    uncertainAnswers,
    unreadableImages: 0,
    confidenceScore,
    isVerificationReady: totalQuestions > 0 && missingText === 0 && missingOptions === 0
  };
}

