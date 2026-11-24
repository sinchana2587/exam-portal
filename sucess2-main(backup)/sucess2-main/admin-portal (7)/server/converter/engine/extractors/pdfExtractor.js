// Disable internal noisy logging from pdf2json for non-fatal font messages
process.env.PDF2JSON_DISABLE_LOGS = '1';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import PDFParser from 'pdf2json';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, '../../../uploads/images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function hasUnusableTextLayer(text) {
  if (!text || text.trim().length < 80) return true;
  const tokens = text.match(/[A-Za-z0-9]+/g) || [];
  if (tokens.length < 20) return true;

  // Check for high density of replacement/box/arrow characters (garbled custom font)
  const symbolMatches = text.match(/[■●□•←○▼→◆▲★\uFFFD\u25A0-\u25FF\u2190-\u21FF]/g) || [];
  if (symbolMatches.length > 15 && (symbolMatches.length / text.length) > 0.01) {
    return true;
  }

  const normalWords = tokens.filter(token => token.length >= 3);
  if (normalWords.length < 10) {
    return true;
  }

  const singleLetterTokens = tokens.filter(token => token.length === 1);
  const singleLetterRatio = singleLetterTokens.length / tokens.length;
  const frequencies = new Map();
  for (const token of singleLetterTokens) {
    const normalized = token.toLowerCase();
    frequencies.set(normalized, (frequencies.get(normalized) || 0) + 1);
  }
  const dominantGlyphRatio = Math.max(0, ...frequencies.values()) / tokens.length;

  return singleLetterRatio > 0.7 && dominantGlyphRatio > 0.3;
}

async function extractTextUsingPdfjs(buffer) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let lastY = null;
      let pageLines = [];
      let curLine = [];
      for (const item of content.items) {
        const y = item.transform ? Math.round(item.transform[5] * 10) / 10 : 0;
        if (lastY === null || Math.abs(y - lastY) < 3) {
          curLine.push(item.str);
        } else {
          if (curLine.length > 0) pageLines.push(curLine.join(' '));
          curLine = [item.str];
        }
        lastY = y;
      }
      if (curLine.length > 0) pageLines.push(curLine.join(' '));
      fullText += pageLines.join('\n') + '\n';
    }
    return { text: fullText.trim(), numPages: doc.numPages };
  } catch (err) {
    console.warn('[PDF Extractor] pdfjs extraction error:', err.message);
    return null;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
    ? left
    : aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodePngPredictor(data, width, height, components, predictor) {
  if (predictor <= 1) return data;
  const rowBytes = width * components;
  const bytesPerPixel = components;
  const hasFilterByte = predictor === 15;
  const inputStride = rowBytes + (hasFilterByte ? 1 : 0);
  if (data.length < inputStride * height) throw new Error('Truncated Flate image data.');
  const output = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const inputOffset = y * inputStride;
    const outputOffset = y * rowBytes;
    const filter = hasFilterByte ? data[inputOffset] : predictor - 10;
    const sourceOffset = inputOffset + (hasFilterByte ? 1 : 0);
    for (let x = 0; x < rowBytes; x++) {
      const raw = data[sourceOffset + x];
      const left = x >= bytesPerPixel ? output[outputOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? output[outputOffset + x - rowBytes] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? output[outputOffset + x - rowBytes - bytesPerPixel] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      else if (filter === 2) prediction = above;
      else if (filter === 3) prediction = Math.floor((left + above) / 2);
      else if (filter === 4) prediction = paethPredictor(left, above, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG predictor filter ${filter}.`);
      output[outputOffset + x] = (raw + prediction) & 0xff;
    }
  }
  return output;
}

function encodePdfImageAsPng(object, pixels, alphaPixels = null) {
  const readNumber = (key, fallback) => object.dict.get(PDFName.of(key))?.asNumber?.() ?? fallback;
  const width = readNumber('Width', 0);
  const height = readNumber('Height', 0);
  const bitsPerComponent = readNumber('BitsPerComponent', 0);
  const colorSpace = object.dict.get(PDFName.of('ColorSpace'))?.toString();
  const components = colorSpace === '/DeviceRGB' ? 3 : colorSpace === '/DeviceGray' ? 1 : 0;
  if (!width || !height || bitsPerComponent !== 8 || !components) return null;
  const parms = object.dict.get(PDFName.of('DecodeParms'));
  const predictor = parms?.lookupMaybe?.(PDFName.of('Predictor'))?.asNumber?.() ?? 1;
  const decoded = decodePngPredictor(pixels, width, height, components, predictor);
  if (decoded.length !== width * height * components) throw new Error('Unexpected PDF image pixel count.');
  if (alphaPixels && alphaPixels.length !== width * height) alphaPixels = null;
  const outputComponents = components + (alphaPixels ? 1 : 0);

  const scanlines = Buffer.alloc(height * (width * outputComponents + 1));
  for (let y = 0; y < height; y++) {
    const sourceRowOffset = y * width * components;
    const rowOffset = y * (width * outputComponents + 1);
    if (!alphaPixels) {
      decoded.copy(scanlines, rowOffset + 1, sourceRowOffset, sourceRowOffset + width * components);
      continue;
    }
    for (let x = 0; x < width; x++) {
      const sourceOffset = sourceRowOffset + x * components;
      const targetOffset = rowOffset + 1 + x * outputComponents;
      for (let channel = 0; channel < components; channel++) {
        scanlines[targetOffset + channel] = decoded[sourceOffset + channel];
      }
      scanlines[targetOffset + components] = alphaPixels[y * width + x];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = alphaPixels ? (components === 3 ? 6 : 4) : (components === 3 ? 2 : 0);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makePngChunk('IHDR', header),
    makePngChunk('IDAT', zlib.deflateSync(scanlines)),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
}

function findVectorFigureRegions(page) {
  const strokes = [...(page.HLines || []), ...(page.VLines || [])]
    .filter(item => {
      const match = String(item.oc || '').match(/^#([\da-f]{6})$/i);
      if (!match || Math.max(Number(item.w) || 0, Number(item.l) || 0) < 0.8) return false;
      const rgb = match[1].match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255);
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 0.45;
    })
    .map(item => ({ left: item.x, top: item.y, right: item.x + item.w, bottom: item.y + item.l }));

  const clusters = [];
  for (const stroke of strokes) {
    let cluster = clusters.find(candidate => {
      const gapX = Math.max(0, candidate.left - stroke.right, stroke.left - candidate.right);
      const gapY = Math.max(0, candidate.top - stroke.bottom, stroke.top - candidate.bottom);
      return Math.hypot(gapX, gapY) <= 5.5;
    });
    if (!cluster) {
      cluster = { ...stroke, count: 0 };
      clusters.push(cluster);
    }
    cluster.left = Math.min(cluster.left, stroke.left);
    cluster.top = Math.min(cluster.top, stroke.top);
    cluster.right = Math.max(cluster.right, stroke.right);
    cluster.bottom = Math.max(cluster.bottom, stroke.bottom);
    cluster.count++;
  }
  return clusters.filter(region => region.count >= 4 && region.right - region.left >= 2 && region.bottom - region.top >= 1.5);
}

let pdftoppmInstalled = null;
function isPdftoppmAvailable() {
  if (pdftoppmInstalled !== null) return pdftoppmInstalled;
  try {
    execFileSync('pdftoppm', ['-v'], { stdio: 'ignore', windowsHide: true });
    pdftoppmInstalled = true;
  } catch (_) {
    pdftoppmInstalled = false;
  }
  return pdftoppmInstalled;
}

function extractVectorFigures(filePath, pageIndex, page, pageSize, prefix) {
  if (!isPdftoppmAvailable()) return [];
  const regions = findVectorFigureRegions(page);
  if (!regions.length || !pageSize?.width || !pageSize?.height) return [];
  const dpi = 200;
  const scaleX = pageSize.width / page.Width * dpi / 72;
  const scaleY = pageSize.height / page.Height * dpi / 72;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'protick-vector-'));
  const figures = [];
  try {
    regions.forEach((region, index) => {
      const leftMargin = 0.8;
      const rightMargin = 0.3;
      const topMargin = 0.2;
      const bottomMargin = -0.4;
      const x = Math.max(0, Math.floor((region.left - leftMargin) * scaleX));
      const y = Math.max(0, Math.floor((region.top - topMargin) * scaleY));
      const width = Math.ceil((region.right - region.left + leftMargin + rightMargin) * scaleX);
      const height = Math.ceil((region.bottom - region.top + topMargin + bottomMargin) * scaleY);
      execFileSync('pdftoppm', [
        '-png', '-r', String(dpi), '-f', String(pageIndex + 1), '-l', String(pageIndex + 1),
        '-x', String(x), '-y', String(y), '-W', String(width), '-H', String(height),
        filePath, path.join(tempDir, 'figure')
      ], { windowsHide: true, timeout: 30000, stdio: 'ignore' });
      const rendered = path.join(tempDir, `figure-${pageIndex + 1}.png`);
      if (!fs.existsSync(rendered)) return;
      const filename = `${prefix}_figure_p${pageIndex + 1}_${index}_${Date.now()}.png`;
      const destination = path.join(IMAGES_DIR, filename);
      fs.copyFileSync(rendered, destination);
      figures.push({
        id: `img_${Date.now()}_${index}`,
        filename,
        url: `/uploads/images/${filename}`,
        size: fs.statSync(destination).size,
        extension: 'png',
        vectorFigure: true,
        pageNumber: pageIndex + 1,
        yRatio: region.top / page.Height,
        pagePixelHeight: pageSize.height * dpi / 72
      });
    });
  } catch (err) {
    console.warn('[PDF Extractor] Vector figure rendering warning:', err.message);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return figures;
}

/** Extract decodable PDF raster image streams. Never search arbitrary compressed
 * document bytes for JPEG markers: random stream data can masquerade as an image.
 */
async function extractEmbeddedImagesFromPdf(buffer, prefix = 'pdf_img') {
  const images = [];
  let pageSizes = [];
  try {
    const document = await PDFDocument.load(buffer);
    pageSizes = document.getPages().map(page => page.getSize());
    let count = 0;
    const imageObjects = document.context.enumerateIndirectObjects()
      .filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
    const softMaskRefs = new Set(imageObjects
      .map(([, object]) => object.dict.get(PDFName.of('SMask'))?.toString())
      .filter(Boolean));
    for (const [ref, object] of imageObjects) {
      if (softMaskRefs.has(ref.toString())) continue;
      const filter = object.dict.get(PDFName.of('Filter'))?.toString() || '';
      let imageBytes;
      let extension;
      if (filter === '/DCTDecode') {
        imageBytes = Buffer.from(object.getContents());
        if (imageBytes.length < 4 || imageBytes[0] !== 0xff || imageBytes[1] !== 0xd8 ||
            imageBytes[imageBytes.length - 2] !== 0xff || imageBytes[imageBytes.length - 1] !== 0xd9) continue;
        extension = 'jpg';
      } else if (filter === '/FlateDecode') {
        let alphaPixels = null;
        const softMaskRef = object.dict.get(PDFName.of('SMask'));
        if (softMaskRef) {
          const softMask = document.context.lookup(softMaskRef);
          if (softMask instanceof PDFRawStream && softMask.dict.get(PDFName.of('Filter'))?.toString() === '/FlateDecode') {
            const maskWidth = softMask.dict.get(PDFName.of('Width'))?.asNumber?.();
            const maskHeight = softMask.dict.get(PDFName.of('Height'))?.asNumber?.();
            const maskParms = softMask.dict.get(PDFName.of('DecodeParms'));
            const maskPredictor = maskParms?.lookupMaybe?.(PDFName.of('Predictor'))?.asNumber?.() ?? 1;
            alphaPixels = decodePngPredictor(Buffer.from(decodePDFRawStream(softMask).getBytes()), maskWidth, maskHeight, 1, maskPredictor);
          }
        }
        imageBytes = encodePdfImageAsPng(object, Buffer.from(decodePDFRawStream(object).getBytes()), alphaPixels);
        if (!imageBytes) continue;
        extension = 'png';
      } else {
        continue;
      }

      const imgName = `${prefix}_${Date.now()}_${count}.${extension}`;
      fs.writeFileSync(path.join(IMAGES_DIR, imgName), imageBytes);
      images.push({
        id: `img_${Date.now()}_${count}`,
        filename: imgName,
        url: `/uploads/images/${imgName}`,
        size: imageBytes.length,
        pdfObject: ref.toString(),
        extension
      });
      count++;
    }
  } catch (err) {
    console.warn('[PDF Extractor] Image extraction warning:', err.message);
    return { images, pageSizes: [] };
  }
  return { images, pageSizes };
}

export async function extractFromPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const { images: extractedImages, pageSizes } = await extractEmbeddedImagesFromPdf(buffer, path.basename(filePath, path.extname(filePath))).catch(() => ({ images: [], pageSizes: [] }));

  // Primary: High-fidelity text extraction via Mozilla pdfjs-dist
  const pdfjsResult = await extractTextUsingPdfjs(buffer);
  if (pdfjsResult && pdfjsResult.text && !hasUnusableTextLayer(pdfjsResult.text)) {
    return {
      text: pdfjsResult.text,
      numPages: pdfjsResult.numPages,
      images: extractedImages,
      isScannedLikely: false
    };
  }

  // Secondary fallback: pdf2json parser
  return new Promise((resolve) => {
    // Suppress harmless internal Type3 font decoding console messages
      const originalLog = console.log;
      const originalWarn = console.warn;
      const filterType3 = (args) => {
        const str = args.map(a => String(a || '')).join(' ');
        return /Type3 font|custom Glyph|trying to decode/i.test(str);
      };
      console.log = (...args) => {
        if (filterType3(args)) return;
        originalLog.apply(console, args);
      };
      console.warn = (...args) => {
        if (filterType3(args)) return;
        originalWarn.apply(console, args);
      };

      const cleanup = () => {
        console.log = originalLog;
        console.warn = originalWarn;
      };

      const pdfParser = new PDFParser(null, 1);

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        cleanup();
        try {
          const pages = pdfData.Pages || [];
          const fullPageLines = [];

          pages.forEach((page, pageIndex) => {
            const items = [];
            (page.Texts || []).forEach((t) => {
              const rawT = (t.R && t.R[0] && t.R[0].T) ? t.R[0].T : '';
              let decoded = '';
              try {
                decoded = decodeURIComponent(rawT);
              } catch (_) {
                decoded = unescape(rawT);
              }
              if (decoded) {
                items.push({ x: t.x, y: t.y, w: t.w, text: decoded });
              }
            });

            items.sort((a, b) => {
              if (Math.abs(a.y - b.y) < 0.35) return a.x - b.x;
              return a.y - b.y;
            });

            const lines = [];
            let currentLine = [];
            let lastY = null;
            items.forEach((item) => {
              if (lastY === null || Math.abs(item.y - lastY) < 0.35) {
                currentLine.push(item);
              } else {
                if (currentLine.length > 0) lines.push(currentLine);
                currentLine = [item];
              }
              lastY = item.y;
            });
            if (currentLine.length > 0) lines.push(currentLine);

            lines.forEach((lineItems) => {
              let lineStr = '';
              let lastX = null;
              lineItems.sort((a, b) => a.x - b.x);
              for (const it of lineItems) {
                const isSpace = it.text.trim() === '';
                if (isSpace) {
                  if (!lineStr.endsWith(' ')) lineStr += ' ';
                  continue;
                }
                if (lastX !== null) {
                  const gap = it.x - lastX;
                  if (gap > 2.0 && !lineStr.endsWith('  ')) {
                    lineStr += '  ';
                  } else if (gap > 0.8 && !lineStr.endsWith(' ')) {
                    lineStr += ' ';
                  }
                }
                lineStr += it.text.trim();
                lastX = it.x;
              }
              if (lineStr.trim()) fullPageLines.push(lineStr.trim());
            });

            extractedImages.push(...extractVectorFigures(
              filePath,
              pageIndex,
              page,
              pageSizes[pageIndex],
              path.basename(filePath, path.extname(filePath))
            ));
          });

          const text = fullPageLines.join('\n');
          resolve({
            text: text.trim(),
            numPages: pages.length,
            images: extractedImages,
            isScannedLikely: hasUnusableTextLayer(text)
          });
        } catch (err) {
          console.error('[PDF Extractor] Error processing pdfData:', err.message);
          resolve({ text: '', numPages: 1, images: extractedImages, isScannedLikely: true });
        }
      });

      pdfParser.on('pdfParser_dataError', (err) => {
        cleanup();
        console.warn('[PDF Extractor] pdf2json error:', err);
        resolve({ text: '', numPages: 1, images: extractedImages, isScannedLikely: true });
      });

      // Pass verbosity 0 (ERRORS only) to suppress non-fatal font decoding messages
      pdfParser.loadPDF(filePath, 0);
  });
}
