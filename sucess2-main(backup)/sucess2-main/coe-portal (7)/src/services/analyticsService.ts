import { AuditLogEntry } from '../types/examination';
import { apiClient } from './apiClient';

export const analyticsService = {
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await apiClient.centralRequest<AuditLogEntry[]>('/audit/logs', {
      method: 'GET',
    });
    return res.data;
  },
};
