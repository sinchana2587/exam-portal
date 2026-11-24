/**
 * Universal Intermediate Data Representation (Document Envelope)
 *
 * Provides a standardized document envelope for all format-specific extractors.
 * Supports template-specific structured payloads, preserves record provenance,
 * and maintains extraction warnings and metadata.
 */

export function createDocumentEnvelope(params = {}) {
  const {
    documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceFile = {},
    documentType = 'question_paper', // 'question_paper' | 'student_list'
    extraction = {},
    content = {},
    metadata = {}
  } = params;

  return {
    document_id: documentId,
    source_file: {
      filename: sourceFile.filename || 'unknown',
      format: (sourceFile.format || '').toLowerCase(),
      size: sourceFile.size || 0,
      mimeType: sourceFile.mimeType || 'application/octet-stream',
      originalPath: sourceFile.originalPath || null,
      checksum: sourceFile.checksum || null
    },
    document_type: documentType,
    extraction: {
      method: extraction.method || 'digital', // 'digital' | 'ocr' | 'spreadsheet' | 'docx' | 'plaintext' | 'hybrid'
      status: extraction.status || 'pending', // 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed'
      extractedAt: extraction.extractedAt || new Date().toISOString(),
      durationMs: extraction.durationMs || 0,
      warnings: Array.isArray(extraction.warnings) ? extraction.warnings : [],
      errors: Array.isArray(extraction.errors) ? extraction.errors : [],
      isScanned: Boolean(extraction.isScanned),
      pageCount: extraction.pageCount || 1,
      sheetNames: extraction.sheetNames || []
    },
    content: {
      // For QUESTION_PAPER:
      // modules: Array<{ moduleNumber, title, questions: Array<QuestionRecord> }>
      // totalQuestions: number
      // totalModules: number
      // rawText: string
      // images: Array<ImageRecord>
      //
      // For STUDENT_LIST:
      // records: Array<StudentRecord>
      // totalRecords: number
      // detectedHeaders: Array<string>
      // rawRows: Array<Object>
      // rawText: string
      ...content
    },
    metadata: {
      uploadedBy: metadata.uploadedBy || 'Institutional User',
      department: metadata.department || 'CSE',
      semester: metadata.semester || null,
      subjectName: metadata.subjectName || '',
      subjectCode: metadata.subjectCode || '',
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: metadata.tags || []
    }
  };
}

/**
 * Creates a Question Record preserving provenance
 */
export function createQuestionRecord(data = {}) {
  return {
    id: data.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    questionNumber: Number(data.questionNumber) || 1,
    originalQuestionNumber: data.originalQuestionNumber || data.questionNumber || null,
    moduleNumber: Number(data.moduleNumber) || 1,
    questionText: data.questionText || '',
    questionImage: data.questionImage || null,
    marks: data.marks !== undefined && data.marks !== null ? Number(data.marks) : null,
    options: {
      A: {
        text: data.options?.A?.text || (typeof data.options?.A === 'string' ? data.options.A : ''),
        image: data.options?.A?.image || null
      },
      B: {
        text: data.options?.B?.text || (typeof data.options?.B === 'string' ? data.options.B : ''),
        image: data.options?.B?.image || null
      },
      C: {
        text: data.options?.C?.text || (typeof data.options?.C === 'string' ? data.options.C : ''),
        image: data.options?.C?.image || null
      },
      D: {
        text: data.options?.D?.text || (typeof data.options?.D === 'string' ? data.options.D : ''),
        image: data.options?.D?.image || null
      }
    },
    correctAnswer: data.correctAnswer ? String(data.correctAnswer).trim().toUpperCase() : null,
    provenance: {
      sourcePage: data.provenance?.sourcePage || null,
      sourceRow: data.provenance?.sourceRow || null,
      rawStatement: data.provenance?.rawStatement || data.questionText || '',
      confidence: data.provenance?.confidence !== undefined ? data.provenance.confidence : 1.0
    }
  };
}

/**
 * Creates a Student Record preserving provenance
 */
export function createStudentRecord(data = {}) {
  return {
    id: data.id || `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    serialNumber: Number(data.serialNumber) || 1,
    studentName: data.studentName ? String(data.studentName).trim() : '',
    usn: data.usn ? String(data.usn).trim().toUpperCase() : '',
    dateOfBirth: data.dateOfBirth || data.dob || '',
    section: data.section || 'A',
    semester: data.semester ? Number(data.semester) : null,
    department: data.department || '',
    provenance: {
      sourcePage: data.provenance?.sourcePage || null,
      sourceRow: data.provenance?.sourceRow || null,
      originalValues: data.provenance?.originalValues || {},
      rawLine: data.provenance?.rawLine || '',
      confidence: data.provenance?.confidence !== undefined ? data.provenance.confidence : 1.0,
      mappingSourceFields: data.provenance?.mappingSourceFields || {}
    }
  };
}
