/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SubmitExamRequest,
  SubmitExamResponse,
} from '../types/examination';
import { apiClient } from '../api/client';

/**
 * Submission Service
 * Handles final manual or timer-expired submission to the Lab Server and locks responses.
 */
export const submissionService = {
  async submitExamination(
    payload: SubmitExamRequest
  ): Promise<SubmitExamResponse> {
    return apiClient.post<SubmitExamResponse>(
      '/api/student/exam/submit',
      payload
    );
  },
};
