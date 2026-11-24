import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel
  ? path.join(os.tmpdir(), 'protick_data')
  : path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

function ensureQuestionIds(paperData, usedIds = new Set()) {
  let changed = false;
  for (const module of paperData?.modules || []) {
    for (const question of module.questions || []) {
      if (!question.questionId || usedIds.has(question.questionId)) {
        question.questionId = `q_${randomUUID()}`;
        changed = true;
      }
      usedIds.add(question.questionId);
    }
  }
  return changed;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default state
const DEFAULT_STATE = {
  departments: [
    { id: 'dept_cse', code: 'CSE', name: 'Computer Science & Engineering', active: true },
    { id: 'dept_ise', code: 'ISE', name: 'Information Science & Engineering', active: true },
    { id: 'dept_ece', code: 'ECE', name: 'Electronics & Communication Engineering', active: true },
    { id: 'dept_mech', code: 'MECH', name: 'Mechanical Engineering', active: true },
    { id: 'dept_civil', code: 'CIVIL', name: 'Civil Engineering', active: true },
    { id: 'dept_aiml', code: 'AIML', name: 'Artificial Intelligence & Machine Learning', active: true }
  ],
  templates: {
    questionPaper: {
      id: 'template_qp_standard_v1',
      version: '1.0.0',
      isLocked: false,
      configuredBy: 'COE Admin',
      lastModified: new Date().toISOString(),
      standardFields: [
        'Sl.no.',
        'Questions',
        'Question image',
        'option A',
        'option A img',
        'option B',
        'option B img',
        'option C',
        'option C img',
        'option D ',
        'option D  img',
        'Key Answer'
      ],
      allowedAnswers: ['A', 'B', 'C', 'D'],
      defaultModules: 5,
      allowDynamicModules: true,
      requireCorrectAnswer: false, // Don't enforce if source doesn't specify
      requireImagesSeparated: true
    },
    studentList: {
      id: 'template_sl_standard_v1',
      version: '1.0.0',
      isLocked: true, // Locked by COE - departments cannot change
      configuredBy: 'Controller of Examinations',
      lastModified: new Date().toISOString(),
      standardColumns: [
        { key: 'serialNumber', label: 'Sl.no.', required: true, type: 'number', order: 1 },
        { key: 'studentName', label: 'Student Name', required: true, type: 'string', order: 2 },
        { key: 'usn', label: 'USN', required: true, type: 'string', pattern: '^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$', order: 3 },
        { key: 'dob', label: 'Date of Birth', required: true, type: 'date', order: 4 }
      ],
      columnSynonyms: {
        usn: ['usn', 'university seat number', 'register number', 'reg number', 'reg no', 'reg_no', 'regno', 'roll number', 'roll no', 'roll_no', 'hall ticket', 'candidate id'],
        studentName: ['student name', 'student_name', 'name of the student', 'candidate name', 'name', 'full name', 'fullname'],
        section: ['section', 'sec', 'class', 'division', 'group'],
        semester: ['semester', 'sem', 'term'],
        serialNumber: ['serial number', 'serial no', 'sl no', 'sl.no', 's.no', 'sno', 'si no', '#', 'id']
      }
    }
  },
  conversionRecords: [],
  questionPapers: {},
  studentLists: {},
  smartExtractions: {},
  universalConversions: {},
  centralStudents: [],
  auditLogs: []
};

class Database {
  constructor() {
    this.memoryState = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const memoryState = {
          ...DEFAULT_STATE,
          ...parsed,
          templates: {
            ...DEFAULT_STATE.templates,
            ...(parsed.templates || {})
          }
        };
        // Keep the site manifests aligned with the fixed supplied workbooks.
        memoryState.templates.questionPaper.standardFields = [...DEFAULT_STATE.templates.questionPaper.standardFields];
        memoryState.templates.studentList.standardColumns = DEFAULT_STATE.templates.studentList.standardColumns.map(column => ({ ...column }));
        memoryState.questionPapers ||= {};
        const usedQuestionIds = new Set();
        let migratedQuestionIds = false;
        for (const paper of Object.values(memoryState.questionPapers || {})) {
          migratedQuestionIds = ensureQuestionIds(paper, usedQuestionIds) || migratedQuestionIds;
        }
        if (migratedQuestionIds) this.persist(memoryState);
        return memoryState;
      }
    } catch (err) {
      console.error('[DB] Error loading DB, falling back to default:', err.message);
    }
    this.persist(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  persist(state = this.memoryState) {
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('[DB] Error persisting DB:', err.message);
    }
  }

  // --- Departments ---
  getDepartments() {
    return this.memoryState.departments;
  }

  // --- Templates ---
  getTemplates() {
    return this.memoryState.templates;
  }

  updateQuestionPaperTemplate(updates, user = 'COE Admin') {
    this.memoryState.templates.questionPaper = {
      ...this.memoryState.templates.questionPaper,
      ...updates,
      lastModified: new Date().toISOString(),
      configuredBy: user
    };
    this.addAuditLog({
      user,
      role: 'COE',
      action: 'UPDATE_TEMPLATE',
      entityType: 'question_paper_template',
      details: updates
    });
    this.persist();
    return this.memoryState.templates.questionPaper;
  }

  updateStudentListTemplate(updates, user = 'COE Admin') {
    if (this.memoryState.templates.studentList.isLocked && updates.overrideLock !== true) {
      throw new Error('Student List template is locked by the Controller of Examinations (COE). Only authorized COE overrides are permitted.');
    }
    this.memoryState.templates.studentList = {
      ...this.memoryState.templates.studentList,
      ...updates,
      lastModified: new Date().toISOString(),
      configuredBy: user
    };
    this.addAuditLog({
      user,
      role: 'COE',
      action: 'UPDATE_TEMPLATE',
      entityType: 'student_list_template',
      details: updates
    });
    this.persist();
    return this.memoryState.templates.studentList;
  }

  // --- Conversion Records ---
  getConversionRecords(filter = {}) {
    let list = [...this.memoryState.conversionRecords];
    if (filter.department && filter.department !== 'ALL') {
      list = list.filter(r => r.department === filter.department);
    }
    if (filter.documentType) {
      list = list.filter(r => r.documentType === filter.documentType);
    }
    if (filter.status) {
      list = list.filter(r => r.status === filter.status);
    }
    // Sort descending by uploadTime
    return list.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
  }

  getConversionRecord(id) {
    return this.memoryState.conversionRecords.find(r => r.id === id) || null;
  }

  saveConversionRecord(record) {
    const idx = this.memoryState.conversionRecords.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      this.memoryState.conversionRecords[idx] = { ...this.memoryState.conversionRecords[idx], ...record };
    } else {
      this.memoryState.conversionRecords.unshift(record);
    }
    this.persist();
    return record;
  }

  deleteConversionRecord(id) {
    this.memoryState.conversionRecords = this.memoryState.conversionRecords.filter(r => r.id !== id);
    delete this.memoryState.questionPapers[id];
    delete this.memoryState.studentLists[id];
    this.persist();
    return true;
  }

  // --- Question Papers ---
  getQuestionPaper(recordId) {
    return this.memoryState.questionPapers[recordId] || null;
  }

  saveQuestionPaper(recordId, paperData) {
    this.memoryState.questionPapers ||= {};
    const usedQuestionIds = new Set();
    for (const [savedRecordId, savedPaper] of Object.entries(this.memoryState.questionPapers)) {
      if (savedRecordId !== recordId) ensureQuestionIds(savedPaper, usedQuestionIds);
    }
    ensureQuestionIds(paperData, usedQuestionIds);
    this.memoryState.questionPapers[recordId] = {
      ...paperData,
      recordId,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    return this.memoryState.questionPapers[recordId];
  }

  // --- Student Lists ---
  getStudentList(recordId) {
    return this.memoryState.studentLists[recordId] || null;
  }

  saveStudentList(recordId, listData) {
    this.memoryState.studentLists[recordId] = {
      ...listData,
      recordId,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    return this.memoryState.studentLists[recordId];
  }

  // --- Smart Extractions ---
  getSmartExtraction(recordId) {
    return this.memoryState.smartExtractions?.[recordId] || null;
  }

  saveSmartExtraction(recordId, extractionData) {
    this.memoryState.smartExtractions = this.memoryState.smartExtractions || {};
    this.memoryState.smartExtractions[recordId] = {
      ...extractionData,
      recordId,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    return this.memoryState.smartExtractions[recordId];
  }


  // --- Universal Conversions ---
  getUniversalConversion(recordId) {
    return this.memoryState.universalConversions?.[recordId] || null;
  }

  saveUniversalConversion(recordId, conversionData) {
    this.memoryState.universalConversions = this.memoryState.universalConversions || {};
    this.memoryState.universalConversions[recordId] = {
      ...this.memoryState.universalConversions[recordId],
      ...conversionData,
      recordId,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    return this.memoryState.universalConversions[recordId];
  }

  // --- Central Student Database ---
  getCentralStudents(filter = {}) {
    let list = [...this.memoryState.centralStudents];
    if (filter.department && filter.department !== 'ALL') {
      list = list.filter(s => s.department === filter.department);
    }
    if (filter.semester) {
      list = list.filter(s => String(s.semester) === String(filter.semester));
    }
    if (filter.section) {
      list = list.filter(s => s.section.toUpperCase() === filter.section.toUpperCase());
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(s =>
        (s.usn && s.usn.toLowerCase().includes(q)) ||
        (s.studentName && s.studentName.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => (a.usn || '').localeCompare(b.usn || ''));
  }

  importToCentralStudents(records, options = {}) {
    // options: { overwriteExisting: false, user: 'COE Admin', department: 'CSE' }
    const imported = [];
    const conflicts = [];
    const updated = [];

    const existingMap = new Map();
    this.memoryState.centralStudents.forEach((student, index) => {
      if (student.usn) {
        existingMap.set(student.usn.toUpperCase(), { student, index });
      }
    });

    for (const rec of records) {
      const usnKey = (rec.usn || '').toUpperCase().trim();
      if (!usnKey) continue;

      const existing = existingMap.get(usnKey);

      if (existing) {
        if (options.overwriteExisting) {
          // Overwrite existing record
          const updatedStudent = {
            ...existing.student,
            serialNumber: rec.serialNumber || existing.student.serialNumber,
            studentName: rec.studentName || existing.student.studentName,
            section: rec.section || existing.student.section,
            semester: rec.semester || existing.student.semester,
            department: rec.department || existing.student.department,
            lastModified: new Date().toISOString(),
            modifiedBy: options.user || 'COE Admin'
          };
          this.memoryState.centralStudents[existing.index] = updatedStudent;
          updated.push(updatedStudent);
        } else {
          // Conflict detected, record for confirmation
          conflicts.push({
            existing: existing.student,
            incoming: rec
          });
        }
      } else {
        // Brand new student
        const newStudent = {
          id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          serialNumber: rec.serialNumber || (this.memoryState.centralStudents.length + 1),
          usn: usnKey,
          studentName: rec.studentName,
          section: rec.section || 'A',
          semester: Number(rec.semester) || 1,
          department: rec.department || options.department || 'CSE',
          importDate: new Date().toISOString(),
          sourceRecordId: rec.sourceRecordId || options.sourceRecordId || null,
          lastModified: new Date().toISOString(),
          isActive: true
        };
        this.memoryState.centralStudents.push(newStudent);
        existingMap.set(usnKey, { student: newStudent, index: this.memoryState.centralStudents.length - 1 });
        imported.push(newStudent);
      }
    }

    this.addAuditLog({
      user: options.user || 'COE Admin',
      role: 'COE',
      action: 'IMPORT_CENTRAL_STUDENTS',
      entityType: 'central_students',
      details: {
        importedCount: imported.length,
        updatedCount: updated.length,
        conflictCount: conflicts.length
      }
    });

    this.persist();
    return { imported, updated, conflicts };
  }

  updateCentralStudent(id, updates, user = 'COE Admin') {
    const idx = this.memoryState.centralStudents.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Student not found');
    this.memoryState.centralStudents[idx] = {
      ...this.memoryState.centralStudents[idx],
      ...updates,
      lastModified: new Date().toISOString(),
      modifiedBy: user
    };
    this.persist();
    return this.memoryState.centralStudents[idx];
  }

  deleteCentralStudent(id, user = 'COE Admin') {
    this.memoryState.centralStudents = this.memoryState.centralStudents.filter(s => s.id !== id);
    this.persist();
    return true;
  }

  // --- Audit Logs ---
  getAuditLogs(limit = 100) {
    return [...this.memoryState.auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }

  addAuditLog(entry) {
    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      user: entry.user || 'System',
      role: entry.role || 'Admin',
      department: entry.department || 'COE',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      details: entry.details || null
    };
    this.memoryState.auditLogs.unshift(logItem);
    // Keep max 1000 logs
    if (this.memoryState.auditLogs.length > 1000) {
      this.memoryState.auditLogs = this.memoryState.auditLogs.slice(0, 1000);
    }
    return logItem;
  }

  // --- Dashboard Statistics ---
  getDashboardStats(department = 'ALL') {
    let records = this.memoryState.conversionRecords;
    if (department !== 'ALL') {
      records = records.filter(r => r.department === department);
    }

    const totalUploaded = records.length;
    const successfullyConverted = records.filter(r => r.status === 'verified').length;
    const awaitingVerification = records.filter(r => r.status === 'awaiting_verification').length;
    const extractionErrors = records.filter(r => r.status === 'error').length;

    // Department-wise breakdown
    const deptStats = {};
    this.memoryState.departments.forEach(d => {
      deptStats[d.code] = {
        code: d.code,
        name: d.name,
        questionPapers: 0,
        studentLists: 0,
        total: 0,
        verified: 0,
        errors: 0
      };
    });

    this.memoryState.conversionRecords.forEach(r => {
      const code = r.department || 'CSE';
      if (!deptStats[code]) {
        deptStats[code] = { code, name: code, questionPapers: 0, studentLists: 0, total: 0, verified: 0, errors: 0 };
      }
      deptStats[code].total += 1;
      if (r.documentType === 'question_paper') deptStats[code].questionPapers += 1;
      if (r.documentType === 'student_list') deptStats[code].studentLists += 1;
      if (r.status === 'verified') deptStats[code].verified += 1;
      if (r.status === 'error') deptStats[code].errors += 1;
    });

    const centralStudentCount = this.memoryState.centralStudents.length;

    return {
      totalUploaded,
      successfullyConverted,
      awaitingVerification,
      extractionErrors,
      centralStudentCount,
      departmentStats: Object.values(deptStats),
      recentRecords: records.slice(0, 8)
    };
  }
}

export const db = new Database();

