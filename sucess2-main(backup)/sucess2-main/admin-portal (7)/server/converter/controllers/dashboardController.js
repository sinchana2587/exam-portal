import { db } from '../database/db.js';

export function getDashboardStats(req, res) {
  try {
    const { department = 'ALL' } = req.query;
    const stats = db.getDashboardStats(department);
    const departments = db.getDepartments();

    res.json({
      success: true,
      statusCode: 200,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        ...stats,
        departments
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'DASHBOARD_ERROR', message: err.message }
    });
  }
}

