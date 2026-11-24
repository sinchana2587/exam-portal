import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError } from './apiClient';
import { AuthUser, Subject, SubjectStatus } from '../types';

export interface SubjectInputPayload {
  code: string;
  name: string;
  semesterNumber: number;
  academicYearId: string;
  moduleCount: number;
  applicableSections?: string[];
}

function normalizeSubjectsResponse(raw: unknown): Subject[] {
  let list: unknown = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.subjects)) list = obj.subjects;
    else if (Array.isArray(obj.content)) list = obj.content;
    else if (Array.isArray(obj.items)) list = obj.items;
  }

  if (!Array.isArray(list)) {
    throw new ApiClientError(
      'Unexpected subject response format returned by the backend.',
      502,
      'INVALID_RESPONSE'
    );
  }

  return list.filter(
    (item): item is Subject =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as Subject).id === 'string' &&
      typeof (item as Subject).code === 'string' &&
      typeof (item as Subject).semesterNumber === 'number'
  );
}

export const subjectService = {
  async getDepartmentSubjects(
    departmentId: string,
    semesterNumber?: number,
    signal?: AbortSignal
  ): Promise<Subject[]> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated department scope is required.', 403);
    }

    const params = new URLSearchParams({ departmentId });
    if (typeof semesterNumber === 'number') {
      params.set('semesterNumber', String(semesterNumber));
    }
    const res = await apiRequest<unknown>(
      `${API_ENDPOINTS.hod.subjects}?${params.toString()}`,
      { signal }
    );
    return normalizeSubjectsResponse(res.data);
  },

  async createSubject(
    payload: SubjectInputPayload,
    actor: AuthUser
  ): Promise<Subject> {
    if (!actor.departmentId || !actor.departmentCode) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }

    const cleanCode = payload.code.trim();
    const cleanName = payload.name.trim();
    if (!cleanCode || !cleanName) {
      throw new ApiClientError('Subject Code and Subject Name are required.', 400);
    }
    if (!Number.isInteger(payload.moduleCount) || payload.moduleCount < 1 || payload.moduleCount > 12) {
      throw new ApiClientError('Module count must be between 1 and 12.', 400);
    }

    const res = await apiRequest<Subject>(API_ENDPOINTS.hod.subjects, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        code: cleanCode,
        name: cleanName,
      }),
    });
    return res.data;
  },

  async updateSubject(
    subjectId: string,
    payload: Omit<SubjectInputPayload, 'semesterNumber' | 'academicYearId'>,
    actor: AuthUser
  ): Promise<Subject> {
    if (!actor.departmentId) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }
    const cleanCode = payload.code.trim();
    const cleanName = payload.name.trim();
    if (!cleanCode || !cleanName) {
      throw new ApiClientError('Subject Code and Subject Name are required.', 400);
    }
    if (!Number.isInteger(payload.moduleCount) || payload.moduleCount < 1 || payload.moduleCount > 12) {
      throw new ApiClientError('Module count must be between 1 and 12.', 400);
    }

    const res = await apiRequest<Subject>(API_ENDPOINTS.hod.subjectById(subjectId), {
      method: 'PATCH',
      body: JSON.stringify({
        ...payload,
        code: cleanCode,
        name: cleanName,
      }),
    });
    return res.data;
  },

  async changeSubjectStatus(
    subjectId: string,
    status: SubjectStatus,
    actor: AuthUser
  ): Promise<Subject> {
    if (!actor.departmentId) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }
    const res = await apiRequest<Subject>(`${API_ENDPOINTS.hod.subjectById(subjectId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.data;
  },

  async deleteSubject(subjectId: string, actor: AuthUser): Promise<{ deletedId: string }> {
    if (!actor.departmentId) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }
    const res = await apiRequest<{ deletedId: string }>(API_ENDPOINTS.hod.subjectById(subjectId), {
      method: 'DELETE',
    });
    return res.data;
  },
};
