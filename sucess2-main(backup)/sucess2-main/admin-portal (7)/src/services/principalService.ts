import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError } from './apiClient';
import { MASTER_SEMESTER_NUMBERS } from '../utils/semesterOptions';
import {
  AcademicYear,
  AccountStatus,
  AuditLogEntry,
  AuthUser,
  Department,
  ExaminationRecord,
  HodAccountRecord,
  StudentExamResult,
} from '../types';

export interface PrincipalDashboardData {
  summary: {
    totalDepartments: number;
    totalHodAccounts: number;
    activeHodAccounts: number;
    totalRegisteredStudents: number; // Unique USNs only
    upcomingExaminations: number;
    examinationsInProgress: number;
    completedExaminations: number;
  };
  examinationActivity: ExaminationRecord[];
  recentAdministrativeActivities: AuditLogEntry[];
}

export interface CreateHodDepartmentPayload {
  fullName: string;
  employeeId: string;
  email: string;
  contactNumber: string;
  departmentName: string;
  departmentCode: string;
  username?: string;
  password?: string;
}

export interface UpdateHodPayload {
  fullName: string;
  email: string;
  contactNumber: string;
  designation?: string;
}

export interface ReplaceHodPayload {
  fullName: string;
  employeeId: string;
  email: string;
  contactNumber: string;
  reason: string;
}

export interface InstitutionReportFilters {
  academicYearId?: string;
  departmentId?: string;
  semesterNumber?: number | 'ALL';
  examinationId?: string;
}

export interface InstitutionReportsData {
  filterOptions: {
    academicYears: AcademicYear[];
    departments: Department[];
    semesters: number[];
    examinations: { id: string; label: string; departmentId: string; semesterNumber: number; academicYearId: string }[];
  };
  statistics: {
    studentsEvaluated: number; // Unique USNs evaluated (Present)
    totalResultEntries: number;
    absentCount: number;
    passCount: number;
    failCount: number;
    passPercentage: number;
    failPercentage: number;
    highestPercentage: number;
    averagePercentage: number;
    lowestPercentage: number;
  };
  departmentBreakdown: {
    departmentId: string;
    departmentCode: string;
    departmentName: string;
    uniqueStudents: number;
    evaluatedEntries: number;
    absentCount: number;
    passCount: number;
    failCount: number;
    passPercentage: number;
    averagePercentage: number;
    highestPercentage: number;
  }[];
  subjectBreakdown: {
    examinationId: string;
    subjectCode: string;
    subjectName: string;
    departmentCode: string;
    semesterNumber: number;
    maxMarks: number;
    evaluatedCount: number;
    absentCount: number;
    passPercentage: number;
    averagePercentage: number;
    highestPercentage: number;
    lowestPercentage: number;
  }[];
  sectionBreakdown: {
    key: string;
    departmentCode: string;
    semesterNumber: number;
    section: string;
    evaluatedCount: number;
    absentCount: number;
    passPercentage: number;
    averagePercentage: number;
  }[];
  releasedResults: StudentExamResult[];
}

export const principalService = {
  async getDashboardOverview(): Promise<PrincipalDashboardData> {
    const res = await apiRequest<PrincipalDashboardData>(API_ENDPOINTS.principal.dashboardOverview);
    return res.data;
  },

  async getHodManagementData(): Promise<{
    departments: Department[];
    hodAccounts: HodAccountRecord[];
  }> {
    const res = await apiRequest<{ departments: Department[]; hodAccounts: HodAccountRecord[] }>(
      API_ENDPOINTS.principal.hods
    );
    return res.data;
  },

  async createHodAndDepartment(
    payload: CreateHodDepartmentPayload,
    _actor: AuthUser
  ): Promise<{ department: Department; hodAccount: HodAccountRecord }> {
    const cleanCode = payload.departmentCode.trim();
    const cleanDeptName = payload.departmentName.trim();
    const cleanName = payload.fullName.trim();
    const cleanEmpId = payload.employeeId.trim().toUpperCase();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanContact = payload.contactNumber.trim();

    if (!cleanCode || !cleanDeptName || !cleanName || !cleanEmpId || !cleanEmail || !cleanContact) {
      throw new ApiClientError('All HOD and Department fields are required.', 400, 'VALIDATION_ERROR');
    }
    if (!/^[A-Za-z0-9_.-]{2,50}$/.test(cleanCode)) {
      throw new ApiClientError('Department Code must be 2–50 alphanumeric characters.', 400, 'VALIDATION_ERROR');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new ApiClientError('Enter a valid official email address.', 400, 'VALIDATION_ERROR');
    }

    const username = payload.username?.trim();
    const password = payload.password?.trim();
    if (password && password.length < 8) {
      throw new ApiClientError('Initial Password must be at least 8 characters.', 400, 'VALIDATION_ERROR');
    }

    const res = await apiRequest<{ department: Department; hodAccount: HodAccountRecord }>(
      API_ENDPOINTS.principal.hods,
      {
        method: 'POST',
        body: JSON.stringify({
          fullName: cleanName,
          employeeId: cleanEmpId,
          email: cleanEmail,
          contactNumber: cleanContact,
          departmentName: cleanDeptName,
          departmentCode: cleanCode,
          username: username || undefined,
          password: password || undefined,
        }),
      }
    );
    return res.data;
  },

  async getDepartmentWorkspace(deptId: string | number, semester?: number): Promise<{
    department: Department;
    hod: HodAccountRecord | null;
    selectedSemester: number;
    subjects: any[];
    students: any[];
    studentCount: number;
    performance: {
      evaluatedCount: number;
      absentCount: number;
      passCount: number;
      failCount: number;
      passPercentage: number;
    };
    auditLogs: any[];
  }> {
    const url = semester && semester > 0
      ? `${API_ENDPOINTS.principal.departmentWorkspace(deptId)}?semester=${semester}`
      : API_ENDPOINTS.principal.departmentWorkspace(deptId);
    const res = await apiRequest<{
      department: Department;
      hod: HodAccountRecord | null;
      selectedSemester: number;
      subjects: any[];
      students: any[];
      studentCount: number;
      performance: {
        evaluatedCount: number;
        absentCount: number;
        passCount: number;
        failCount: number;
        passPercentage: number;
      };
      auditLogs: any[];
    }>(url);
    return res.data;
  },

  async updateHodAccount(
    hodId: string,
    payload: UpdateHodPayload,
    _actor: AuthUser
  ): Promise<HodAccountRecord> {
    if (!payload.fullName.trim() || !payload.email.trim() || !payload.contactNumber.trim()) {
      throw new ApiClientError('Full Name, Official Email, and Contact Number are required.', 400);
    }

    const res = await apiRequest<HodAccountRecord>(API_ENDPOINTS.principal.hodById(hodId), {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        contactNumber: payload.contactNumber.trim(),
        designation: payload.designation?.trim(),
      }),
    });
    return res.data;
  },

  async toggleHodStatus(
    hodId: string,
    nextStatus: AccountStatus,
    _actor: AuthUser
  ): Promise<HodAccountRecord> {
    const res = await apiRequest<HodAccountRecord>(`${API_ENDPOINTS.principal.hodById(hodId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    return res.data;
  },

  async replaceHodForDepartment(
    departmentId: string,
    payload: ReplaceHodPayload,
    _actor: AuthUser
  ): Promise<HodAccountRecord> {
    const cleanName = payload.fullName.trim();
    const cleanEmpId = payload.employeeId.trim().toUpperCase();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanContact = payload.contactNumber.trim();
    const cleanReason = payload.reason.trim() || 'Administrative HOD Transition';

    if (!cleanName || !cleanEmpId || !cleanEmail || !cleanContact) {
      throw new ApiClientError('All new HOD fields are required for replacement.', 400);
    }

    const res = await apiRequest<HodAccountRecord>(API_ENDPOINTS.principal.replaceHod(departmentId), {
      method: 'POST',
      body: JSON.stringify({
        fullName: cleanName,
        employeeId: cleanEmpId,
        email: cleanEmail,
        contactNumber: cleanContact,
        reason: cleanReason,
      }),
    });
    return res.data;
  },

  async getInstitutionReports(filters: InstitutionReportFilters = {}): Promise<InstitutionReportsData> {
    const params = new URLSearchParams();
    if (filters.academicYearId) params.set('academicYearId', filters.academicYearId);
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.semesterNumber && filters.semesterNumber !== 'ALL') {
      params.set('semesterNumber', String(filters.semesterNumber));
    }
    if (filters.examinationId) params.set('examinationId', filters.examinationId);
    const res = await apiRequest<InstitutionReportsData>(
      `${API_ENDPOINTS.principal.reportsOverview}?${params.toString()}`
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
