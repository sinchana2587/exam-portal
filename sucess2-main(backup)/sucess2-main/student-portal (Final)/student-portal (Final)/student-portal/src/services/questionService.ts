/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssignedQuestionPaperResponse } from '../types/examination';
import { apiClient } from '../api/client';

/**
 * Question Service
 * Requests the fixed assigned version (Version A/B/C/D) of the question paper
 * mapped to this student's workstation on the Lab Server.
 */
export const questionService = {
  async fetchAssignedQuestionPaper(): Promise<AssignedQuestionPaperResponse> {
    return apiClient.get<AssignedQuestionPaperResponse>('/api/student/exam/questions');
  },
};
