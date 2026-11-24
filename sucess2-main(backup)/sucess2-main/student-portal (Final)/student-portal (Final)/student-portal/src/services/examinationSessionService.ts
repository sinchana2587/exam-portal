/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ExaminationSessionInfo,
  ExamSubmissionReceipt,
  StudentIdentity,
} from '../types/examination';
import { apiClient } from '../api/client';

export interface ActiveSessionEnvelope {
  student: StudentIdentity;
  examSession: ExaminationSessionInfo;
  examStarted: boolean;
  instructionsConfirmed: boolean;
  submitted: boolean;
  submissionReceipt?: ExamSubmissionReceipt;
}

/**
 * Examination Session Service
 * Retrieves session eligibility, availability state, and workstation assignment from the Lab Server.
 */
export const examinationSessionService = {
  async fetchCurrentSession(): Promise<ActiveSessionEnvelope> {
    return apiClient.get<ActiveSessionEnvelope>('/api/student/exam-session');
  },
};
