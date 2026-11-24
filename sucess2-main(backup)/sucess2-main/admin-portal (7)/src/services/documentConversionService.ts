import { API_ENDPOINTS } from './apiConfig';
import { apiDownloadBlob, apiRequest, ApiClientError } from './apiClient';
import { triggerBlobDownload } from '../utils/exportUtils';
import {
  AuthUser,
  ExtractedQuestionPreviewRow,
  ExtractedStudentPreviewRow,
  QuestionConversionSession,
  QuestionImageAsset,
  StudentConversionSession,
  Subject,
} from '../types';

function buildHodContextHeaders(actor: AuthUser): Record<string, string> {
  if (!actor.id || !actor.departmentId || !actor.departmentCode) {
    throw new ApiClientError(
      'Authenticated HOD department context is required.',
      403,
      'DEPARTMENT_MISMATCH'
    );
  }
  return {
    'x-hod-user-id': actor.id,
    'x-hod-department-id': actor.departmentId,
    'x-hod-department-code': actor.departmentCode,
  };
}

export interface ParsedExcelQuestionRow {
  rowNumber: number;
  moduleNumber: number | null;
  moduleRaw: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  questionImages: QuestionImageAsset[];
  optionAImages: QuestionImageAsset[];
  optionBImages: QuestionImageAsset[];
  optionCImages: QuestionImageAsset[];
  optionDImages: QuestionImageAsset[];
  isValid: boolean;
  errors: string[];
}

export interface ParsedQuestionExcelResponse {
  success: boolean;
  fatalError?: string;
  fileName: string;
  fileSizeBytes: number;
  rows: ParsedExcelQuestionRow[];
  validCount: number;
  invalidCount: number;
  totalImagesExtracted: number;
}

export const documentConversionService = {
  // =========================================================================
  // CONVERTER A: STUDENT LIST PDF / IMAGE TO EXCEL
  // =========================================================================

  async uploadStudentDocument(params: {
    file: File;
    semesterNumber: number;
    section: string;
    existingUsnConflicts: Record<string, string>;
    actor: AuthUser;
  }): Promise<StudentConversionSession> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('semesterNumber', String(params.semesterNumber));
    formData.append('section', params.section);
    formData.append('existingUsnConflicts', JSON.stringify(params.existingUsnConflicts || {}));

    const res = await apiRequest<StudentConversionSession>(
      API_ENDPOINTS.hod.studentConversions,
      {
        method: 'POST',
        headers: buildHodContextHeaders(params.actor),
        body: formData,
      },
      90000
    );
    return res.data;
  },

  async getStudentConversion(
    conversionId: string,
    actor: AuthUser
  ): Promise<StudentConversionSession> {
    const res = await apiRequest<StudentConversionSession>(
      API_ENDPOINTS.hod.studentConversionById(conversionId),
      {
        method: 'GET',
        headers: buildHodContextHeaders(actor),
      }
    );
    return res.data;
  },

  async updateStudentConversionRecords(params: {
    conversionId: string;
    records: ExtractedStudentPreviewRow[];
    sectionConfirmed: boolean;
    existingUsnConflicts: Record<string, string>;
    actor: AuthUser;
  }): Promise<StudentConversionSession> {
    const res = await apiRequest<StudentConversionSession>(
      API_ENDPOINTS.hod.studentConversionRecords(params.conversionId),
      {
        method: 'PUT',
        headers: buildHodContextHeaders(params.actor),
        body: JSON.stringify({
          records: params.records,
          sectionConfirmed: params.sectionConfirmed,
          existingUsnConflicts: params.existingUsnConflicts,
        }),
      }
    );
    return res.data;
  },

  async validateStudentConversion(params: {
    conversionId: string;
    records?: ExtractedStudentPreviewRow[];
    sectionConfirmed?: boolean;
    existingUsnConflicts?: Record<string, string>;
    actor: AuthUser;
  }): Promise<StudentConversionSession> {
    const res = await apiRequest<StudentConversionSession>(
      API_ENDPOINTS.hod.studentConversionValidate(params.conversionId),
      {
        method: 'POST',
        headers: buildHodContextHeaders(params.actor),
        body: JSON.stringify({
          records: params.records,
          sectionConfirmed: params.sectionConfirmed,
          existingUsnConflicts: params.existingUsnConflicts,
        }),
      }
    );
    return res.data;
  },

  async downloadStudentConversionExcel(params: {
    conversionId: string;
    fallbackFileName: string;
    actor: AuthUser;
  }): Promise<string> {
    const { blob, fileName } = await apiDownloadBlob(
      API_ENDPOINTS.hod.studentConversionExcel(params.conversionId),
      params.fallbackFileName,
      {
        method: 'GET',
        headers: buildHodContextHeaders(params.actor),
      }
    );
    triggerBlobDownload(blob, fileName);
    return fileName;
  },

  async downloadStandardStudentTemplate(
    departmentCode: string,
    semesterNumber: number,
    section: string
  ): Promise<void> {
    const qs = new URLSearchParams({
      departmentCode,
      semesterNumber: String(semesterNumber),
      section,
    });
    const { blob, fileName } = await apiDownloadBlob(
      `/hod/student-lists/template?${qs.toString()}`,
      `${departmentCode}_Sem${semesterNumber}_${section.replace(/\s+/g, '')}_Student_Template.xlsx`
    );
    triggerBlobDownload(blob, fileName);
  },

  // =========================================================================
  // CONVERTER B: MODULE-WISE QUESTION PDF / IMAGE TO EXCEL (WITH IMAGES)
  // =========================================================================

  async uploadQuestionDocument(params: {
    file: File;
    semesterNumber: number;
    subject: Subject;
    selectedPageRange?: string;
    existingQuestionTexts: string[];
    actor: AuthUser;
  }): Promise<QuestionConversionSession> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('semesterNumber', String(params.semesterNumber));
    formData.append('subjectId', params.subject.id);
    formData.append('subjectCode', params.subject.code);
    formData.append('subjectName', params.subject.name);
    formData.append('subjectModuleCount', String(params.subject.moduleCount));
    if (params.selectedPageRange) {
      formData.append('selectedPageRange', params.selectedPageRange);
    }
    formData.append('existingQuestionTexts', JSON.stringify(params.existingQuestionTexts || []));

    const res = await apiRequest<QuestionConversionSession>(
      API_ENDPOINTS.hod.questionConversions,
      {
        method: 'POST',
        headers: buildHodContextHeaders(params.actor),
        body: formData,
      },
      120000
    );
    return res.data;
  },

  async getQuestionConversion(
    conversionId: string,
    actor: AuthUser
  ): Promise<QuestionConversionSession> {
    const res = await apiRequest<QuestionConversionSession>(
      API_ENDPOINTS.hod.questionConversionById(conversionId),
      {
        method: 'GET',
        headers: buildHodContextHeaders(actor),
      }
    );
    return res.data;
  },

  async updateQuestionConversionRecords(params: {
    conversionId: string;
    records: ExtractedQuestionPreviewRow[];
    unassignedImages?: QuestionImageAsset[];
    existingQuestionTexts: string[];
    actor: AuthUser;
  }): Promise<QuestionConversionSession> {
    const res = await apiRequest<QuestionConversionSession>(
      API_ENDPOINTS.hod.questionConversionRecords(params.conversionId),
      {
        method: 'PUT',
        headers: buildHodContextHeaders(params.actor),
        body: JSON.stringify({
          records: params.records,
          unassignedImages: params.unassignedImages,
          existingQuestionTexts: params.existingQuestionTexts,
        }),
      }
    );
    return res.data;
  },

  async validateQuestionConversion(params: {
    conversionId: string;
    records?: ExtractedQuestionPreviewRow[];
    unassignedImages?: QuestionImageAsset[];
    existingQuestionTexts?: string[];
    actor: AuthUser;
  }): Promise<QuestionConversionSession> {
    const res = await apiRequest<QuestionConversionSession>(
      API_ENDPOINTS.hod.questionConversionValidate(params.conversionId),
      {
        method: 'POST',
        headers: buildHodContextHeaders(params.actor),
        body: JSON.stringify({
          records: params.records,
          unassignedImages: params.unassignedImages,
          existingQuestionTexts: params.existingQuestionTexts,
        }),
      }
    );
    return res.data;
  },

  async downloadQuestionConversionExcel(params: {
    conversionId: string;
    moduleNumber: number;
    fallbackFileName: string;
    actor: AuthUser;
    downloadUrl?: string;
  }): Promise<string> {
    const basePath =
      params.downloadUrl || API_ENDPOINTS.hod.questionConversionExcel(params.conversionId);
    const urlPath = basePath.includes('moduleNumber=')
      ? basePath
      : `${basePath}${basePath.includes('?') ? '&' : '?'}moduleNumber=${encodeURIComponent(
          String(params.moduleNumber)
        )}`;
    const { blob, fileName } = await apiDownloadBlob(
      urlPath,
      params.fallbackFileName,
      {
        method: 'GET',
        headers: buildHodContextHeaders(params.actor),
      }
    );
    triggerBlobDownload(blob, fileName);
    return fileName;
  },

  async downloadStandardQuestionTemplate(
    subjectCode: string,
    moduleNumber: number
  ): Promise<void> {
    const qs = new URLSearchParams({
      subjectCode,
      moduleNumber: String(moduleNumber),
    });
    const { blob, fileName } = await apiDownloadBlob(
      `/hod/question-banks/template?${qs.toString()}`,
      `MITM_${subjectCode}_Module_${moduleNumber}_Template.xlsx`
    );
    triggerBlobDownload(blob, fileName);
  },

  async parseQuestionExcelWithImages(params: {
    file: File;
    subjectModuleCount: number;
    selectedModuleNumber: number;
    existingQuestionTexts: string[];
    actor: AuthUser;
  }): Promise<ParsedQuestionExcelResponse> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('subjectModuleCount', String(params.subjectModuleCount));
    formData.append('selectedModuleNumber', String(params.selectedModuleNumber));
    formData.append('existingQuestionTexts', JSON.stringify(params.existingQuestionTexts || []));

    const res = await apiRequest<ParsedQuestionExcelResponse>(
      API_ENDPOINTS.hod.questionBankParseExcel,
      {
        method: 'POST',
        headers: buildHodContextHeaders(params.actor),
        body: formData,
      },
      60000
    );
    return res.data;
  },
};
