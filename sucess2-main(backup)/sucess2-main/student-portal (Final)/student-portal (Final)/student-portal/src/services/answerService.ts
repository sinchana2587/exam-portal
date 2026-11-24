/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SaveAnswerRequest,
  SaveAnswerResponse,
} from '../types/examination';
import { apiClient } from '../api/client';

/**
 * Answer Service
 * Transmits student MCQ selections and review flags to the authoritative Lab Server.
 */
export const answerService = {
  async saveStudentAnswer(
    payload: SaveAnswerRequest
  ): Promise<SaveAnswerResponse> {
    return apiClient.post<SaveAnswerResponse>(
      '/api/student/exam/answers',
      payload
    );
  },
};
