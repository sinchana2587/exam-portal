import { db } from '../database/db.js';

export function getTemplates(req, res) {
  try {
    const templates = db.getTemplates();
    res.json({
      success: true,
      statusCode: 200,
      message: 'Reference templates retrieved',
      data: templates
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'TEMPLATE_FETCH_ERROR', message: err.message }
    });
  }
}

export function updateQuestionPaperTemplate(req, res) {
  try {
    const userRole = req.headers['x-user-role'] || 'COE';
    if (userRole !== 'COE' && userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: { code: 'FORBIDDEN', message: 'Only authorized Controller of Examinations (COE) / Admin can modify reference templates.' }
      });
    }

    const updates = req.body;
    const userName = req.headers['x-user-name'] || 'COE Administrator';
    const updated = db.updateQuestionPaperTemplate(updates, userName);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Question Paper Reference Template updated successfully',
      data: updated
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      error: { code: 'TEMPLATE_UPDATE_ERROR', message: err.message }
    });
  }
}

export function updateStudentListTemplate(req, res) {
  try {
    const userRole = req.headers['x-user-role'] || 'COE';
    if (userRole !== 'COE' && userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: { code: 'FORBIDDEN', message: 'Only authorized Controller of Examinations (COE) can modify student list templates.' }
      });
    }

    const updates = req.body;
    const userName = req.headers['x-user-name'] || 'COE Administrator';
    const updated = db.updateStudentListTemplate(updates, userName);

    res.json({
      success: true,
      statusCode: 200,
      message: 'Student List Reference Template updated successfully',
      data: updated
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      error: { code: 'TEMPLATE_UPDATE_ERROR', message: err.message }
    });
  }
}

