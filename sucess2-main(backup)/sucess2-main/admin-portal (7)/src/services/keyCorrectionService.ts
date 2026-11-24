import { API_ENDPOINTS } from './apiConfig';
import { apiRequest, ApiClientError } from './apiClient';
import {
  AuthUser,
  ExaminationRecord,
  KeyCorrectionRequest,
  QuestionItem,
} from '../types';

export interface SubmitKeyCorrectionPayload {
  examinationId: string;
  questionId: string;
  proposedCorrectOption: 'A' | 'B' | 'C' | 'D';
  reason?: string;
  evidenceFileName?: string;
}

export const keyCorrectionService = {
  async getEligibleExaminations(departmentId: string): Promise<ExaminationRecord[]> {
    if (!departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<ExaminationRecord[]>(
      `${API_ENDPOINTS.hod.keyCorrections}/eligible-examinations`
    );
    return res.data;
  },

  async getQuestionsForExamination(
    examinationId: string,
    departmentId: string
  ): Promise<QuestionItem[]> {
    if (!departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<QuestionItem[]>(
      `${API_ENDPOINTS.hod.keyCorrections}/examinations/${examinationId}/questions`
    );
    return res.data;
  },

  async getCorrectionHistory(departmentId: string): Promise<KeyCorrectionRequest[]> {
    if (!departmentId) {
      throw new ApiClientError('Department scope missing.', 403);
    }
    const res = await apiRequest<KeyCorrectionRequest[]>(API_ENDPOINTS.hod.keyCorrections);
    return res.data;
  },

  async submitCorrectionRequest(
    payload: SubmitKeyCorrectionPayload,
    actor: AuthUser
  ): Promise<KeyCorrectionRequest> {
    if (!actor.departmentId) throw new ApiClientError('Department scope missing.', 403);
    if (!payload.examinationId || !payload.questionId || !payload.proposedCorrectOption) {
      throw new ApiClientError(
        'Examination, Question ID, and Proposed Correct Answer are required.',
        400
      );
    }

    const res = await apiRequest<KeyCorrectionRequest>(API_ENDPOINTS.hod.keyCorrections, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },
};
