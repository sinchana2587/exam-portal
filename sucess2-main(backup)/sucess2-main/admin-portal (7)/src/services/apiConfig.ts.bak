const metaEnv =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  ({} as Record<string, string | undefined>);

let defaultHost = '127.0.0.1';
if (
  typeof window !== 'undefined' &&
  window.location &&
  window.location.hostname &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
) {
  defaultHost = window.location.hostname;
}

const envUrl = metaEnv.VITE_API_BASE_URL;
let resolvedUrl = (envUrl && !envUrl.includes(':8080') ? envUrl : `http://${defaultHost}:8081/api/v1`).trim();
if (defaultHost !== '127.0.0.1' && defaultHost !== 'localhost') {
  resolvedUrl = resolvedUrl.replace(/127\.0\.0\.1|localhost/, defaultHost);
}

export const API_CONFIG = {
  baseUrl: resolvedUrl.replace(/\/+$/, ''),
  requestTimeoutMs: 15000,
};

/**
 * Documented Java Spring Boot REST API endpoint contracts for backend integration.
 * All services execute live HTTP requests against these endpoints.
 */
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    changePassword: '/auth/change-password',
    updateProfile: '/auth/profile',
    updateThemePreference: '/auth/preferences/theme',
  },
  principal: {
    dashboardOverview: '/principal/dashboard',
    departments: '/principal/departments',
    departmentWorkspace: (deptId: string | number) => `/principal/departments/${deptId}/workspace`,
    hods: '/principal/hods',
    hodById: (id: string) => `/principal/hods/${id}`,
    replaceHod: (deptId: string) => `/principal/departments/${deptId}/replace-hod`,
    reportsOverview: '/principal/reports/results',
    reportsExport: '/principal/reports/export',
    auditLogs: '/principal/audit-logs',
  },
  hod: {
    dashboardOverview: '/hod/dashboard',
    promoteStudents: '/hod/student-lists/promote',
    graduateStudents: '/hod/student-lists/graduate',
    departmentEnrollment: '/hod/enrollment/summary',
    academicContext: '/hod/academic-context',
    subjects: '/hod/subjects',
    subjectById: (id: string) => `/hod/subjects/${id}`,
    studentLists: '/hod/student-lists',
    studentListUpload: '/hod/student-lists/upload',
    studentListReplace: '/hod/student-lists/replace',
    studentListImport: '/hod/student-lists/import',
    studentRecord: (id: string) => `/hod/students/${id}`,
    studentConversions: '/hod/student-lists/conversions',
    studentConversionById: (conversionId: string) => `/hod/student-lists/conversions/${conversionId}`,
    studentConversionRecords: (conversionId: string) =>
      `/hod/student-lists/conversions/${conversionId}/records`,
    studentConversionValidate: (conversionId: string) =>
      `/hod/student-lists/conversions/${conversionId}/validate`,
    studentConversionExcel: (conversionId: string) =>
      `/hod/student-lists/conversions/${conversionId}/excel`,
    questions: '/hod/questions',
    questionsUpload: '/hod/questions/upload',
    questionBankImport: '/hod/question-banks/import',
    questionBankParseExcel: '/hod/question-banks/parse-excel',
    questionConversions: '/hod/question-banks/conversions',
    questionConversionById: (conversionId: string) =>
      `/hod/question-banks/conversions/${conversionId}`,
    questionConversionRecords: (conversionId: string) =>
      `/hod/question-banks/conversions/${conversionId}/records`,
    questionConversionValidate: (conversionId: string) =>
      `/hod/question-banks/conversions/${conversionId}/validate`,
    questionConversionExcel: (conversionId: string) =>
      `/hod/question-banks/conversions/${conversionId}/excel`,
    questionBlueprint: (subjectId: string) => `/hod/subjects/${subjectId}/blueprint`,
    questionBlueprintSets: (subjectId: string) => `/hod/subjects/${subjectId}/question-sets`,
    publishQuestionSets: (subjectId: string) => `/hod/subjects/${subjectId}/question-sets/publish`,
    courseOutcomes: (subjectId: string) => `/hod/subjects/${subjectId}/course-outcomes`,
    courseOutcomeFile: (subjectId: string, documentId: string) =>
      `/hod/subjects/${subjectId}/course-outcomes/${documentId}/file`,
    keyCorrections: '/hod/key-corrections',
    examStatus: '/hod/examinations',
    releasedResults: '/hod/results',
    auditLogs: '/hod/audit-logs',
  },
};
