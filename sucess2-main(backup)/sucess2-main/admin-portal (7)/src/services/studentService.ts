import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError } from './apiClient';
import { mergeWithMasterSemesters } from '../utils/semesterOptions';
import { validateInstitutionalUsn } from '../utils/usnValidator';
import {
  AcademicYear,
  AuthUser,
  Department,
  DepartmentSectionConfig,
  SemesterRecord,
  StudentListRevision,
} from '../types';

export interface AcademicContextData {
  department: Department;
  academicYears: AcademicYear[];
  semesters: SemesterRecord[];
  departmentSections: DepartmentSectionConfig[];
}

export interface ParsedStudentRow {
  rowNumber: number;
  usn: string;
  studentName: string;
  dob: string;
  isValid: boolean;
  errors: string[];
}

export const studentService = {
  async getAcademicContext(departmentId: string): Promise<AcademicContextData> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope missing.', 403);
    }
    const res = await apiRequest<AcademicContextData>(API_ENDPOINTS.hod.academicContext);
    return {
      ...res.data,
      semesters: mergeWithMasterSemesters(res.data.semesters),
    };
  },

  async addSectionToSemester(
    semesterNumber: number,
    sectionName: string,
    actor: AuthUser
  ): Promise<DepartmentSectionConfig> {
    const rawClean = sectionName.trim().replace(/\s+/g, ' ');
    if (!rawClean) throw new ApiClientError('Section name is required.', 400);
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);

    const singleLetterMatch = rawClean.match(/^(?:section\s+)?([A-Za-z0-9]{1,2})$/i);
    const clean = singleLetterMatch
      ? `Section ${singleLetterMatch[1].toUpperCase()}`
      : rawClean.replace(/^section\s+/i, 'Section ');

    const res = await apiRequest<DepartmentSectionConfig>(`${API_ENDPOINTS.hod.academicContext}/sections`, {
      method: 'POST',
      body: JSON.stringify({ semesterNumber, name: clean }),
    });
    return res.data;
  },

  async deleteSectionFromSemester(
    semesterNumber: number,
    sectionName: string,
    actor: AuthUser,
    confirm = false
  ): Promise<void> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    const rawClean = sectionName.trim().replace(/\s+/g, ' ');
    if (!rawClean) throw new ApiClientError('Section name is required.', 400);

    const singleLetterMatch = rawClean.match(/^(?:section\s+)?([A-Za-z0-9]{1,2})$/i);
    const clean = singleLetterMatch
      ? `Section ${singleLetterMatch[1].toUpperCase()}`
      : rawClean.replace(/^section\s+/i, 'Section ');

    await apiRequest<void>(`${API_ENDPOINTS.hod.academicContext}/sections`, {
      method: 'DELETE',
      body: JSON.stringify({ semesterNumber, name: clean, confirm }),
    });
  },

  async getSectionRevisions(
    departmentId: string,
    semesterNumber: number,
    section: string
  ): Promise<StudentListRevision[]> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope missing.', 403);
    }
    const params = new URLSearchParams({
      semesterNumber: String(semesterNumber),
      section,
    });
    const res = await apiRequest<StudentListRevision[]>(
      `${API_ENDPOINTS.hod.studentLists}?${params.toString()}`
    );
    return res.data;
  },

  async findCrossSectionOrDeptUsnConflicts(
    departmentId: string,
    semesterNumber: number,
    section: string,
    usns: string[]
  ): Promise<Record<string, string>> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope missing.', 403);
    }
    const res = await apiRequest<Record<string, string>>(`${API_ENDPOINTS.hod.studentLists}/validate-usns`, {
      method: 'POST',
      body: JSON.stringify({ semesterNumber, section, usns }),
    });
    return res.data;
  },

  async getAllCrossSectionUsnConflicts(
    departmentId: string,
    semesterNumber: number,
    section: string
  ): Promise<Record<string, string>> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope missing.', 403);
    }
    const res = await apiRequest<Record<string, string>>(`${API_ENDPOINTS.hod.studentLists}/validate-usns`, {
      method: 'POST',
      body: JSON.stringify({ semesterNumber, section, usns: [] }),
    });
    return res.data;
  },

  async saveOrReplaceStudentList(
    params: {
      academicYearId: string;
      semesterNumber: number;
      section: string;
      fileName: string;
      sourceType: 'EXCEL_UPLOAD' | 'PDF_CONVERTED_EXCEL' | 'MANUAL_ENTRY';
      rows: ParsedStudentRow[];
      isReplacement: boolean;
    },
    actor: AuthUser
  ): Promise<StudentListRevision> {
    if (!actor.departmentId || !actor.departmentCode) {
      throw new ApiClientError('Authenticated HOD department scope missing.', 403);
    }

    const invalidRows = params.rows.filter((r) => !r.isValid);
    if (params.rows.length === 0 || invalidRows.length > 0) {
      throw new ApiClientError(
        `Upload rejected: ${invalidRows.length} invalid row(s) detected. Resolve all errors before saving.`,
        400,
        'STUDENT_VALIDATION_FAILED'
      );
    }

    const endpoint = params.isReplacement
      ? API_ENDPOINTS.hod.studentListReplace
      : API_ENDPOINTS.hod.studentListUpload;
    const res = await apiRequest<StudentListRevision>(endpoint, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  },

  async addIndividualStudent(
    params: {
      academicYearId: string;
      semesterNumber: number;
      section: string;
      usn: string;
      studentName: string;
      dob: string;
    },
    actor: AuthUser
  ): Promise<StudentListRevision> {
    if (!actor.departmentId || !actor.departmentCode) {
      throw new ApiClientError('Department scope missing.', 403);
    }

    const cleanUsn = params.usn.trim().toUpperCase();
    const cleanName = params.studentName.trim();
    const cleanDob = params.dob.trim();

    const usnCheck = validateInstitutionalUsn(cleanUsn, actor.departmentCode);
    if (!usnCheck.valid) {
      throw new ApiClientError(usnCheck.error || 'Invalid USN.', 400);
    }
    if (!cleanName || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
      throw new ApiClientError('Student Name and valid DOB (YYYY-MM-DD) are required.', 400);
    }

    const res = await apiRequest<StudentListRevision>(`${API_ENDPOINTS.hod.studentLists}/student`, {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        usn: cleanUsn,
        studentName: cleanName,
        dob: cleanDob,
      }),
    });
    return res.data;
  },

  async updateIndividualStudent(
    _revisionId: string,
    studentId: string,
    updates: { usn: string; studentName: string; dob: string },
    actor: AuthUser
  ): Promise<StudentListRevision> {
    const cleanUsn = updates.usn.trim().toUpperCase();
    const cleanName = updates.studentName.trim();
    const cleanDob = updates.dob.trim();
    const usnCheck = validateInstitutionalUsn(cleanUsn, actor.departmentCode);
    if (!usnCheck.valid || !cleanName || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDob)) {
      throw new ApiClientError(
        !usnCheck.valid && usnCheck.error
          ? usnCheck.error
          : 'Valid USN, Student Name, and DOB (YYYY-MM-DD) are required.',
        400
      );
    }

    const res = await apiRequest<StudentListRevision>(API_ENDPOINTS.hod.studentRecord(studentId), {
      method: 'PATCH',
      body: JSON.stringify({
        usn: cleanUsn,
        studentName: cleanName,
        dob: cleanDob,
      }),
    });
    return res.data;
  },

  async removeIndividualStudent(
    _revisionId: string,
    studentId: string,
    actor: AuthUser
  ): Promise<StudentListRevision> {
    if (!actor.departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<StudentListRevision>(API_ENDPOINTS.hod.studentRecord(studentId), {
      method: 'DELETE',
    });
    return res.data;
  },

  async promoteStudentsSemester(params: {
    sourceSemester: number;
    sourceSection: string;
    targetSemester: number;
    targetSection: string;
    academicYear?: string;
  }): Promise<{ message: string; promotedCount: number; sourceSemester: number; targetSemester: number }> {
    const res = await apiRequest<{
      message: string;
      promotedCount: number;
      sourceSemester: number;
      targetSemester: number;
    }>(API_ENDPOINTS.hod.promoteStudents, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  },

  async graduateSemester8Students(params: {
    section?: string;
    academicYear?: string;
  }): Promise<{ message: string; graduatedCount: number }> {
    const res = await apiRequest<{
      message: string;
      graduatedCount: number;
    }>(API_ENDPOINTS.hod.graduateStudents, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  },
};
