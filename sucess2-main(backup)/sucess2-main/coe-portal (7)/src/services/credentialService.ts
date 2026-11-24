import { SessionUnlockCredential } from '../types/examination';
import { OfflineUnlockVerificationResult } from '../utils/credentials';
import { apiClient } from './apiClient';

export interface GenerateSessionUnlockResult {
  credential: SessionUnlockCredential;
  revealOnceSecret: string;
}

export const credentialService = {
  async getSessionUnlockCredentials(): Promise<SessionUnlockCredential[]> {
    const res = await apiClient.centralRequest<any[]>(
      '/examinations/unlock-credentials',
      { method: 'GET' }
    );
    const rawList = Array.isArray(res.data) ? res.data : [];
    return rawList.map((item: any) => {
      const examId = String(item.examinationId ?? item.examination_id ?? item.session_id ?? '');
      const rawSitting = String(item.sittingName ?? item.sitting_name ?? item.sitting_code ?? '');
      const sittingDisplayName: 'Morning Sitting' | 'Afternoon Sitting' =
        rawSitting.toUpperCase().includes('AFTERNOON') || rawSitting.toUpperCase().endsWith('-A')
          ? 'Afternoon Sitting'
          : 'Morning Sitting';
      const sitCode = sittingDisplayName === 'Morning Sitting' ? 'M' : 'A';
      const sittingId = String(item.sittingId ?? item.sitting_id ?? `SIT-${examId}-${sitCode}`);
      const rev = Number(item.revision ?? 1);
      const credentialId = String(item.credentialId ?? item.credential_id ?? `CRED-${examId}-${sitCode}-R${rev}`);
      const status = item.status || 'Active';
      const syncStatus = (item.syncStatus ?? item.sync_status ?? (status === 'Active' ? 'Synced' : status === 'Synchronisation Failed' ? 'Sync Failed' : 'Not Synced')) as any;
      const maskedPreview = item.maskedPreview ?? item.masked_preview ?? 'MITM-••••-••••';

      return {
        ...item,
        id: String(item.id),
        credentialId,
        examinationId: examId,
        examCode: item.examCode ?? item.exam_code ?? `EXAM-${examId}`,
        subjectCode: item.subjectCode ?? item.subject_code ?? '',
        subjectName: item.subjectName ?? item.subject_name ?? '',
        sittingId,
        sittingName: sittingDisplayName,
        examDate: item.examDate ?? item.exam_date ?? '',
        startTime: item.startTime ?? item.start_time ?? '',
        labId: item.labId ?? item.lab_id ?? 'LAB-CSE-01',
        labName: item.labName ?? item.lab_name ?? 'Center Lab 01',
        status,
        maskedPreview,
        generatedAt: item.generatedAt ?? item.generated_at,
        expiresAt: item.expiresAt ?? item.expires_at,
        lastRegeneratedAt: item.lastRegeneratedAt ?? item.last_regenerated_at,
        revokedAt: item.revokedAt ?? item.revoked_at,
        generatedBy: item.generatedBy ?? item.generated_by,
        revision: rev,
        syncStatus,
        lastSyncedAt: item.lastSyncedAt ?? item.last_synced_at,
        syncError: item.syncError ?? item.sync_error,
      } as SessionUnlockCredential;
    });
  },

  /**
   * Requests the Central Java Backend to generate a CSPRNG sitting-specific
   * Invigilator Session Unlock Credential, sync its salted verifier to the Lab Server,
   * and return the plaintext once for COE handoff.
   */
  async generateSessionUnlockCredential(
    examinationId: string,
    sittingId: string
  ): Promise<GenerateSessionUnlockResult> {
    const res = await apiClient.centralRequest<GenerateSessionUnlockResult>(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/unlock-credential`,
      {
        method: 'POST',
        body: JSON.stringify({ examinationId, sittingId }),
      }
    );

    return res.data;
  },

  /**
   * Requests the Central Java Backend to invalidate the active sitting unlock credential
   * and generate & sync a fresh revision to the Lab Server.
   */
  async regenerateSessionUnlockCredential(
    examinationId: string,
    sittingId: string
  ): Promise<GenerateSessionUnlockResult> {
    const res = await apiClient.centralRequest<GenerateSessionUnlockResult>(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/unlock-credential/regenerate`,
      {
        method: 'POST',
        body: JSON.stringify({ examinationId, sittingId }),
      }
    );

    return res.data;
  },

  async revokeSessionUnlockCredential(
    examinationId: string,
    sittingId: string
  ): Promise<SessionUnlockCredential> {
    const res = await apiClient.centralRequest<SessionUnlockCredential>(
      `/examinations/${encodeURIComponent(examinationId)}/sittings/${encodeURIComponent(
        sittingId
      )}/unlock-credential/revoke`,
      { method: 'POST' }
    );

    return res.data;
  },

  /**
   * Submits an unlock verification request to the Lab Server API.
   */
  async verifyLocalSessionUnlock(params: {
    candidateSecret: string;
    examinationId: string;
    sittingId: string;
    labId: string;
    pcId: string;
    studentUsn: string;
    invigilatorOperatorId: string;
  }): Promise<OfflineUnlockVerificationResult> {
    const res = await apiClient.labServerRequest<OfflineUnlockVerificationResult>(
      `/labs/${encodeURIComponent(params.labId)}/sittings/${encodeURIComponent(
        params.sittingId
      )}/verify-unlock`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    return res.data;
  },
};
