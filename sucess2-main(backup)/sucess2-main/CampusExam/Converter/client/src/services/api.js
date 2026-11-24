import axios from 'axios';

const API_BASE = '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to inject active user role & department
apiClient.interceptors.request.use(config => {
  const role = localStorage.getItem('protick_user_role') || 'COE';
  const name = localStorage.getItem('protick_user_name') || 'COE Administrator';
  const dept = localStorage.getItem('protick_user_dept') || 'ALL';

  config.headers['x-user-role'] = role;
  config.headers['x-user-name'] = name;
  config.headers['x-user-department'] = dept;
  return config;
});

export const api = {
  // Health
  getHealth: () => apiClient.get('/health').then(res => res.data),

  // Dashboard
  getDashboardStats: (department = 'ALL') =>
    apiClient.get('/dashboard/stats', { params: { department } }).then(res => res.data),

  // Templates
  getTemplates: () => apiClient.get('/templates').then(res => res.data),
  updateQuestionPaperTemplate: (data) => apiClient.put('/templates/question-paper', data).then(res => res.data),
  updateStudentListTemplate: (data) => apiClient.put('/templates/student-list', data).then(res => res.data),

  // Question Paper Converter
  uploadQuestionPaper: (formData) =>
    apiClient.post('/question-paper/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  getQuestionPaper: (recordId) =>
    apiClient.get(`/question-paper/${recordId}`).then(res => res.data),
  updateQuestion: (recordId, questionId, updates) =>
    apiClient.put(`/question-paper/${recordId}/questions/${questionId}`, updates).then(res => res.data),
  addQuestion: (recordId, moduleNumber, question) =>
    apiClient.post(`/question-paper/${recordId}/questions`, { moduleNumber, question }).then(res => res.data),
  deleteQuestion: (recordId, questionId) =>
    apiClient.delete(`/question-paper/${recordId}/questions/${questionId}`).then(res => res.data),
  duplicateQuestion: (recordId, questionId) =>
    apiClient.post(`/question-paper/${recordId}/questions/${questionId}/duplicate`).then(res => res.data),
  moveQuestion: (recordId, questionId, targetModuleNumber) =>
    apiClient.post(`/question-paper/${recordId}/questions/${questionId}/move`, { targetModuleNumber }).then(res => res.data),
  reorderQuestions: (recordId, moduleNumber, questionIds) =>
    apiClient.post(`/question-paper/${recordId}/reorder`, { moduleNumber, questionIds }).then(res => res.data),
  addModule: (recordId, title) =>
    apiClient.post(`/question-paper/${recordId}/modules`, { title }).then(res => res.data),
  deleteModule: (recordId, moduleNumber) =>
    apiClient.delete(`/question-paper/${recordId}/modules/${moduleNumber}`).then(res => res.data),
  uploadMediaImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post('/question-paper/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },
  verifyQuestionPaper: (recordId) =>
    apiClient.post(`/question-paper/${recordId}/verify`).then(res => res.data),
  getQuestionPaperExportUrl: (recordId, format) =>
    `/api/question-paper/${recordId}/export?format=${format}`,

  // Student List Converter
  uploadStudentList: (formData) =>
    apiClient.post('/student-list/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  getStudentList: (recordId) =>
    apiClient.get(`/student-list/${recordId}`).then(res => res.data),
  updateStudentRow: (recordId, studentId, updates) =>
    apiClient.put(`/student-list/${recordId}/records/${studentId}`, updates).then(res => res.data),
  addStudentRow: (recordId, studentData) =>
    apiClient.post(`/student-list/${recordId}/records`, studentData).then(res => res.data),
  deleteStudentRow: (recordId, studentId) =>
    apiClient.delete(`/student-list/${recordId}/records/${studentId}`).then(res => res.data),
  verifyStudentList: (recordId) =>
    apiClient.post(`/student-list/${recordId}/verify`).then(res => res.data),
  importToCentralDatabase: (recordId, overwriteExisting = false) =>
    apiClient.post(`/student-list/${recordId}/import-central`, { overwriteExisting }).then(res => res.data),
  getStudentListExportUrl: (recordId, format) =>
    `/api/student-list/${recordId}/export?format=${format}`,

  // Central Student Database
  getCentralStudents: (filter = {}) =>
    apiClient.get('/central-students', { params: filter }).then(res => res.data),
  addCentralStudent: (studentData) =>
    apiClient.post('/central-students', studentData).then(res => res.data),
  updateCentralStudent: (id, updates) =>
    apiClient.put(`/central-students/${id}`, updates).then(res => res.data),
  deleteCentralStudent: (id) =>
    apiClient.delete(`/central-students/${id}`).then(res => res.data),
  getCentralExportUrl: (format = 'xlsx', filter = {}) => {
    const params = new URLSearchParams({ format, ...filter });
    return `/api/central-students/export?${params.toString()}`;
  },

  // Conversion History
  getHistory: (filter = {}) =>
    apiClient.get('/history', { params: filter }).then(res => res.data),
  getDownloadOriginalUrl: (recordId) =>
    `/api/history/${recordId}/download-original`,
  reprocessDocument: (recordId) =>
    apiClient.post(`/history/${recordId}/reprocess`).then(res => res.data),
  deleteRecord: (recordId) =>
    apiClient.delete(`/history/${recordId}`).then(res => res.data),
  getAuditLogs: () =>
    apiClient.get('/history/audit-logs').then(res => res.data),

  // Automated Sample Tests
  listSampleDocuments: () =>
    apiClient.get('/samples').then(res => res.data),
  runSampleTest: (testId) =>
    apiClient.post(`/samples/run/${testId}`).then(res => res.data),
  runAllTests: () =>
    apiClient.post('/samples/run-all').then(res => res.data)
};

