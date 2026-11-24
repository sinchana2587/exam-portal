import { db } from '../database/db.js';
import {
  exportStudentListToExcel,
  exportStudentListToCsv,
  exportStudentListToJson
} from '../engine/exporters/studentListExporter.js';

export function getCentralStudents(req, res) {
  try {
    const { department, semester, section, search } = req.query;
    const students = db.getCentralStudents({ department, semester, section, search });

    res.json({
      success: true,
      statusCode: 200,
      message: 'Central students retrieved',
      data: {
        total: students.length,
        students
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'CENTRAL_FETCH_ERROR', message: err.message }
    });
  }
}

export function addCentralStudent(req, res) {
  try {
    const { usn, studentName, section = 'A', semester = 1, department = 'CSE' } = req.body;
    const user = req.headers['x-user-name'] || 'COE Administrator';

    if (!usn || !studentName) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: { code: 'MISSING_FIELDS', message: 'USN and Student Name are required.' }
      });
    }

    const result = db.importToCentralStudents([{
      usn: usn.toUpperCase().trim(),
      studentName: studentName.trim(),
      section: section.toUpperCase().trim(),
      semester: parseInt(semester, 10) || 1,
      department
    }], { overwriteExisting: false, user });

    if (result.conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        error: { code: 'USN_EXISTS', message: `Student with USN ${usn} already exists in the central database.` }
      });
    }

    res.json({
      success: true,
      statusCode: 201,
      message: 'Student added to central database',
      data: result.imported[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'ADD_STUDENT_ERROR', message: err.message }
    });
  }
}

export function updateCentralStudent(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.headers['x-user-name'] || 'COE Administrator';

    const updated = db.updateCentralStudent(id, updates, user);
    res.json({
      success: true,
      statusCode: 200,
      message: 'Central student record updated',
      data: updated
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      error: { code: 'UPDATE_STUDENT_ERROR', message: err.message }
    });
  }
}

export function deleteCentralStudent(req, res) {
  try {
    const { id } = req.params;
    const user = req.headers['x-user-name'] || 'COE Administrator';
    db.deleteCentralStudent(id, user);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Student removed from central database'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DELETE_STUDENT_ERROR', message: err.message }
    });
  }
}

export async function exportCentralRoster(req, res) {
  try {
    const { format = 'xlsx', department, semester } = req.query;
    const students = db.getCentralStudents({ department, semester });
    const filename = `Central_Student_Roster_${Date.now()}.${format}`;

    if (format === 'json') {
      const json = exportStudentListToJson(students, { department: department || 'ALL' });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(json);
    }

    if (format === 'csv') {
      const csv = exportStudentListToCsv(students);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    const excel = await exportStudentListToExcel(students);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excel);
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'EXPORT_ERROR', message: err.message }
    });
  }
}

