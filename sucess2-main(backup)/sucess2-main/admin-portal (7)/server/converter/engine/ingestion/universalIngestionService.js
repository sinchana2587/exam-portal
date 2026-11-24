import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { extractFromPdf } from '../extractors/pdfExtractor.js';
import { extractPdfWithOcr, extractWithOcr } from '../extractors/ocrExtractor.js';
import { extractFromDocx, extractTextFromBinaryOrOle } from '../extractors/docxExtractor.js';
import { extractFromExcel } from '../extractors/excelExtractor.js';
import { associateVectorImagesWithQuestions } from '../conversionEngine.js';

export const SUPPORTED_FORMATS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'jpg', 'jpeg', 'png'];
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Reads file magic bytes to verify file signature
 */
export function detectFileSignature(filePath) {
  let fd;
  try {
    const buffer = Buffer.alloc(16);
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    fd = null;

    if (bytesRead < 4) {
      return { detectedFormat: null, isBinary: false, error: 'File is too small to determine format' };
    }

    // PDF: %PDF (25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { detectedFormat: 'pdf', isBinary: true };
    }

    // ZIP based: PK\x03\x04 (50 4B 03 04) - DOCX or XLSX
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return { detectedFormat: 'zip_container', isBinary: true };
    }

    // OLE2 / Compound File: D0 CF 11 E0 A1 B1 1A E1 - XLS or legacy DOC
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
      return { detectedFormat: 'ole_compound', isBinary: true };
    }

    // PNG: 89 50 4E 47 (89 P N G)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { detectedFormat: 'png', isBinary: true };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { detectedFormat: 'jpg', isBinary: true };
    }

    // Check for plaintext (TXT / CSV)
    // Inspect first 512 bytes for control or null characters
    const textSampleBuffer = Buffer.alloc(Math.min(512, fs.statSync(filePath).size));
    const fdText = fs.openSync(filePath, 'r');
    const sampleRead = fs.readSync(fdText, textSampleBuffer, 0, textSampleBuffer.length, 0);
    fs.closeSync(fdText);

    let nullCount = 0;
    for (let i = 0; i < sampleRead; i++) {
      if (textSampleBuffer[i] === 0x00) nullCount++;
    }

    // If no null bytes, it's valid text
    if (nullCount === 0) {
      return { detectedFormat: 'text', isBinary: false };
    }

    return { detectedFormat: 'unknown_binary', isBinary: true };
  } catch (err) {
    if (fd) {
      try { fs.closeSync(fd); } catch (_) {}
    }
    return { detectedFormat: null, isBinary: false, error: err.message };
  }
}

/**
 * Validates the uploaded file against supported formats and integrity constraints
 */
export function validateSourceFile(file) {
  if (!file) {
    return { valid: false, error: 'No source file was provided for ingestion.' };
  }

  const filePath = file.path || file.filepath;
  if (!filePath || !fs.existsSync(filePath)) {
    return { valid: false, error: 'Uploaded file could not be found on the server filesystem.' };
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    return { valid: false, error: 'The uploaded file is empty (0 bytes). Please upload a valid document.' };
  }

  if (stats.size > MAX_FILE_SIZE) {
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 50 MB.`
    };
  }

  const originalName = file.originalname || path.basename(filePath);
  const ext = path.extname(originalName).toLowerCase().replace('.', '');

  if (!SUPPORTED_FORMATS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format ".${ext}". Supported formats are: ${SUPPORTED_FORMATS.map(f => '.' + f).join(', ')}.`
    };
  }

  // File signature verification
  const sig = detectFileSignature(filePath);
  if (sig.detectedFormat === 'unknown_binary' && ['txt', 'csv'].includes(ext)) {
    return {
      valid: false,
      error: `File extension is .${ext} but contents appear to be corrupted binary data.`
    };
  }

  // Calculate SHA-256 checksum for audit and provenance
  let checksum = null;
  try {
    const hash = crypto.createHash('sha256');
    const fileBuf = fs.readFileSync(filePath);
    hash.update(fileBuf);
    checksum = hash.digest('hex');
  } catch (_) {}

  return {
    valid: true,
    fileFormat: ext,
    detectedSignature: sig.detectedFormat,
    fileSize: stats.size,
    originalName,
    checksum,
    filePath
  };
}

/**
 * Universal Ingestion Function: routes source file to the correct format extractor
 */
export async function ingestDocument(file, options = {}) {
  const tStart = Date.now();
  const validation = validateSourceFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { filePath, fileFormat, originalName, fileSize, checksum } = validation;
  const warnings = [];
  const errors = [];
  let rawText = '';
  let extractedImages = [];
  let tableRows = [];
  let sheetsData = {};
  let extractionMethod = 'digital';
  let isScanned = false;
  let pageCount = 1;

  try {
    switch (fileFormat) {
      case 'pdf': {
        const pdfResult = await extractFromPdf(filePath);
        rawText = pdfResult.text || '';
        extractedImages = pdfResult.images || [];
        isScanned = Boolean(pdfResult.isScannedLikely);
        pageCount = pdfResult.numPages || 1;

        const hasVectorFigures = extractedImages.some(img => img.vectorFigure);

        if (isScanned || hasVectorFigures || !rawText.trim()) {
          extractionMethod = isScanned ? 'ocr' : 'hybrid';
          const vectorFigurePages = !isScanned && hasVectorFigures
            ? [...new Set(extractedImages.filter(img => img.vectorFigure).map(img => img.pageNumber).filter(Boolean))]
            : null;

          const ocrResult = await extractPdfWithOcr(filePath, pageCount, 'eng', vectorFigurePages);
          if (ocrResult.success && ocrResult.text.trim()) {
            associateVectorImagesWithQuestions(extractedImages, ocrResult.pages);
            if (isScanned || !rawText.trim()) {
              rawText = ocrResult.text;
            }
          } else if (!rawText.trim()) {
            throw new Error(`PDF appears to be scanned or contains image text, but OCR could not recognize characters: ${ocrResult.error || 'unreadable content'}`);
          }
        }
        break;
      }

      case 'docx': {
        extractionMethod = 'docx';
        const docxResult = await extractFromDocx(filePath);
        rawText = docxResult.textWithImageMarkers || docxResult.text || '';
        extractedImages = docxResult.images || [];
        tableRows = docxResult.tableRows || [];
        if (docxResult.messages?.length) {
          docxResult.messages.forEach(m => warnings.push(m.message));
        }
        break;
      }

      case 'doc': {
        extractionMethod = 'doc_legacy';
        rawText = extractTextFromBinaryOrOle(filePath);
        break;
      }

      case 'xlsx':
      case 'xls':
      case 'csv': {
        extractionMethod = 'spreadsheet';
        const excelResult = await extractFromExcel(filePath);
        tableRows = excelResult.primaryRows || [];
        sheetsData = excelResult.sheets || {};
        extractedImages = excelResult.images || [];
        pageCount = Object.keys(sheetsData).length || 1;
        break;
      }

      case 'txt': {
        extractionMethod = 'plaintext';
        const buf = fs.readFileSync(filePath);
        // Handle UTF-8 BOM if present
        if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
          rawText = buf.subarray(3).toString('utf8');
        } else {
          rawText = buf.toString('utf8');
        }
        break;
      }

      case 'jpg':
      case 'jpeg':
      case 'png': {
        extractionMethod = 'ocr';
        isScanned = true;
        const ocrResult = await extractWithOcr(filePath);
        if (!ocrResult.success || !ocrResult.text.trim()) {
          throw new Error(`OCR could not extract readable text from the uploaded image: ${ocrResult.error || 'insufficient image contrast or text quality'}`);
        }
        rawText = ocrResult.text;
        if (ocrResult.confidence < 60) {
          warnings.push(`Image OCR completed with low confidence score (${ocrResult.confidence.toFixed(1)}%). Some text may require manual review.`);
        }
        break;
      }

      default:
        throw new Error(`Unsupported format: ${fileFormat}`);
    }
  } catch (err) {
    errors.push(err.message);
    throw err;
  }

  const durationMs = Date.now() - tStart;

  return {
    sourceFile: {
      filename: originalName,
      format: fileFormat,
      size: fileSize,
      checksum,
      originalPath: filePath
    },
    extraction: {
      method: extractionMethod,
      status: errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'completed_with_warnings' : 'completed'),
      durationMs,
      warnings,
      errors,
      isScanned,
      pageCount,
      sheetNames: Object.keys(sheetsData)
    },
    extractedData: {
      rawText,
      extractedImages,
      tableRows,
      sheetsData
    }
  };
}
