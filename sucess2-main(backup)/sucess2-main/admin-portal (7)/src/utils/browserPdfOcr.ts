export type SupportedDocumentType = 'PDF' | 'JPG' | 'JPEG' | 'PNG';

export interface ExtractedTextToken {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
}

export interface ExtractedTextLine {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  source: 'PDF_TEXT' | 'OCR';
  tokens: ExtractedTextToken[];
}

export interface ExtractedEmbeddedImage {
  assetId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  mimeType: 'image/png' | 'image/jpeg';
  /** Full data URL (`data:image/png;base64,...`) ready for browser preview and Excel embedding */
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

export interface ConversionProgressEvent {
  phase: 'VALIDATING' | 'LOADING_PDF' | 'EXTRACTING_TEXT' | 'RUNNING_OCR' | 'EXTRACTING_IMAGES' | 'PARSING' | 'FINALIZING';
  percent: number;
  message: string;
}

export class BrowserDocumentError extends Error {
  code:
    | 'UNSUPPORTED_FORMAT'
    | 'CORRUPTED_DOCUMENT'
    | 'FILE_TOO_LARGE'
    | 'PROCESSING_TIMEOUT'
    | 'IMAGE_PROCESSING_FAILED';

  constructor(
    message: string,
    code:
      | 'UNSUPPORTED_FORMAT'
      | 'CORRUPTED_DOCUMENT'
      | 'FILE_TOO_LARGE'
      | 'PROCESSING_TIMEOUT'
      | 'IMAGE_PROCESSING_FAILED'
  ) {
    super(message);
    this.name = 'BrowserDocumentError';
    this.code = code;
  }
}

const MAX_BROWSER_DOCUMENT_BYTES = 45 * 1024 * 1024; // 45 MB safeguard

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    parts.push(String.fromCharCode.apply(null, Array.from(slice)));
  }
  return btoa(parts.join(''));
}

export function base64ToUint8Array(base64OrDataUrl: string): Uint8Array {
  const clean = base64OrDataUrl.includes(',')
    ? base64OrDataUrl.slice(base64OrDataUrl.indexOf(',') + 1)
    : base64OrDataUrl;
  const bin = atob(clean.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function ensureImageDataUrl(base64OrDataUrl: string, mimeType: 'image/png' | 'image/jpeg'): string {
  if (!base64OrDataUrl) return '';
  if (base64OrDataUrl.startsWith('data:')) return base64OrDataUrl;
  return `data:${mimeType};base64,${base64OrDataUrl}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function detectDocumentType(
  bytes: Uint8Array,
  fileName: string,
  mimeType?: string
): SupportedDocumentType {
  if (!bytes || bytes.length < 8) {
    throw new BrowserDocumentError(
      'The uploaded file is empty or corrupted.',
      'CORRUPTED_DOCUMENT'
    );
  }

  const lower = fileName.toLowerCase();
  const isPdfHeader =
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d; // %PDF-

  const isPngHeader =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  const isJpegHeader = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    if (!isPdfHeader) {
      throw new BrowserDocumentError(
        'Corrupted PDF document: missing valid %PDF header signature.',
        'CORRUPTED_DOCUMENT'
      );
    }
    return 'PDF';
  }

  if (lower.endsWith('.png') || mimeType === 'image/png') {
    if (!isPngHeader) {
      throw new BrowserDocumentError(
        'Corrupted PNG image: invalid PNG file signature.',
        'CORRUPTED_DOCUMENT'
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
      throw new BrowserDocumentError(
        'Corrupted JPEG image: invalid JPEG SOI signature.',
        'CORRUPTED_DOCUMENT'
      );
    }
    return lower.endsWith('.jpeg') ? 'JPEG' : 'JPG';
  }

  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : mimeType || 'unknown';
  throw new BrowserDocumentError(
    `Unsupported file format "${ext}". Supported formats: Text-based PDF, Scanned PDF, JPG/JPEG, and PNG.`,
    'UNSUPPORTED_FORMAT'
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

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const dataUrl = canvas.toDataURL('image/png');
  return base64ToUint8Array(dataUrl);
}

async function encodePdfImageObjectToPng(imgObj: {
  bitmap?: ImageBitmap;
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8ClampedArray | Uint8Array;
}): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  if (imgObj?.bitmap && imgObj.bitmap.width > 0 && imgObj.bitmap.height > 0) {
    const w = imgObj.bitmap.width;
    const h = imgObj.bitmap.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(imgObj.bitmap, 0, 0);
    const bytes = await canvasToPngBytes(canvas);
    return { bytes, width: w, height: h };
  }

  const width = imgObj?.width || 0;
  const height = imgObj?.height || 0;
  const raw = imgObj?.data;
  if (!width || !height || !raw || raw.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(width, height);
  const pixelCount = width * height;
  const kind =
    imgObj.kind ?? (raw.length === pixelCount * 4 ? 3 : raw.length === pixelCount * 3 ? 2 : 1);

  if (kind === 3 && raw.length >= pixelCount * 4) {
    imgData.data.set(raw.subarray(0, pixelCount * 4));
  } else if (kind === 2 && raw.length >= pixelCount * 3) {
    for (let p = 0; p < pixelCount; p++) {
      imgData.data[p * 4] = raw[p * 3];
      imgData.data[p * 4 + 1] = raw[p * 3 + 1];
      imgData.data[p * 4 + 2] = raw[p * 3 + 2];
      imgData.data[p * 4 + 3] = 255;
    }
  } else if (kind === 1) {
    if (raw.length >= pixelCount) {
      for (let p = 0; p < pixelCount; p++) {
        const g = raw[p];
        imgData.data[p * 4] = g;
        imgData.data[p * 4 + 1] = g;
        imgData.data[p * 4 + 2] = g;
        imgData.data[p * 4 + 3] = 255;
      }
    } else {
      for (let p = 0; p < pixelCount; p++) {
        const byteIdx = p >> 3;
        const bitIdx = 7 - (p & 7);
        const bit = byteIdx < raw.length ? (raw[byteIdx] >> bitIdx) & 1 : 0;
        const v = bit ? 255 : 0;
        imgData.data[p * 4] = v;
        imgData.data[p * 4 + 1] = v;
        imgData.data[p * 4 + 2] = v;
        imgData.data[p * 4 + 3] = 255;
      }
    }
  } else {
    return null;
  }

  ctx.putImageData(imgData, 0, 0);
  const bytes = await canvasToPngBytes(canvas);
  return { bytes, width, height };
}

interface OcrLineResult {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  words: ExtractedTextToken[];
}

let ocrSerialChain: Promise<unknown> = Promise.resolve();

async function runBrowserTesseractOcr(
  imageInput: Blob | HTMLCanvasElement,
  onOcrProgress?: (ratio: number) => void
): Promise<{ text: string; lines: OcrLineResult[] }> {
  const task = ocrSerialChain.then(async () => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      workerPath: '/vendor/ocr/worker.min.js',
      corePath: '/vendor/ocr/core',
      langPath: '/vendor/ocr/lang',
      workerBlobURL: false,
      gzip: true,
      cacheMethod: 'none',
      logger: (msg: { status?: string; progress?: number }) => {
        if (onOcrProgress && typeof msg?.progress === 'number') {
          onOcrProgress(msg.progress);
        }
      },
    });

    try {
      const result = await worker.recognize(imageInput, {}, { blocks: true });
      const rawData = result.data as unknown as {
        text?: string;
        blocks?: {
          paragraphs?: {
            lines?: {
              text?: string;
              confidence?: number;
              bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
              words?: {
                text?: string;
                confidence?: number;
                bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
              }[];
            }[];
          }[];
        }[];
        lines?: {
          text?: string;
          confidence?: number;
          bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
          words?: {
            text?: string;
            confidence?: number;
            bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
          }[];
        }[];
      };

      const collectedLines: NonNullable<typeof rawData.lines> = [];
      if (Array.isArray(rawData.blocks) && rawData.blocks.length > 0) {
        for (const blk of rawData.blocks) {
          for (const para of blk.paragraphs || []) {
            for (const ln of para.lines || []) {
              collectedLines.push(ln);
            }
          }
        }
      } else if (Array.isArray(rawData.lines)) {
        collectedLines.push(...rawData.lines);
      }

      const lines: OcrLineResult[] = collectedLines
        .filter((ln) => ln.text && ln.text.trim())
        .map((ln) => {
          const x0 = ln.bbox?.x0 ?? 0;
          const y0 = ln.bbox?.y0 ?? 0;
          const x1 = ln.bbox?.x1 ?? 100;
          const y1 = ln.bbox?.y1 ?? 20;
          const words: ExtractedTextToken[] = (ln.words || [])
            .filter((w) => w.text && w.text.trim())
            .map((w) => {
              const wx0 = w.bbox?.x0 ?? x0;
              const wy0 = w.bbox?.y0 ?? y0;
              const wx1 = w.bbox?.x1 ?? wx0 + 20;
              const wy1 = w.bbox?.y1 ?? wy0 + 14;
              return {
                x: wx0,
                y: wy0,
                width: Math.max(1, wx1 - wx0),
                height: Math.max(6, wy1 - wy0),
                text: (w.text || '').trim(),
                confidence: Math.round(w.confidence ?? ln.confidence ?? 0),
              };
            });

          return {
            x: x0,
            y: y0,
            width: Math.max(1, x1 - x0),
            height: Math.max(8, y1 - y0),
            text: (ln.text || '').replace(/\s+/g, ' ').trim(),
            confidence: Math.round(ln.confidence ?? 0),
            words,
          };
        });

      return { text: rawData.text || '', lines };
    } finally {
      await worker.terminate();
    }
  });

  ocrSerialChain = task.catch(() => undefined);
  return task;
}

async function extractNonTextDiagramRegionsFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  textLines: { x: number; y: number; width: number; height: number }[],
  pageNumber: number
): Promise<ExtractedEmbeddedImage[]> {
  const imgWidth = sourceCanvas.width;
  const imgHeight = sourceCanvas.height;
  if (imgWidth < 80 || imgHeight < 80) return [];

  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const rgba = ctx.getImageData(0, 0, imgWidth, imgHeight).data;

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

      const areaRatio = (rw * rh) / (imgWidth * imgHeight);
      if (rw >= 48 && rh >= 36 && cellCount >= 8 && areaRatio < 0.72) {
        regions.push({ minX: x0, minY: y0, maxX: x1, maxY: y1 });
      }
    }
  }

  const out: ExtractedEmbeddedImage[] = [];
  const sorted = regions.sort((a, b) => a.minY - b.minY || a.minX - b.minX);

  for (let idx = 0; idx < sorted.length; idx++) {
    const reg = sorted[idx];
    const w = reg.maxX - reg.minX;
    const h = reg.maxY - reg.minY;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) continue;
    cropCtx.drawImage(sourceCanvas, reg.minX, reg.minY, w, h, 0, 0, w, h);

    const bytes = await canvasToPngBytes(cropCanvas);
    const base64 = ensureImageDataUrl(uint8ArrayToBase64(bytes), 'image/png');
    const hash = await sha256Hex(bytes);

    out.push({
      assetId: `img-p${pageNumber}-crop-${idx + 1}`,
      pageNumber,
      x: reg.minX,
      y: reg.minY,
      width: w,
      height: h,
      pixelWidth: w,
      pixelHeight: h,
      mimeType: 'image/png',
      base64Data: base64,
      sha256: hash,
      source: 'RASTER_CROP',
    });
  }

  return out;
}

async function decodeUploadedImageToCanvas(
  file: File
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new BrowserDocumentError('Browser 2D canvas context is unavailable.', 'IMAGE_PROCESSING_FAILED');
    }
    ctx.drawImage(bitmap, 0, 0);
    return { canvas, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export async function extractBrowserDocumentContent(params: {
  file: File;
  extractDiagramRegionsFromRaster?: boolean;
  onProgress?: (ev: ConversionProgressEvent) => void;
}): Promise<ExtractedDocumentContent> {
  const report = params.onProgress || (() => undefined);

  if (params.file.size > MAX_BROWSER_DOCUMENT_BYTES) {
    throw new BrowserDocumentError(
      `Uploaded file (${(params.file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 45 MB browser processing limit.`,
      'FILE_TOO_LARGE'
    );
  }

  report({ phase: 'VALIDATING', percent: 5, message: `Inspecting ${params.file.name}...` });
  const arrayBuf = await params.file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  const fileType = detectDocumentType(bytes, params.file.name, params.file.type);
  const warnings: string[] = [];

  if (fileType === 'PNG' || fileType === 'JPG' || fileType === 'JPEG') {
    report({ phase: 'RUNNING_OCR', percent: 18, message: 'Decoding image & initializing local Tesseract OCR...' });
    let canvas: HTMLCanvasElement;
    try {
      const decoded = await decodeUploadedImageToCanvas(params.file);
      canvas = decoded.canvas;
    } catch (err) {
      throw new BrowserDocumentError(
        `Corrupted ${fileType} image: ${err instanceof Error ? err.message : 'unable to decode image pixels'}.`,
        'CORRUPTED_DOCUMENT'
      );
    }

    const ocr = await runBrowserTesseractOcr(canvas, (ratio) => {
      const pct = Math.min(84, 20 + Math.round(ratio * 64));
      report({
        phase: 'RUNNING_OCR',
        percent: pct,
        message: `Running browser OCR on image (${Math.round(ratio * 100)}%)...`,
      });
    });

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

    let images: ExtractedEmbeddedImage[] = [];
    if (params.extractDiagramRegionsFromRaster) {
      report({ phase: 'EXTRACTING_IMAGES', percent: 88, message: 'Cropping non-text diagram regions...' });
      images = await extractNonTextDiagramRegionsFromCanvas(canvas, ocr.lines, 1);
    }

    if (lines.length === 0) {
      warnings.push('OCR did not detect readable text lines inside the uploaded image.');
    }

    report({ phase: 'FINALIZING', percent: 96, message: 'Preparing structured preview...' });
    return {
      fileType,
      pageCount: 1,
      usedOcr: true,
      lines,
      images,
      warnings,
    };
  }

  // PDF Processing (Text-based, Multi-page, Embedded XObjects, Scanned Page OCR)
  report({ phase: 'LOADING_PDF', percent: 10, message: 'Loading PDF in browser PDF.js worker...' });
  const pdfjs = await loadPdfJs();
  let pdfDoc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      verbosity: 0,
      useSystemFonts: true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    throw new BrowserDocumentError(
      `Corrupted or unreadable PDF document: ${err instanceof Error ? err.message : 'PDF parser failed'}.`,
      'CORRUPTED_DOCUMENT'
    );
  }

  const pageCount = pdfDoc.numPages;
  if (pageCount === 0) {
    throw new BrowserDocumentError('The uploaded PDF contains 0 pages.', 'CORRUPTED_DOCUMENT');
  }

  const allLines: ExtractedTextLine[] = [];
  const allImages: ExtractedEmbeddedImage[] = [];
  const scannedPagesNeedingOcr: number[] = [];
  const pageDims = new Map<number, { width: number; height: number }>();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const pct = 12 + Math.round(((pageNumber - 1) / pageCount) * 42);
    report({
      phase: 'EXTRACTING_TEXT',
      percent: pct,
      message: `Extracting text & embedded objects from page ${pageNumber} of ${pageCount}...`,
    });

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    pageDims.set(pageNumber, { width: viewport.width, height: viewport.height });

    const textContent = await page.getTextContent();
    const rawTokens: ExtractedTextToken[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const text = item.str;
      if (!text || !text.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const x = tx[4];
      const fontHeight = Math.max(8, Math.hypot(tx[2], tx[3]) || item.height || 10);
      const y = tx[5] - fontHeight;
      rawTokens.push({
        x,
        y,
        width: Math.max(2, item.width || text.length * 4),
        height: fontHeight,
        text: text.trim(),
        confidence: 100,
      });
    }

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

    // Extract embedded PDF image XObjects when requested or for image preservation
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
            bitmap?: ImageBitmap;
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

          const encoded = imgObj ? await encodePdfImageObjectToPng(imgObj) : null;
          if (encoded && encoded.width >= 12 && encoded.height >= 12) {
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

            const coversWholePage =
              drawW >= viewport.width * 0.85 && drawH >= viewport.height * 0.85;

            if (!coversWholePage) {
              imgSeq += 1;
              const hash = await sha256Hex(encoded.bytes);
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
                base64Data: ensureImageDataUrl(uint8ArrayToBase64(encoded.bytes), 'image/png'),
                sha256: hash,
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
    for (let idx = 0; idx < scannedPagesNeedingOcr.length; idx++) {
      const pageNum = scannedPagesNeedingOcr[idx];
      const pageBasePct = 56 + Math.round((idx / scannedPagesNeedingOcr.length) * 34);
      report({
        phase: 'RUNNING_OCR',
        percent: pageBasePct,
        message: `Rendering & OCR scanning page ${pageNum} (${idx + 1}/${scannedPagesNeedingOcr.length})...`,
      });

      const page = await pdfDoc.getPage(pageNum);
      const renderViewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        canvas,
        viewport: renderViewport,
      }).promise;

      const pageBox = pageDims.get(pageNum) || { width: canvas.width, height: canvas.height };
      const scaleX = pageBox.width / canvas.width;
      const scaleY = pageBox.height / canvas.height;

      const ocr = await runBrowserTesseractOcr(canvas, (ratio) => {
        const subPct = Math.min(92, pageBasePct + Math.round((ratio / scannedPagesNeedingOcr.length) * 34));
        report({
          phase: 'RUNNING_OCR',
          percent: subPct,
          message: `OCR recognizing page ${pageNum} (${Math.round(ratio * 100)}%)...`,
        });
      });

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
        const crops = await extractNonTextDiagramRegionsFromCanvas(canvas, ocr.lines, pageNum);
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

  report({ phase: 'PARSING', percent: 94, message: 'Structuring extracted records...' });
  return {
    fileType,
    pageCount,
    usedOcr,
    lines: allLines,
    images: allImages,
    warnings,
  };
}
