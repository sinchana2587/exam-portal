import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError } from './apiClient';
import { MASTER_SEMESTER_NUMBERS, formatSemesterOrdinal } from '../utils/semesterOptions';
import {
  AcademicYear,
  Department,
  ExaminationRecord,
  StudentExamResult,
} from '../types';

export interface SemesterOverviewRow {
  semesterNumber: number;
  label: string;
  totalStudents: number | null;
  totalStudentsAvailable: boolean;
  upcomingExaminations: number;
  releasedResults: number;
}

export interface SemesterSectionBreakdownItem {
  section: string;
  enrolledCount: number;
}

export interface HodDashboardData {
  department: Department;
  summary: {
    totalStudents: number | null;
    totalStudentsAvailable: boolean;
    totalStudentsUnavailableReason?: string;
    upcomingExaminations: number;
    releasedResultsCount: number; // Distinct COE-released examinations
  };
  semesterOverview: SemesterOverviewRow[];
  semesterSectionBreakdowns: Record<number, SemesterSectionBreakdownItem[]>;
}

export interface DepartmentResultFilters {
  academicYearId?: string;
  semesterNumber?: number | 'ALL';
  examinationId?: string;
  section?: string;
  search?: string;
}

export interface ReleasedDepartmentResultsResponse {
  filterOptions: {
    academicYears: AcademicYear[];
    semesters: number[];
    examinations: { id: string; label: string; semesterNumber: number; academicYearId: string }[];
    sections: string[];
  };
  results: StudentExamResult[];
}

export const resultsService = {
  async getHodDashboardOverview(departmentId: string): Promise<HodDashboardData> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }

    const res = await apiRequest<HodDashboardData>(API_ENDPOINTS.hod.dashboardOverview);
    const rawOverview = Array.isArray(res.data.semesterOverview) ? res.data.semesterOverview : [];
    const normalizedOverview: SemesterOverviewRow[] = MASTER_SEMESTER_NUMBERS.map((semNum) => {
      const match = rawOverview.find((r) => r.semesterNumber === semNum);
      return match
        ? {
            ...match,
            label: match.label || formatSemesterOrdinal(semNum),
          }
        : {
            semesterNumber: semNum,
            label: formatSemesterOrdinal(semNum),
            totalStudents: null,
            totalStudentsAvailable: false,
            upcomingExaminations: 0,
            releasedResults: 0,
          };
    });

    return {
      ...res.data,
      summary: {
        ...res.data.summary,
        totalStudentsAvailable:
          typeof res.data.summary.totalStudents === 'number' &&
          res.data.summary.totalStudentsAvailable !== false,
      },
      semesterOverview: normalizedOverview,
      semesterSectionBreakdowns: res.data.semesterSectionBreakdowns || {},
    };
  },

  async getDepartmentExaminations(departmentId: string): Promise<ExaminationRecord[]> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }
    const res = await apiRequest<ExaminationRecord[]>(API_ENDPOINTS.hod.examStatus);
    return res.data;
  },

  async getReleasedDepartmentResults(
    departmentId: string,
    filters: DepartmentResultFilters = {}
  ): Promise<ReleasedDepartmentResultsResponse> {
    if (!departmentId) {
      throw new ApiClientError('Authenticated HOD department scope is required.', 403);
    }

    const params = new URLSearchParams();
    if (filters.academicYearId) params.set('academicYearId', filters.academicYearId);
    if (filters.semesterNumber && filters.semesterNumber !== 'ALL') {
      params.set('semesterNumber', String(filters.semesterNumber));
    }
    if (filters.examinationId) params.set('examinationId', filters.examinationId);
    if (filters.section) params.set('section', filters.section);
    if (filters.search) params.set('search', filters.search);
    const res = await apiRequest<ReleasedDepartmentResultsResponse>(
      `${API_ENDPOINTS.hod.releasedResults}?${params.toString()}`
    );
    return {
      ...res.data,
      filterOptions: {
        ...res.data.filterOptions,
        semesters: [...MASTER_SEMESTER_NUMBERS],
      },
    };
  },
};
