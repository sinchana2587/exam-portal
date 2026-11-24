import { API_ENDPOINTS } from './apiConfig';
import { apiDownloadBlob, apiRequest, ApiClientError } from './apiClient';
import { triggerBlobDownload } from '../utils/exportUtils';
import { AuthUser, CourseOutcomeDocumentRevision, Subject } from '../types';

export const MAX_COURSE_OUTCOMES_PDF_BYTES = 50 * 1024 * 1024;

function buildHodContextHeaders(actor: AuthUser): Record<string, string> {
  if (!actor.id || !actor.departmentId || !actor.departmentCode) {
    throw new ApiClientError(
      'Authenticated HOD department context is required.',
      403,
      'DEPARTMENT_MISMATCH'
    );
  }
  return {
    'x-hod-user-id': actor.id,
    'x-hod-department-id': actor.departmentId,
    'x-hod-department-code': actor.departmentCode,
    'x-hod-user-name': actor.fullName || actor.username || actor.id,
  };
}

/**
 * Validates that the selected file is a genuine non-empty PDF document within size limits.
 * Does NOT perform OCR, text extraction, or question conversion.
 */
export async function validateCourseOutcomePdfFile(file: File): Promise<string | null> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.pdf')) {
    return 'Unsupported file format. Course Outcomes must be uploaded strictly as a .pdf document.';
  }
  if (file.type && file.type !== 'application/pdf' && file.type !== 'application/x-pdf') {
    return `Invalid file MIME type "${file.type}". Please select a valid PDF document.`;
  }
  if (file.size <= 0) {
    return 'The selected PDF file is empty (0 bytes).';
  }
  if (file.size > MAX_COURSE_OUTCOMES_PDF_BYTES) {
    return 'Course Outcomes PDF exceeds the 50 MB upload limit.';
  }

  try {
    const headerSlice = await file.slice(0, 8).text();
    if (!headerSlice.startsWith('%PDF-')) {
      return 'The selected file does not contain a valid PDF header (%PDF-). Please select a genuine PDF document.';
    }
  } catch {
    return 'Unable to read the selected PDF file header.';
  }

  return null;
}

export const courseOutcomeService = {
  async getRevisions(
    subjectId: string,
    actor: AuthUser
  ): Promise<CourseOutcomeDocumentRevision[]> {
    const res = await apiRequest<CourseOutcomeDocumentRevision[]>(
      API_ENDPOINTS.hod.courseOutcomes(subjectId),
      {
        method: 'GET',
        headers: buildHodContextHeaders(actor),
      }
    );
    return Array.isArray(res.data) ? res.data : [];
  },

  async uploadCourseOutcomePdf(params: {
    file: File;
    subject: Subject;
    actor: AuthUser;
    notes?: string;
  }): Promise<{
    uploadedRevision: CourseOutcomeDocumentRevision;
    revisions: CourseOutcomeDocumentRevision[];
  }> {
    const validationErr = await validateCourseOutcomePdfFile(params.file);
    if (validationErr) {
      throw new ApiClientError(validationErr, 400, 'UNSUPPORTED_FORMAT');
    }

    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('semesterNumber', String(params.subject.semesterNumber));
    formData.append('subjectId', params.subject.id);
    formData.append('subjectCode', params.subject.code);
    formData.append('subjectName', params.subject.name);
    if (params.notes?.trim()) {
      formData.append('notes', params.notes.trim());
    }

    const res = await apiRequest<{
      uploadedRevision: CourseOutcomeDocumentRevision;
      revisions: CourseOutcomeDocumentRevision[];
    }>(
      API_ENDPOINTS.hod.courseOutcomes(params.subject.id),
      {
        method: 'POST',
        headers: buildHodContextHeaders(params.actor),
        body: formData,
      },
      60000
    );

    return res.data;
  },

  async downloadCourseOutcomePdf(params: {
    subjectId: string;
    documentId: string;
    fallbackFileName: string;
    actor: AuthUser;
  }): Promise<string> {
    const { blob, fileName } = await apiDownloadBlob(
      API_ENDPOINTS.hod.courseOutcomeFile(params.subjectId, params.documentId),
      params.fallbackFileName,
      {
        method: 'GET',
        headers: buildHodContextHeaders(params.actor),
      }
    );
    triggerBlobDownload(blob, fileName);
    return fileName;
  },
};
