import {
  CourseOutcomeStatement,
  CourseOutcomeStatus,
  CourseOutcomeSubmission,
  DepartmentCode,
} from '../types/examination';
import { apiClient } from './apiClient';

export interface CourseOutcomeFilterParams {
  department?: DepartmentCode | 'ALL';
  semester?: number | 'ALL';
  subject?: string;
  status?: CourseOutcomeStatus | 'ALL';
  fromDate?: string;
  toDate?: string;
}

export interface ReviewCourseOutcomeInput {
  status: CourseOutcomeStatus;
  internalReviewNotes?: string;
  clarificationNotes?: string;
  courseOutcomeStatements: CourseOutcomeStatement[];
}

export const courseOutcomeService = {
  async getCourseOutcomeSubmissions(
    filters?: CourseOutcomeFilterParams
  ): Promise<CourseOutcomeSubmission[]> {
    const params = new URLSearchParams();
    if (filters?.department && filters.department !== 'ALL') {
      params.set('department', filters.department);
    }
    if (filters?.semester !== undefined && filters.semester !== 'ALL') {
      params.set('semester', String(filters.semester));
    }
    if (filters?.subject?.trim()) {
      params.set('subject', filters.subject.trim());
    }
    if (filters?.status && filters.status !== 'ALL') {
      params.set('status', filters.status);
    }
    if (filters?.fromDate) {
      params.set('fromDate', filters.fromDate);
    }
    if (filters?.toDate) {
      params.set('toDate', filters.toDate);
    }
    const qs = params.toString();
    const res = await apiClient.centralRequest<CourseOutcomeSubmission[]>(
      `/course-outcomes${qs ? `?${qs}` : ''}`,
      { method: 'GET' }
    );
    return res.data;
  },

  async getCourseOutcomeSubmission(
    submissionId: string
  ): Promise<CourseOutcomeSubmission> {
    const res = await apiClient.centralRequest<CourseOutcomeSubmission>(
      `/course-outcomes/${encodeURIComponent(submissionId)}`,
      { method: 'GET' }
    );
    return res.data;
  },

  async fetchCourseOutcomePdfBlob(
    submissionId: string,
    revisionNumber: number,
    disposition: 'inline' | 'attachment'
  ): Promise<{ blob: Blob; contentType: string; filename?: string }> {
    return apiClient.centralBlobRequest(
      `/course-outcomes/${encodeURIComponent(submissionId)}/revisions/${encodeURIComponent(
        String(revisionNumber)
      )}/document?disposition=${encodeURIComponent(disposition)}`,
      { method: 'GET' }
    );
  },

  async reviewCourseOutcomeSubmission(
    submissionId: string,
    payload: ReviewCourseOutcomeInput
  ): Promise<CourseOutcomeSubmission> {
    if (
      payload.status === 'Clarification Requested' &&
      !payload.clarificationNotes?.trim()
    ) {
      throw new Error(
        'Please enter a clarification message for the submitting HOD before requesting clarification.'
      );
    }

    const res = await apiClient.centralRequest<CourseOutcomeSubmission>(
      `/course-outcomes/${encodeURIComponent(submissionId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({
          status: payload.status,
          internalReviewNotes: payload.internalReviewNotes?.trim() || '',
          clarificationNotes: payload.clarificationNotes?.trim() || '',
          courseOutcomeStatements: payload.courseOutcomeStatements
            .map((item) => ({
              id: item.id,
              code: item.code.trim(),
              statement: item.statement.trim(),
            }))
            .filter((item) => item.code || item.statement),
        }),
      }
    );
    return res.data;
  },
};
