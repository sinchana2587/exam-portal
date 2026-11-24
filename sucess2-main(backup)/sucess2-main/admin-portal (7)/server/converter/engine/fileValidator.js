import path from 'path';

export const ALLOWED_EXTENSIONS = {
  question_paper: ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.png', '.jpg', '.jpeg'],
  student_list: ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.doc']
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateFile(file, documentType) {
  if (!file) {
    return { valid: false, error: 'No file was provided.' };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ALLOWED_EXTENSIONS[documentType] || [...ALLOWED_EXTENSIONS.question_paper, ...ALLOWED_EXTENSIONS.student_list];

  if (!allowed.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file format "${ext}". Allowed formats for ${documentType.replace('_', ' ')} are: ${allowed.join(', ')}`
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 50 MB.`
    };
  }

  return {
    valid: true,
    fileFormat: ext.replace('.', ''),
    fileSize: file.size,
    originalName: file.originalname
  };
}

