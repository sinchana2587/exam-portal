import { API_ENDPOINTS } from './apiConfig';
import { apiRequest } from './apiClient';
import {
  AuditActorRole,
  AuditCategory,
  AuditLogEntry,
  AuthUser,
  Department,
} from '../types';

export interface AuditFilterParams {
  search?: string;
  departmentId?: string; // Ignored/enforced server-side for HOD
  actorRole?: AuditActorRole | 'ALL';
  category?: AuditCategory | 'ALL';
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  departments: Department[];
}

export const auditService = {
  async getAuditLogs(
    user: AuthUser,
    filters: AuditFilterParams = {}
  ): Promise<AuditLogsResponse> {
    const endpoint =
      user.role === 'PRINCIPAL'
        ? API_ENDPOINTS.principal.auditLogs
        : API_ENDPOINTS.hod.auditLogs;

    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (user.role === 'PRINCIPAL' && filters.departmentId) {
      params.set('departmentId', filters.departmentId);
    }
    if (filters.actorRole && filters.actorRole !== 'ALL') {
      params.set('actorRole', filters.actorRole);
    }
    if (filters.category && filters.category !== 'ALL') {
      params.set('category', filters.category);
    }
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await apiRequest<AuditLogsResponse>(`${endpoint}?${params.toString()}`);
    return res.data;
  },
};
