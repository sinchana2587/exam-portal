/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExaminationInstructions } from '../types/examination';
import { apiClient } from '../api/client';

/**
 * Instruction Service
 * Retrieves dynamic duration, marking scheme, and rules configured for the active session.
 */
export const instructionService = {
  async fetchInstructions(): Promise<ExaminationInstructions> {
    return apiClient.get<ExaminationInstructions>('/api/student/instructions');
  },
};
