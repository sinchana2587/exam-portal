import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import { createWorker } from 'tesseract.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

let pdfjsModulePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;
async function getPdfJs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      try {
        const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      } catch {
        // Worker fallback if resolved dynamically
      }
      return pdfjs;
    })();
  }
  return pdfjsModulePromise;
}

export type SupportedDocumentType = 'PDF' | 'JPG' | 'JPEG' | 'PNG';

export interface ExtractedTextLine {
  pageNumber: number;
  x: number;
  y: number; // Top-down Y coordinate
  width: number;
  height: number;
  text: string;
  confidence: number; // 100 for vector PDF text, 0..100 for OCR
  source: 'PDF_TEXT' | 'OCR';
  tokens: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    confidence: number;
  }[];
}

export interface ExtractedEmbeddedImage {
  assetId: string;
  pageNumber: number;
  x: number;
  y: number; // Top-down Y coordinate of top edge
  width: number; // Layout width on page
  height: number; // Layout height on page
  pixelWidth: number;
  pixelHeight: number;
  mimeType: 'image/png' | 'image/jpeg';
  base64Data: string;
  sha256: string;
  source: 'PDF_XOBJECT' | 'RASTER_CROP' | 'UPLOADED_IMAGE';
}

export interface ExtractedDocumentContent {
  fileType: SupportedDocumentType;
  pageCount: number;
  usedOcr: boolean;
  lines: ExtractedTextLine[];
  images: ExtractedEmbeddedImage[];
  warnings: string[];
}

export class DocumentProcessingError extends Error {
  code:
    | 'UNSUPPORTED_FORMAT'
    | 'CORRUPTED_DOCUMENT'
    | 'PROCESSING_TIMEOUT'
    | 'IMAGE_PROCESSING_FAILED';
  status: number;

  constructor(
    message: string,
    code:
      | 'UNSUPPORTED_FORMAT'
      | 'CORRUPTED_DOCUMENT'
      | 'PROCESSING_TIMEOUT'
      | 'IMAGE_PROCESSING_FAILED',
    status = 400
  ) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.code = code;
    this.status = status;
  }
}

export function detectDocumentType(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): SupportedDocumentType {
  if (!buffer || buffer.length < 8) {
    throw new DocumentProcessingError(
      'The uploaded file is empty or corrupted.',
      'CORRUPTED_DOCUMENT',
      400
    );
  }

  const lower = fileName.toLowerCase();
  const isPdfHeader = buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  const isPngHeader =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isJpegHeader = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    if (!isPdfHeader) {
      throw new DocumentProcessingError(
        'Corrupted PDF document: missing valid %PDF header signature.',
        'CORRUPTED_DOCUMENT',
        400
      );
    }
    return 'PDF';
  }

  if (lower.endsWith('.png') || mimeType === 'image/png') {
    if (!isPngHeader) {
      throw new DocumentProcessingError(
        'Corrupted PNG image: invalid PNG file signature.',
        'CORRUPTED_DOCUMENT',
        400
      );
    }
    return 'PNG';
  }

  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/jpg'
  ) {
    if (!isJpegHeader) {
      throw new DocumentProcessingError(
        'Corrupted JPEG image: invalid JPEG SOI signature.',
        'CORRUPTED_DOCUMENT',
        400
      );
    }
    return lower.endsWith('.jpeg') ? 'JPEG' : 'JPG';
  }

  throw new DocumentProcessingError(
    `Unsupported file format "${path.extname(fileName) || mimeType || 'unknown'}". Supported formats: Text-based PDF, Scanned PDF, JPG/JPEG, and PNG.`,
    'UNSUPPORTED_FORMAT',
    415
  );
}

function multiplyMatrices(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function encodeRawImageToPng(imgObj: {
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8ClampedArray | Uint8Array;
}): { buffer: Buffer; width: number; height: number } | null {
  const width = imgObj?.width || 0;
  const height = imgObj?.height || 0;
  const raw = imgObj?.data;
  if (!width || !height || !raw || raw.length === 0) return null;

  const png = new PNG({ width, height });
  const pixelCount = width * height;
  const kind = imgObj.kind ?? (raw.length === pixelCount * 4 ? 3 : raw.length === pixelCount * 3 ? 2 : 1);

  if (kind === 3 && raw.length >= pixelCount * 4) {
    for (let i = 0; i < pixelCount * 4; i++) {
      png.data[i] = raw[i];
    }
  } else if (kind === 2 && raw.length >= pixelCount * 3) {
    for (let p = 0; p < pixelCount; p++) {
      png.data[p * 4] = raw[p * 3];
      png.data[p * 4 + 1] = raw[p * 3 + 1];
      png.data[p * 4 + 2] = raw[p * 3 + 2];
      png.data[p * 4 + 3] = 255;
    }
  } else if (kind === 1) {
    // 1-bpp mask or 8-bit grayscale
    if (raw.length >= pixelCount) {
      for (let p = 0; p < pixelCount; p++) {
        const g = raw[p];
        png.data[p * 4] = g;
        png.data[p * 4 + 1] = g;
        png.data[p * 4 + 2] = g;
        png.data[p * 4 + 3] = 255;
      }
    } else {
      for (let p = 0; p < pixelCount; p++) {
        const byteIdx = p >> 3;
        const bitIdx = 7 - (p & 7);
        const bit = byteIdx < raw.length ? (raw[byteIdx] >> bitIdx) & 1 : 0;
        const v = bit ? 255 : 0;
        png.data[p * 4] = v;
        png.data[p * 4 + 1] = v;
        png.data[p * 4 + 2] = v;
        png.data[p * 4 + 3] = 255;
      }
    }
  } else {
    return null;
  }

  const buffer = PNG.sync.write(png);
  return { buffer, width, height };
}

let tesseractChain: Promise<unknown> = Promise.resolve();

async function runLocalTesseractOcr(imageBuffer: Buffer): Promise<{
  text: string;
  lines: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    confidence: number;
    words: { x: number; y: number; width: number; height: number; text: string; confidence: number }[];
  }[];
}> {
  const execute = async () => {
    const langPath = path.resolve(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0');
    const worker = await createWorker('eng', 1, {
      langPath,
      gzip: true,
      cacheMethod: 'none',
      logger: () => {
        // Silent local OCR execution
      },
    });
    try {
      const result = await worker.recognize(imageBuffer, {}, { blocks: true });
      const outLines: {
        x: number;
        y: number;
        width: number;
        height: number;
        text: string;
        confidence: number;
        words: { x: number; y: number; width: number; height: number; text: string; confidence: number }[];
      }[] = [];

      const blocks = result.data.blocks || [];
      for (const block of blocks) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            const cleanText = (line.text || '').replace(/\r?\n/g, ' ').trim();
            if (!cleanText) continue;
            const words = (line.words || [])
              .map((w) => ({
                x: w.bbox?.x0 ?? line.bbox.x0,
                y: w.bbox?.y0 ?? line.bbox.y0,
                width: Math.max(1, (w.bbox?.x1 ?? 0) - (w.bbox?.x0 ?? 0)),
                height: Math.max(1, (w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0)),
                text: (w.text || '').trim(),
                confidence: w.confidence ?? line.confidence ?? 0,
              }))
              .filter((w) => w.text.length > 0);
            outLines.push({
              x: line.bbox?.x0 ?? 0,
              y: line.bbox?.y0 ?? 0,
              width: Math.max(1, (line.bbox?.x1 ?? 0) - (line.bbox?.x0 ?? 0)),
              height: Math.max(1, (line.bbox?.y1 ?? 0) - (line.bbox?.y0 ?? 0)),
              text: cleanText,
              confidence: Math.round(line.confidence ?? 0),
              words,
            });
          }
        }
      }

      return {
        text: result.data.text || '',
        lines: outLines,
      };
    } finally {
      await worker.terminate();
    }
  };

  const task = tesseractChain.then(execute, execute);
  tesseractChain = task.catch(() => undefined);
  return task;
}

async function rasterizePdfPagesWithGhostscript(
  pdfBuffer: Buffer,
  pageNumbers: number[]
): Promise<Map<number, { pngBuffer: Buffer; width: number; height: number }>> {
  const result = new Map<number, { pngBuffer: Buffer; width: number; height: number }>();
  if (pageNumbers.length === 0) return result;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mitm-pdf-ocr-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    for (const pageNum of pageNumbers) {
      const outPng = path.join(tmpDir, `page-${pageNum}.png`);
      await execFileAsync(
        'gs',
        [
          '-dNOPAUSE',
          '-dBATCH',
          '-dSAFER',
          '-sDEVICE=png16m',
          '-r200',
          `-dFirstPage=${pageNum}`,
          `-dLastPage=${pageNum}`,
          `-sOutputFile=${outPng}`,
          pdfPath,
        ],
        { timeout: 30000 }
      );
      const pngBuffer = await fs.readFile(outPng);
      const decoded = PNG.sync.read(pngBuffer);
      result.set(pageNum, { pngBuffer, width: decoded.width, height: decoded.height });
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
  return result;
}

function decodeUploadedImageDimensions(
  buffer: Buffer,
  fileType: 'PNG' | 'JPG' | 'JPEG'
): { width: number; height: number; rgba: Uint8Array; pngBuffer: Buffer } {
  try {
    if (fileType === 'PNG') {
      const parsed = PNG.sync.read(buffer);
      return {
        width: parsed.width,
        height: parsed.height,
        rgba: new Uint8Array(parsed.data),
        pngBuffer: buffer,
      };
    }
    const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    if (!decoded || !decoded.width || !decoded.height) {
      throw new Error('Empty JPEG dimensions');
    }
    const png = new PNG({ width: decoded.width, height: decoded.height });
    png.data = Buffer.from(decoded.data);
    return {
      width: decoded.width,
      height: decoded.height,
      rgba: decoded.data,
      pngBuffer: PNG.sync.write(png),
    };
  } catch (err) {
    throw new DocumentProcessingError(
      `Corrupted ${fileType} image: ${err instanceof Error ? err.message : 'unable to decode image pixels'}.`,
      'CORRUPTED_DOCUMENT',
      400
    );
  }
}

/**
 * Extracts dense visual diagram crops from a raster page image excluding regions occupied
 * by recognized OCR text lines, useful for scanned question papers containing diagrams.
 */
function extractNonTextDiagramRegionsFromRaster(
  rgba: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  textLines: { x: number; y: number; width: number; height: number }[],
  pageNumber: number
): ExtractedEmbeddedImage[] {
  if (imgWidth < 80 || imgHeight < 80) return [];

  // Mask out recognized text bounding boxes (with generous padding)
  const isTextMasked = (px: number, py: number) => {
    for (const ln of textLines) {
      if (
        px >= ln.x - 10 &&
        px <= ln.x + ln.width + 10 &&
        py >= ln.y - 8 &&
        py <= ln.y + ln.height + 8
      ) {
        return true;
      }
    }
    return false;
  };

  // Coarse grid (cell = 12x12 px) to find contiguous dark/colored illustration blocks
  const cell = 12;
  const cols = Math.ceil(imgWidth / cell);
  const rows = Math.ceil(imgHeight / cell);
  const active = new Uint8Array(cols * rows);

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const cx = gx * cell + cell / 2;
      const cy = gy * cell + cell / 2;
      if (isTextMasked(cx, cy)) continue;

      let nonWhitePixels = 0;
      const maxX = Math.min(imgWidth, (gx + 1) * cell);
      const maxY = Math.min(imgHeight, (gy + 1) * cell);
      for (let py = gy * cell; py < maxY; py += 2) {
        for (let px = gx * cell; px < maxX; px += 2) {
          const idx = (py * imgWidth + px) * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          if (r < 225 || g < 225 || b < 225) {
            nonWhitePixels += 1;
          }
        }
      }
      if (nonWhitePixels >= 3) {
        active[gy * cols + gx] = 1;
      }
    }
  }

  // BFS connected components across active cells (allowing 1-cell gap bridging)
  const visited = new Uint8Array(cols * rows);
  const regions: { minX: number; minY: number; maxX: number; maxY: number }[] = [];

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const start = gy * cols + gx;
      if (!active[start] || visited[start]) continue;

      const queue: number[] = [start];
      visited[start] = 1;
      let minGx = gx;
      let maxGx = gx;
      let minGy = gy;
      let maxGy = gy;
      let cellCount = 0;

      while (queue.length > 0) {
        const curr = queue.pop()!;
        const cgx = curr % cols;
        const cgy = Math.floor(curr / cols);
        cellCount += 1;
        if (cgx < minGx) minGx = cgx;
        if (cgx > maxGx) maxGx = cgx;
        if (cgy < minGy) minGy = cgy;
        if (cgy > maxGy) maxGy = cgy;

        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = cgx + dx;
            const ny = cgy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const nIdx = ny * cols + nx;
            if (active[nIdx] && !visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      const x0 = Math.max(0, minGx * cell - 4);
      const y0 = Math.max(0, minGy * cell - 4);
      const x1 = Math.min(imgWidth, (maxGx + 1) * cell + 4);
      const y1 = Math.min(imgHeight, (maxGy + 1) * cell + 4);
      const rw = x1 - x0;
      const rh = y1 - y0;

      // Keep genuine diagram-sized blocks (not tiny border artifacts or full-page frames)
      const areaRatio = (rw * rh) / (imgWidth * imgHeight);
      if (rw >= 48 && rh >= 36 && cellCount >= 8 && areaRatio < 0.72) {
        regions.push({ minX: x0, minY: y0, maxX: x1, maxY: y1 });
      }
    }
  }

  return regions
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX)
    .map((reg, idx) => {
      const w = reg.maxX - reg.minX;
      const h = reg.maxY - reg.minY;
      const crop = new PNG({ width: w, height: h });
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const srcIdx = ((reg.minY + py) * imgWidth + (reg.minX + px)) * 4;
          const dstIdx = (py * w + px) * 4;
          crop.data[dstIdx] = rgba[srcIdx];
          crop.data[dstIdx + 1] = rgba[srcIdx + 1];
          crop.data[dstIdx + 2] = rgba[srcIdx + 2];
          crop.data[dstIdx + 3] = rgba[srcIdx + 3];
        }
      }
      const pngBuf = PNG.sync.write(crop);
      return {
        assetId: `img-p${pageNumber}-crop-${idx + 1}`,
        pageNumber,
        x: reg.minX,
        y: reg.minY,
        width: w,
        height: h,
        pixelWidth: w,
        pixelHeight: h,
        mimeType: 'image/png' as const,
        base64Data: pngBuf.toString('base64'),
        sha256: crypto.createHash('sha256').update(pngBuf).digest('hex'),
        source: 'RASTER_CROP' as const,
      };
    });
}

export async function extractDocumentContent(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  extractDiagramRegionsFromRaster?: boolean;
}): Promise<ExtractedDocumentContent> {
  const fileType = detectDocumentType(params.buffer, params.fileName, params.mimeType);
  const warnings: string[] = [];

  if (fileType === 'PNG' || fileType === 'JPG' || fileType === 'JPEG') {
    const decoded = decodeUploadedImageDimensions(params.buffer, fileType);
    const ocr = await runLocalTesseractOcr(decoded.pngBuffer);
    const lines: ExtractedTextLine[] = ocr.lines.map((ln) => ({
      pageNumber: 1,
      x: ln.x,
      y: ln.y,
      width: ln.width,
      height: ln.height,
      text: ln.text,
      confidence: ln.confidence,
      source: 'OCR',
      tokens: ln.words,
    }));

    const images: ExtractedEmbeddedImage[] = params.extractDiagramRegionsFromRaster
      ? extractNonTextDiagramRegionsFromRaster(
          decoded.rgba,
          decoded.width,
          decoded.height,
          ocr.lines,
          1
        )
      : [];

    if (lines.length === 0) {
      warnings.push('OCR did not detect readable text lines inside the uploaded image.');
    }

    return {
      fileType,
      pageCount: 1,
      usedOcr: true,
      lines,
      images,
      warnings,
    };
  }

  // PDF Processing (Text-based, Multi-page, Embedded Image XObjects, Scanned PDF OCR)
  const pdfjs = await getPdfJs();
  let pdfDoc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(params.buffer),
      verbosity: 0,
      useSystemFonts: true,
      disableFontFace: true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    throw new DocumentProcessingError(
      `Corrupted or unreadable PDF document: ${err instanceof Error ? err.message : 'PDF parser failed'}.`,
      'CORRUPTED_DOCUMENT',
      400
    );
  }

  const pageCount = pdfDoc.numPages;
  if (pageCount === 0) {
    throw new DocumentProcessingError('The uploaded PDF contains 0 pages.', 'CORRUPTED_DOCUMENT', 400);
  }

  const allLines: ExtractedTextLine[] = [];
  const allImages: ExtractedEmbeddedImage[] = [];
  const scannedPagesNeedingOcr: number[] = [];
  const pageDims = new Map<number, { width: number; height: number }>();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    pageDims.set(pageNumber, { width: viewport.width, height: viewport.height });

    // 1. Extract vector text with exact top-down page coordinates
    const textContent = await page.getTextContent();
    const rawTokens: {
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      confidence: number;
    }[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const text = item.str;
      if (!text || !text.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const x = tx[4];
      const fontHeight = Math.max(8, Math.hypot(tx[2], tx[3]) || item.height || 10);
      const y = tx[5] - fontHeight; // Top-down Y coordinate
      rawTokens.push({
        x,
        y,
        width: Math.max(2, item.width || text.length * 4),
        height: fontHeight,
        text: text.trim(),
        confidence: 100,
      });
    }

    // Group tokens into top-down lines within 4.5pt vertical tolerance
    rawTokens.sort((a, b) => a.y - b.y || a.x - b.x);
    const pageLines: ExtractedTextLine[] = [];
    for (const tok of rawTokens) {
      const target = pageLines.find((ln) => Math.abs(ln.y - tok.y) <= 4.5);
      if (target) {
        target.tokens.push(tok);
      } else {
        pageLines.push({
          pageNumber,
          x: tok.x,
          y: tok.y,
          width: tok.width,
          height: tok.height,
          text: tok.text,
          confidence: 100,
          source: 'PDF_TEXT',
          tokens: [tok],
        });
      }
    }

    for (const ln of pageLines) {
      ln.tokens.sort((a, b) => a.x - b.x);
      ln.x = ln.tokens[0].x;
      ln.y = Math.min(...ln.tokens.map((t) => t.y));
      const rightEdge = Math.max(...ln.tokens.map((t) => t.x + t.width));
      const bottomEdge = Math.max(...ln.tokens.map((t) => t.y + t.height));
      ln.width = Math.max(1, rightEdge - ln.x);
      ln.height = Math.max(8, bottomEdge - ln.y);
      ln.text = ln.tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
    }

    // 2. Extract embedded PDF images via operator list + CTM tracking
    const opList = await page.getOperatorList();
    const { OPS } = pdfjs;
    const ctmStack: number[][] = [];
    let ctm = [...viewport.transform];
    let imgSeq = 0;

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === OPS.restore) {
        ctm = ctmStack.pop() || [...viewport.transform];
      } else if (fn === OPS.transform && Array.isArray(args) && args.length >= 6) {
        ctm = multiplyMatrices(ctm, args as number[]);
      } else if (
        (fn === OPS.paintImageXObject ||
          fn === OPS.paintInlineImageXObject ||
          fn === OPS.paintImageMaskXObject) &&
        args
      ) {
        try {
          let imgObj: {
            width?: number;
            height?: number;
            kind?: number;
            data?: Uint8ClampedArray | Uint8Array;
          } | null = null;

          if (fn === OPS.paintInlineImageXObject) {
            imgObj = args[0] as typeof imgObj;
          } else {
            const objId = args[0] as string;
            imgObj = await new Promise((resolve) => {
              const timeout = setTimeout(() => resolve(null), 1500);
              try {
                if (page.objs.has(objId)) {
                  clearTimeout(timeout);
                  resolve(page.objs.get(objId));
                  return;
                }
                page.objs.get(objId, (data: unknown) => {
                  clearTimeout(timeout);
                  resolve((data as typeof imgObj) || null);
                });
              } catch {
                clearTimeout(timeout);
                resolve(null);
              }
            });
          }

          const encoded = imgObj ? encodeRawImageToPng(imgObj) : null;
          if (encoded && encoded.width >= 12 && encoded.height >= 12) {
            // Compute top-down bounding box of unit square [0..1]x[0..1] under CTM
            const p0 = [ctm[4], ctm[5]];
            const p1 = [ctm[0] + ctm[4], ctm[1] + ctm[5]];
            const p2 = [ctm[2] + ctm[4], ctm[3] + ctm[5]];
            const p3 = [ctm[0] + ctm[2] + ctm[4], ctm[1] + ctm[3] + ctm[5]];
            const xs = [p0[0], p1[0], p2[0], p3[0]];
            const ys = [p0[1], p1[1], p2[1], p3[1]];
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const drawW = Math.max(1, maxX - minX);
            const drawH = Math.max(1, maxY - minY);

            // Detect whether this XObject is actually a full-page scan image
            const coversWholePage =
              drawW >= viewport.width * 0.85 && drawH >= viewport.height * 0.85;

            if (!coversWholePage) {
              imgSeq += 1;
              allImages.push({
                assetId: `img-p${pageNumber}-${imgSeq}`,
                pageNumber,
                x: minX,
                y: minY,
                width: drawW,
                height: drawH,
                pixelWidth: encoded.width,
                pixelHeight: encoded.height,
                mimeType: 'image/png',
                base64Data: encoded.buffer.toString('base64'),
                sha256: crypto.createHash('sha256').update(encoded.buffer).digest('hex'),
                source: 'PDF_XOBJECT',
              });
            }
          }
        } catch {
          warnings.push(`Skipped an unreadable image XObject on page ${pageNumber}.`);
        }
      }
    }

    const totalTextChars = pageLines.reduce((sum, l) => sum + l.text.length, 0);
    if (totalTextChars < 20) {
      scannedPagesNeedingOcr.push(pageNumber);
    } else {
      allLines.push(...pageLines);
    }
  }

  let usedOcr = false;
  if (scannedPagesNeedingOcr.length > 0) {
    usedOcr = true;
    const rasters = await rasterizePdfPagesWithGhostscript(params.buffer, scannedPagesNeedingOcr);
    for (const pageNum of scannedPagesNeedingOcr) {
      const raster = rasters.get(pageNum);
      if (!raster) continue;
      const pageBox = pageDims.get(pageNum) || { width: raster.width, height: raster.height };
      const scaleX = pageBox.width / raster.width;
      const scaleY = pageBox.height / raster.height;

      const ocr = await runLocalTesseractOcr(raster.pngBuffer);
      for (const ln of ocr.lines) {
        allLines.push({
          pageNumber: pageNum,
          x: ln.x * scaleX,
          y: ln.y * scaleY,
          width: ln.width * scaleX,
          height: ln.height * scaleY,
          text: ln.text,
          confidence: ln.confidence,
          source: 'OCR',
          tokens: ln.words.map((w) => ({
            x: w.x * scaleX,
            y: w.y * scaleY,
            width: w.width * scaleX,
            height: w.height * scaleY,
            text: w.text,
            confidence: w.confidence,
          })),
        });
      }

      if (params.extractDiagramRegionsFromRaster) {
        const parsedPng = PNG.sync.read(raster.pngBuffer);
        const crops = extractNonTextDiagramRegionsFromRaster(
          new Uint8Array(parsedPng.data),
          parsedPng.width,
          parsedPng.height,
          ocr.lines,
          pageNum
        );
        for (const crop of crops) {
          allImages.push({
            ...crop,
            x: crop.x * scaleX,
            y: crop.y * scaleY,
            width: crop.width * scaleX,
            height: crop.height * scaleY,
          });
        }
      }
    }
  }

  allLines.sort((a, b) => a.pageNumber - b.pageNumber || a.y - b.y || a.x - b.x);
  allImages.sort((a, b) => a.pageNumber - b.pageNumber || a.y - b.y || a.x - b.x);

  return {
    fileType,
    pageCount,
    usedOcr,
    lines: allLines,
    images: allImages,
    warnings,
  };
}
