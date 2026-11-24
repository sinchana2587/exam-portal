/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ExamRuntimeStateResponse,
  StartExamRequest,
} from '../types/examination';
import { apiClient } from '../api/client';

/**
 * Timer & Runtime State Service
 * Synchronizes authoritative remaining examination time and saved response state with the Lab Server.
 */
export const timerService = {
  async startExamination(
    payload: StartExamRequest
  ): Promise<ExamRuntimeStateResponse> {
    return apiClient.post<ExamRuntimeStateResponse>(
      '/api/student/exam/start',
      payload
    );
  },

  async fetchAuthoritativeState(): Promise<ExamRuntimeStateResponse> {
    return apiClient.get<ExamRuntimeStateResponse>('/api/student/exam/state');
  },
};
