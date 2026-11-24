import {
  ActiveWorkstationBinding,
  PcRecoveryRecord,
  SessionMonitoringData,
  SuspiciousActivityRecord,
  VersionLetter,
} from '../types/examination';
import { apiClient } from './apiClient';

export const sessionService = {
  async getSessionMonitors(): Promise<SessionMonitoringData[]> {
    const res = await apiClient.labServerRequest<SessionMonitoringData[]>(
      '/monitoring/sessions',
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Read-only telemetry synchronization for a specific sitting session.
   */
  async refreshSessionTelemetry(sessionId: string): Promise<SessionMonitoringData> {
    const res = await apiClient.labServerRequest<SessionMonitoringData>(
      `/monitoring/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'GET' }
    );
    return res.data;
  },

  /**
   * Dynamic Runtime Workstation Association forwarded to the Lab Server API.
   */
  async associateWorkstationOnLogin(params: {
    examinationId: string;
    sittingId: string;
    studentUsn: string;
    labId: string;
    pcId: string;
  }): Promise<{
    binding: ActiveWorkstationBinding;
    assignedVersion: VersionLetter;
  }> {
    const res = await apiClient.labServerRequest<{
      binding: ActiveWorkstationBinding;
      assignedVersion: VersionLetter;
    }>(
      `/labs/${encodeURIComponent(params.labId)}/sittings/${encodeURIComponent(
        params.sittingId
      )}/workstation-bind`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    return res.data;
  },

  /**
   * Triggers Lab Server PC crash recovery within the assigned laboratory scope.
   */
  async performLabCrashRecovery(params: {
    examinationId: string;
    sittingId: string;
    labId: string;
    studentUsn: string;
    targetPcId: string;
    operatorIdentity: string;
    externalAuthorityVerified: boolean;
    reason: string;
  }): Promise<{
    recoveryRecord: PcRecoveryRecord;
    binding: ActiveWorkstationBinding;
    preservedVersion: VersionLetter;
  }> {
    const res = await apiClient.labServerRequest<{
      recoveryRecord: PcRecoveryRecord;
      binding: ActiveWorkstationBinding;
      preservedVersion: VersionLetter;
    }>(
      `/labs/${encodeURIComponent(params.labId)}/sittings/${encodeURIComponent(
        params.sittingId
      )}/pc-recovery`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    return res.data;
  },

  async recordSuspiciousUnlock(params: {
    examinationId: string;
    sittingId: string;
    studentUsn: string;
    pcNumber: string;
    eventType: SuspiciousActivityRecord['eventType'];
    unlockCredentialId: string;
    unlockCredentialRevision: number;
    invigilatorIdentity: string;
    invigilatorOperatorId: string;
    unlockReason: string;
  }): Promise<SuspiciousActivityRecord> {
    const res = await apiClient.labServerRequest<SuspiciousActivityRecord>(
      `/monitoring/sessions/${encodeURIComponent(params.sittingId)}/unlock-event`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    return res.data;
  },
};
