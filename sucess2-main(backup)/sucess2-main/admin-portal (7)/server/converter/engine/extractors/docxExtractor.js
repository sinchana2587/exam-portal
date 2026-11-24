import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, '../../../uploads/images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Robust string extractor for legacy OLE2 (.doc) or non-ZIP binary streams
 */
export function extractTextFromBinaryOrOle(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const asciiChunks = [];
    let currentChunk = '';
    for (let i = 0; i < buf.length; i++) {
      const byte = buf[i];
      if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
        currentChunk += String.fromCharCode(byte);
      } else {
        if (currentChunk.trim().length >= 4) {
          asciiChunks.push(currentChunk.trim());
        }
        currentChunk = '';
      }
    }
    if (currentChunk.trim().length >= 4) {
      asciiChunks.push(currentChunk.trim());
    }

    const utf16Chunks = [];
    let currentUtf16 = '';
    for (let i = 0; i < buf.length - 1; i += 2) {
      const charCode = buf[i] | (buf[i + 1] << 8);
      if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
        currentUtf16 += String.fromCharCode(charCode);
      } else {
        if (currentUtf16.trim().length >= 4) {
          utf16Chunks.push(currentUtf16.trim());
        }
        currentUtf16 = '';
      }
    }
    if (currentUtf16.trim().length >= 4) {
      utf16Chunks.push(currentUtf16.trim());
    }

    const asciiJoined = asciiChunks.join('\n');
    const utf16Joined = utf16Chunks.join('\n');
    return utf16Joined.length > asciiJoined.length ? utf16Joined : asciiJoined;
  } catch (err) {
    console.warn('[DocxExtractor] Binary fallback extraction error:', err.message);
    return '';
  }
}

export async function extractFromDocx(filePath) {
  const images = [];
  let imgIndex = 0;

  // Check file signature to ensure it is a valid ZIP package before mammoth/JSZip processes it
  let isZip = false;
  try {
    const headerBuf = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuf, 0, 4, 0);
    fs.closeSync(fd);
    isZip = headerBuf[0] === 0x50 && headerBuf[1] === 0x4B && headerBuf[2] === 0x03 && headerBuf[3] === 0x04;
  } catch (_) {}

  if (!isZip) {
    // Non-ZIP file (e.g. legacy .doc, OLE2 binary, or plain text saved as .docx)
    console.warn(`[DocxExtractor] File "${path.basename(filePath)}" lacks ZIP magic bytes; utilizing binary stream extractor.`);
    const fallbackText = extractTextFromBinaryOrOle(filePath);
    return {
      text: fallbackText,
      textWithImageMarkers: fallbackText,
      html: '',
      tableRows: [],
      images: [],
      messages: [{ type: 'warning', message: 'Document extracted using legacy binary parser.' }]
    };
  }

  const options = {
    convertImage: mammoth.images.inline((element) => {
      return element.read('base64').then((imageBuffer) => {
        const ext = element.contentType.split('/')[1] || 'png';
        const imgName = `docx_img_${Date.now()}_${imgIndex++}.${ext}`;
        const imgPath = path.join(IMAGES_DIR, imgName);
        fs.writeFileSync(imgPath, Buffer.from(imageBuffer, 'base64'));

        const imgObj = {
          id: `img_${Date.now()}_${imgIndex}`,
          filename: imgName,
          url: `/uploads/images/${imgName}`,
          contentType: element.contentType
        };
        images.push(imgObj);

        return {
          src: imgObj.url
        };
      });
    })
  };

  let rawTextResult = { value: '', messages: [] };
  let htmlResult = { value: '' };

  try {
    rawTextResult = await mammoth.extractRawText({ path: filePath });
    htmlResult = await mammoth.convertToHtml({ path: filePath }, options);
  } catch (mammothErr) {
    console.warn('[DocxExtractor] Mammoth/JSZip parse error, falling back to binary parser:', mammothErr.message);
    const fallbackText = extractTextFromBinaryOrOle(filePath);
    return {
      text: fallbackText,
      textWithImageMarkers: fallbackText,
      html: '',
      tableRows: [],
      images: [],
      messages: [{ type: 'warning', message: `OpenXML parsing warning: ${mammothErr.message}` }]
    };
  }
  const textWithImageMarkers = htmlResult.value
    .replace(/<img\b[^>]*>/gi, '\n[Image]\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();


function extractTableRowsFromHtml(html) {
  const tableRows = [];
  const tableMatches = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const tableHtml of tableMatches) {
    const rowMatches = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    if (rowMatches.length < 2) continue;
    const firstRowCells = (rowMatches[0].match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(c =>
      c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
    );
    if (firstRowCells.length === 0) continue;
    for (let i = 1; i < rowMatches.length; i++) {
      const cells = (rowMatches[i].match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(c =>
        c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
      );
      if (cells.length === 0) continue;
      const rowObj = {};
      firstRowCells.forEach((header, idx) => { rowObj[header || 'Col_' + (idx + 1)] = cells[idx] || ''; });
      tableRows.push(rowObj);
    }
  }
  return tableRows;
}

  return {
    text: rawTextResult.value.trim(),
    textWithImageMarkers: images.length > 0 ? textWithImageMarkers : rawTextResult.value.trim(),
    html: htmlResult.value,
    tableRows: extractTableRowsFromHtml(htmlResult.value),
    images,
    messages: rawTextResult.messages || []
  };
}

