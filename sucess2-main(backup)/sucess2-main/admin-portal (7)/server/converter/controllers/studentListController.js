import { processDocumentConversion } from '../engine/conversionEngine.js';
import { db } from '../database/db.js';
import {
  exportStudentListToExcel,
  exportStudentListToCsv,
  exportStudentListToJson
} from '../engine/exporters/studentListExporter.js';

export async function uploadStudentList(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'MISSING_FILE', message: 'No student list file was uploaded.' }
      });
    }

    const {
      department = 'CSE',
      semester = 5
    } = req.body;

    const uploadedBy = req.headers['x-user-name'] || 'Department Coordinator';

    const result = await processDocumentConversion(req.file, {
      documentType: 'student_list',
      department,
      semester: parseInt(semester, 10) || 5,
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
      message: 'Student list uploaded and parsed successfully',
      data: {
        recordId: result.recordId,
        record: result.record,
        listData: result.data
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

export function getStudentList(req, res) {
  try {
    const { recordId } = req.params;
    const listData = db.getStudentList(recordId);
    const record = db.getConversionRecord(recordId);

    if (!listData) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list record not found' }
      });
    }

    res.json({
      success: true,
      statusCode: 200,
      data: {
        record,
        listData
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

export function updateStudentRow(req, res) {
  try {
    const { recordId, studentId } = req.params;
    const updates = req.body;
    const listData = db.getStudentList(recordId);

    if (!listData) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list not found' }
      });
    }

    const rowIdx = listData.records.findIndex(r => r.id === studentId);
    if (rowIdx === -1) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'ROW_NOT_FOUND', message: 'Student record not found in list' }
      });
    }

    listData.records[rowIdx] = {
      ...listData.records[rowIdx],
      ...updates
    };

    // Revalidate the list
    revalidateStudentList(listData);
    db.saveStudentList(recordId, listData);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Student record updated',
      data: listData
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'UPDATE_ERROR', message: err.message }
    });
  }
}

export function addStudentRow(req, res) {
  try {
    const { recordId } = req.params;
    const { usn, studentName, section = 'A', semester = 1, department = 'CSE' } = req.body;
    const listData = db.getStudentList(recordId);

    if (!listData) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list not found' }
      });
    }

    const nextSl = listData.records.length > 0
      ? Math.max(...listData.records.map(r => r.serialNumber || 0)) + 1
      : 1;

    const newRecord = {
      id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      serialNumber: nextSl,
      usn: (usn || '').toUpperCase().trim(),
      studentName: (studentName || '').trim(),
      section: (section || 'A').toUpperCase().trim(),
      semester: parseInt(semester, 10) || 1,
      department,
      validationErrors: [],
      validationStatus: 'valid'
    };

    listData.records.push(newRecord);
    revalidateStudentList(listData);
    db.saveStudentList(recordId, listData);

    res.json({
      success: true,
      statusCode: 201,
      message: 'Student record added',
      data: {
        newRecord,
        listData
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

export function deleteStudentRow(req, res) {
  try {
    const { recordId, studentId } = req.params;
    const listData = db.getStudentList(recordId);

    if (!listData) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list not found' }
      });
    }

    listData.records = listData.records.filter(r => r.id !== studentId);
    // Re-sequence serial numbers
    listData.records.forEach((r, idx) => {
      r.serialNumber = idx + 1;
    });

    revalidateStudentList(listData);
    db.saveStudentList(recordId, listData);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Student record deleted',
      data: listData
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DELETE_ERROR', message: err.message }
    });
  }
}

export function verifyStudentList(req, res) {
  try {
    const { recordId } = req.params;
    const listData = db.getStudentList(recordId);
    const record = db.getConversionRecord(recordId);

    if (!listData || !record) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list not found' }
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
      action: 'STUDENT_LIST_VERIFIED',
      entityType: 'student_list',
      entityId: recordId,
      details: { totalRecords: listData.records.length }
    });

    res.json({
      success: true,
      statusCode: 200,
      message: 'Student list verified successfully',
      data: { record, listData }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'VERIFY_ERROR', message: err.message }
    });
  }
}

export function importToCentralDatabase(req, res) {
  try {
    const { recordId } = req.params;
    const { overwriteExisting = false } = req.body;
    const listData = db.getStudentList(recordId);
    const record = db.getConversionRecord(recordId);

    if (!listData) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list not found' }
      });
    }

    const userName = req.headers['x-user-name'] || 'COE Administrator';

    const result = db.importToCentralStudents(listData.records, {
      overwriteExisting,
      user: userName,
      department: record?.department || 'CSE',
      sourceRecordId: recordId
    });

    if (result.conflicts.length > 0 && !overwriteExisting) {
      return res.json({
        success: false,
        statusCode: 409,
        requiresConfirmation: true,
        message: `${result.conflicts.length} USN conflict(s) detected in Central Student Database. Administrator confirmation required before overwriting.`,
        data: {
          conflicts: result.conflicts,
          imported: result.imported
        }
      });
    }

    // Mark list as imported
    listData.importedToCentral = true;
    listData.importedAt = new Date().toISOString();
    db.saveStudentList(recordId, listData);

    if (record) {
      record.importedToCentral = true;
      db.saveConversionRecord(record);
    }

    res.json({
      success: true,
      statusCode: 200,
      message: `Successfully imported ${result.imported.length} new records and updated ${result.updated.length} records in Central Student Database.`,
      data: {
        importedCount: result.imported.length,
        updatedCount: result.updated.length,
        conflictsResolved: result.conflicts.length
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'IMPORT_ERROR', message: err.message }
    });
  }
}

export async function exportStudentList(req, res) {
  try {
    const { recordId } = req.params;
    const { format = 'xlsx' } = req.query; // 'xlsx' | 'json' | 'csv'
    const listData = db.getStudentList(recordId);
    const record = db.getConversionRecord(recordId);

    if (!listData) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Student list not found' }
      });
    }

    const exportedBy = req.headers['x-user-name'] || 'COE Admin';
    const dept = record?.department || 'CSE';
    const filename = `Student_List_${dept}_${Date.now()}.${format}`;

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
      const jsonData = exportStudentListToJson(listData.records, { department: dept });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(jsonData);
    }

    if (format === 'csv') {
      const csvData = exportStudentListToCsv(listData.records);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvData);
    }

    // Default: Excel
    const excelBuffer = await exportStudentListToExcel(listData.records);
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

function revalidateStudentList(listData) {
  const seenUsns = new Map();
  const duplicates = [];
  let validCount = 0;
  let duplicateCount = 0;
  let missingFieldsCount = 0;
  let invalidSemesterCount = 0;

  listData.records.forEach((r, idx) => {
    const errors = [];
    const usn = (r.usn || '').toUpperCase().trim();
    const name = (r.studentName || '').trim();
    const sem = parseInt(r.semester, 10);

    if (!usn) {
      errors.push('Missing USN');
      missingFieldsCount++;
    }

    if (!name) {
      errors.push('Missing Student Name');
      missingFieldsCount++;
    }

    if (isNaN(sem) || sem < 1 || sem > 8) {
      errors.push(`Invalid Semester (${r.semester})`);
      invalidSemesterCount++;
    }

    let isDup = false;
    if (usn) {
      if (seenUsns.has(usn)) {
        isDup = true;
        duplicateCount++;
        errors.push(`Duplicate USN detected (seen at Sl #${seenUsns.get(usn).serialNumber})`);
      } else {
        seenUsns.set(usn, { serialNumber: r.serialNumber || (idx + 1), index: idx });
      }
    }

    r.isDuplicate = isDup;
    r.validationErrors = errors;
    r.validationStatus = errors.length === 0 ? 'valid' : isDup ? 'duplicate' : 'error';

    if (isDup) duplicates.push(r);
    if (errors.length === 0) validCount++;
  });

  listData.duplicateRecords = duplicates;
  listData.summary = {
    totalRows: listData.records.length,
    validCount,
    duplicateUsnCount: duplicateCount,
    missingFieldsCount,
    invalidSemesterCount,
    confidenceScore: listData.records.length > 0 ? Math.round((validCount / listData.records.length) * 100) / 100 : 0
  };
}

