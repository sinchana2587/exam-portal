import { createWorker } from 'tesseract.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESSDATA_DIR = path.resolve(__dirname, '../../../data/tessdata');
const createOfflineWorker = (language) => createWorker(language, undefined, {
  langPath: TESSDATA_DIR,
  cachePath: TESSDATA_DIR,
  cacheMethod: 'none',
  gzip: false
});

export async function extractWithOcr(imagePathOrBuffer, language = 'eng') {
  let worker = null;
  try {
    worker = await createOfflineWorker(language);
    const ret = await worker.recognize(imagePathOrBuffer);
    await worker.terminate();

    return {
      success: true,
      text: ret.data.text || '',
      confidence: ret.data.confidence || 0,
      lines: ret.data.lines?.map(l => l.text) || [],
      lineDetails: ret.data.lines?.map(line => ({ text: line.text, bbox: line.bbox })) || []
    };
  } catch (err) {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    console.error('[OCR Extractor] Error during OCR:', err.message);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: err.message
    };
  }
}

/** Render scanned PDF pages with Poppler and OCR each rendered page. */
export async function extractPdfWithOcr(pdfPath, numPages = 1, language = 'eng', targetPages = null) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'protick-pdf-ocr-'));
  const prefix = path.join(tempDir, 'page');
  let worker = null;

  try {
    const documentPages = Math.max(1, Number(numPages) || 1);
    const targetPageSet = Array.isArray(targetPages) && targetPages.length > 0
      ? new Set(targetPages.map(Number).filter(page => Number.isInteger(page) && page > 0 && page <= documentPages))
      : null;
    const pageNumbersToRender = targetPageSet
      ? [...targetPageSet].sort((a, b) => a - b)
      : Array.from({ length: Math.min(documentPages, 40) }, (_, index) => index + 1);

    try {
      if (targetPageSet) {
        for (const pageNumber of pageNumbersToRender) {
          execFileSync('pdftoppm', [
            '-png', '-r', '200', '-f', String(pageNumber), '-l', String(pageNumber), pdfPath, prefix
          ], { windowsHide: true, timeout: 120000, stdio: 'ignore' });
        }
      } else {
        execFileSync('pdftoppm', [
          '-png', '-r', '200', '-f', '1', '-l', String(pageNumbersToRender.length), pdfPath, prefix
        ], { windowsHide: true, timeout: 120000, stdio: 'ignore' });
      }
    } catch (err) {
      console.warn('[OCR Extractor] pdftoppm rendering unavailable or failed:', err.message);
      return {
        success: false,
        text: '',
        pagesProcessed: 0,
        ocrEngines: ['offline_tesseract'],
        scannedRatio: 1,
        reason: 'pdftoppm_unavailable'
      };
    }

    const renderedPageFiles = fs.readdirSync(tempDir)
      .filter(name => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));

    const pageFiles = targetPageSet
      ? renderedPageFiles.filter(name => targetPageSet.has(Number(name.match(/(\d+)/)[1])))
      : renderedPageFiles;

    if (pageFiles.length === 0) {
      throw new Error('No pages could be rendered for OCR.');
    }

    worker = await createOfflineWorker(language);
    const pages = [];
    for (const pageFile of pageFiles) {
      const result = await worker.recognize(path.join(tempDir, pageFile));
      if (result.data.text?.trim()) {
        pages.push({
          pageNumber: Number(pageFile.match(/(\d+)/)?.[1]) || pages.length + 1,
          text: result.data.text.trim(),
          lines: result.data.lines?.map(line => ({ text: line.text, bbox: line.bbox })) || []
        });
      }
    }

    return {
      success: pages.length > 0,
      text: pages.map(page => page.text).join('\n\n'),
      pagesProcessed: pageFiles.length,
      pages
    };
  } catch (err) {
    console.error('[OCR Extractor] PDF OCR error:', err.message);
    return { success: false, text: '', error: err.message };
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

