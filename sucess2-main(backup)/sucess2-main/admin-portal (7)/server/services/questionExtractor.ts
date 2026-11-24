import crypto from 'node:crypto';
import type {
  ConversionLifecycleStatus,
  DetectedModuleGroup,
  ExtractedQuestionPreviewRow,
  ModuleDetectionSource,
  QuestionConversionSession,
  QuestionImageAsset,
  QuestionImageField,
} from '../../src/types';
import {
  DocumentProcessingError,
  extractDocumentContent,
  ExtractedEmbeddedImage,
  ExtractedTextLine,
} from './pdfAndOcrEngine';

const ROMAN_TO_INT: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

function parseModuleToken(token: string): number | null {
  const clean = token.trim().toUpperCase();
  if (/^\d+$/.test(clean)) return Number(clean);
  return ROMAN_TO_INT[clean] ?? null;
}

function detectUncategorizedHeading(lineText: string): boolean {
  const t = lineText.trim();
  return /^(?:uncategorized|unassigned|miscellaneous|unknown\s+module|module\s*\?|general\s+questions|untagged)\b(?:\s*[:|-]|$)/i.test(
    t
  );
}

function detectPageModuleLabel(lineText: string): number | null {
  const t = lineText.trim();
  const pagePrefixMatch = t.match(
    /^(?:page\s+\d+(?:\s+of\s+\d+)?\s*[-:|]\s*)?(?:module|unit|mod)\s*(?:no\.?|number)?\s*[:|-]?\s*(\d{1,2}|[IVX]{1,4})\s*\(?(?:cont(?:\.|inued)?)\)?\s*[:|-]?$/i
  );
  if (pagePrefixMatch) return parseModuleToken(pagePrefixMatch[1]);

  const pageModMatch = t.match(
    /^page\s+\d+(?:\s+of\s+\d+)?\s*[-:|]\s*(?:module|unit|mod)\s*(?:no\.?|number)?\s*[:|-]?\s*(\d{1,2}|[IVX]{1,4})\b(?:\s*[:|-]|$)/i
  );
  if (pageModMatch) return parseModuleToken(pageModMatch[1]);

  return null;
}

function detectModuleHeading(lineText: string): number | null {
  const t = lineText.trim();
  const match = t.match(
    /^(?:module|unit|mod)\s*(?:no\.?|number)?\s*[:|-]?\s*(\d{1,2}|[IVX]{1,4})\b(?:\s*[:|\-–].*|$)/i
  );
  if (match && !/^(?:module|unit|mod)\s+\d+\s*[.):]\s+\S{4,}/i.test(t)) {
    return parseModuleToken(match[1]);
  }

  const pureHeadingMatch = t.match(
    /^(?:module|unit|mod)\s*(?:no\.?|number)?\s*[:|-]?\s*(\d{1,2}|[IVX]{1,4})\s*(?:[-–:|]\s*[A-Za-z0-9 ,&/()-]{0,60})?$/i
  );
  if (pureHeadingMatch && !t.endsWith('?')) {
    return parseModuleToken(pureHeadingMatch[1]);
  }

  const bracketMatch = t.match(/^\[(?:module|mod|m)\s*(\d{1,2}|[IVX]{1,4})\]\s*$/i);
  if (bracketMatch) return parseModuleToken(bracketMatch[1]);

  // Also match banner/title lines such as "BCS550 - Cloud Computing - Module 1" or "PART A: MODULE 2"
  if (
    t.length <= 95 &&
    !t.endsWith('?') &&
    !/^(?:question|q\.?\s*)?\d+\s*[.)]/i.test(t) &&
    !/^(?:what|which|who|when|where|why|how|define|explain|identify|calculate|find)\b/i.test(t)
  ) {
    const titleModMatch = t.match(
      /(?:^|[\s\-:|])(?:module|unit)\s*(?:no\.?|number)?\s*[:|-]?\s*(\d{1,2}|[IVX]{1,4})\b(?:\s*[:|\-–]|$)/i
    );
    if (titleModMatch) return parseModuleToken(titleModMatch[1]);
  }
  return null;
}

function extractInlineModuleTag(text: string): {
  moduleNumber: number | null;
  cleanedText: string;
} {
  let s = text.trim();

  // Leading bracket/paren/prefix tags: [M1], (M2), [Module 3], (Mod 4), M2:, Mod 3 -
  const bracketPrefix = s.match(
    /^\[(?:module|mod|m)\s*[-:.]?\s*(\d{1,2}|[IVX]{1,4})\]\s*[:\-–.]?\s*(.+)$/i
  );
  if (bracketPrefix) {
    return {
      moduleNumber: parseModuleToken(bracketPrefix[1]),
      cleanedText: bracketPrefix[2].trim(),
    };
  }

  const parenPrefix = s.match(
    /^\((?:module|mod|m)\s*[-:.]?\s*(\d{1,2}|[IVX]{1,4})\)\s*[:\-–.]?\s*(.+)$/i
  );
  if (parenPrefix) {
    return {
      moduleNumber: parseModuleToken(parenPrefix[1]),
      cleanedText: parenPrefix[2].trim(),
    };
  }

  const explicitPrefix = s.match(
    /^(?:(?:module|mod)\s*[-:.]?\s*(\d{1,2}|[IVX]{1,4})|m\s*(\d{1,2}))\s*[:\-–]\s*(.+)$/i
  );
  if (explicitPrefix) {
    const token = explicitPrefix[1] || explicitPrefix[2];
    return {
      moduleNumber: parseModuleToken(token),
      cleanedText: explicitPrefix[3].trim(),
    };
  }

  // Trailing explicit tag like "...? [M2]" or "...? (Module 3)"
  const trailingTag = s.match(
    /^(.*?)\s*(?:\[(?:module|mod|m)\s*[-:.]?\s*(\d{1,2}|[IVX]{1,4})\]|\((?:module|mod|m)\s*[-:.]?\s*(\d{1,2}|[IVX]{1,4})\))$/i
  );
  if (trailingTag && trailingTag[1].trim().length > 0) {
    const token = trailingTag[2] || trailingTag[3];
    return {
      moduleNumber: parseModuleToken(token),
      cleanedText: trailingTag[1].trim(),
    };
  }

  return { moduleNumber: null, cleanedText: s };
}

function parsePageRangeSelection(rangeStr: string | undefined, maxPages: number): Set<number> | null {
  if (!rangeStr || !rangeStr.trim()) return null;
  const pages = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const dash = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (dash) {
      const start = Math.max(1, Number(dash[1]));
      const end = Math.min(maxPages, Number(dash[2]));
      for (let p = start; p <= end; p++) pages.add(p);
    } else if (/^\d+$/.test(part)) {
      const p = Number(part);
      if (p >= 1 && p <= maxPages) pages.add(p);
    }
  }
  return pages.size > 0 ? pages : null;
}

interface RawOptionAnchor {
  field: 'OPTION_A' | 'OPTION_B' | 'OPTION_C' | 'OPTION_D';
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

interface RawQuestionDraft {
  previewId: string;
  questionNumber: number | null;
  detectedModuleNumber: number | null;
  moduleSource: ModuleDetectionSource;
  pageStart: number;
  pageEnd: number;
  startY: number;
  endY: number;
  stemLines: ExtractedTextLine[];
  optionAnchors: RawOptionAnchor[];
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  answerKeyStatus: 'EXTRACTED' | 'MISSING' | 'INVALID';
  images: QuestionImageAsset[];
  confidence: number;
  ocrUncertain: boolean;
}

function extractInlineOptionsFromText(
  text: string
): { label: 'A' | 'B' | 'C' | 'D'; content: string; approxRatioX: number }[] {
  // Detect options on one line ("A. Stack   B. Queue"), 2-column rows ("C) Tree  D) Graph"), or stacked single-option lines ("C)")
  const regex = /(?:^|\s)(?:\(([A-Da-d])\)|([A-Da-d])[.):])\s*/g;
  const matches: { label: 'A' | 'B' | 'C' | 'D'; startIdx: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const letter = (m[1] || m[2]).toUpperCase() as 'A' | 'B' | 'C' | 'D';
    // At the start of a line (m.index === 0), any option label A..D may appear (stacked or 2-col C/D row).
    // Mid-line, only start a new sequence at A unless already inside an option sequence on this line.
    if (matches.length === 0 && m.index > 0 && letter !== 'A') continue;
    matches.push({
      label: letter,
      startIdx: m.index,
      contentStart: m.index + m[0].length,
    });
  }
  if (matches.length === 0) return [];

  // Ensure monotonic alphabetical progression starting from matches[0].label (e.g. A->B->C->D or C->D)
  const expectedOrder: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  let nextIdx = expectedOrder.indexOf(matches[0].label);
  const ordered: typeof matches = [];
  for (const item of matches) {
    if (nextIdx < expectedOrder.length && item.label === expectedOrder[nextIdx]) {
      ordered.push(item);
      nextIdx += 1;
    }
  }
  if (ordered.length === 0) return [];

  return ordered.map((item, idx) => {
    const nextStart = idx + 1 < ordered.length ? ordered[idx + 1].startIdx : text.length;
    return {
      label: item.label,
      content: text.slice(item.contentStart, nextStart).trim(),
      approxRatioX: item.startIdx / Math.max(1, text.length),
    };
  });
}

function parseAnswerKeyMap(lines: ExtractedTextLine[]): {
  keyStartIdx: number;
  answersByQNum: Map<number, string>;
} {
  const answersByQNum = new Map<number, string>();
  let keyStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^(?:answer\s*key|answers|key\s*sheet)\s*[:|-]?$/i.test(lines[i].text.trim())) {
      keyStartIdx = i;
      break;
    }
  }
  if (keyStartIdx === -1) return { keyStartIdx: -1, answersByQNum };

  for (let i = keyStartIdx + 1; i < lines.length; i++) {
    const txt = lines[i].text;
    const pairs = txt.matchAll(/(?:Q\.?\s*)?(\d{1,3})\s*[-.:)]\s*([A-Da-d])\b/g);
    for (const p of pairs) {
      answersByQNum.set(Number(p[1]), p[2].toUpperCase());
    }
  }
  return { keyStartIdx, answersByQNum };
}

function associateImagesWithDrafts(
  drafts: RawQuestionDraft[],
  images: ExtractedEmbeddedImage[]
): { unassignedImages: QuestionImageAsset[] } {
  const unassignedImages: QuestionImageAsset[] = [];

  for (const img of images) {
    const imgCenterX = img.x + img.width / 2;
    const imgCenterY = img.y + img.height / 2;

    // Candidate questions on the same page
    const pageDrafts = drafts.filter(
      (d) => img.pageNumber >= d.pageStart && img.pageNumber <= d.pageEnd
    );

    if (pageDrafts.length === 0) {
      unassignedImages.push({
        assetId: img.assetId,
        targetField: 'QUESTION_TEXT',
        sequence: 1,
        mimeType: img.mimeType,
        width: img.pixelWidth,
        height: img.pixelHeight,
        base64Data: img.base64Data,
        pageNumber: img.pageNumber,
        uncertainAssociation: true,
        associationNote: `Extracted from page ${img.pageNumber}, but no question block matched on that page. Assign manually.`,
        sha256: img.sha256,
      });
      continue;
    }

    // Score each candidate question on this page by vertical enclosure / immediate proximity
    let bestDraft: RawQuestionDraft | null = null;
    let bestScore = Infinity;
    let secondBestScore = Infinity;

    for (const d of pageDrafts) {
      const blockTop = d.pageStart === img.pageNumber ? d.startY - 12 : -Infinity;
      const blockBottom = d.pageEnd === img.pageNumber ? d.endY + 18 : Infinity;

      let dist = 0;
      if (imgCenterY >= blockTop && imgCenterY <= blockBottom) {
        dist = 0;
      } else if (imgCenterY < blockTop) {
        dist = blockTop - imgCenterY + 200; // Penalize image appearing above question start
      } else {
        dist = imgCenterY - blockBottom;
      }

      if (dist < bestScore) {
        secondBestScore = bestScore;
        bestScore = dist;
        bestDraft = d;
      } else if (dist < secondBestScore) {
        secondBestScore = dist;
      }
    }

    if (!bestDraft || bestScore > 220) {
      unassignedImages.push({
        assetId: img.assetId,
        targetField: 'QUESTION_TEXT',
        sequence: 1,
        mimeType: img.mimeType,
        width: img.pixelWidth,
        height: img.pixelHeight,
        base64Data: img.base64Data,
        pageNumber: img.pageNumber,
        uncertainAssociation: true,
        associationNote: 'Image location is outside clear question boundaries — assign manually.',
        sha256: img.sha256,
      });
      continue;
    }

    // Determine whether image belongs to Question Text or Option A/B/C/D
    const pageOptions = bestDraft.optionAnchors.filter((o) => o.pageNumber === img.pageNumber);
    let targetField: QuestionImageField = 'QUESTION_TEXT';
    let uncertainAssociation = Math.abs(secondBestScore - bestScore) < 12;
    let associationNote = uncertainAssociation
      ? 'Image sits near a boundary between consecutive questions — verify association.'
      : undefined;

    if (pageOptions.length > 0) {
      const firstOptionTop = Math.min(...pageOptions.map((o) => o.y)) - 8;
      // If image sits above options (inside or directly below question stem), attach to QUESTION_TEXT
      if (imgCenterY < firstOptionTop) {
        targetField = 'QUESTION_TEXT';
      } else {
        // Find closest option anchor considering both Y and X (for 2-col or 4-col option grids)
        let bestOpt: RawOptionAnchor | null = null;
        let bestOptDist = Infinity;
        let secondOptDist = Infinity;

        for (const opt of pageOptions) {
          const dy = Math.abs(imgCenterY - (opt.y + opt.height / 2));
          // Vertical list options: prioritize Y distance; same-row options: include X distance
          const sameRow = Math.abs(imgCenterY - opt.y) < 38 || Math.abs(img.y - opt.y) < 35;
          const dx = sameRow ? Math.max(0, opt.x - imgCenterX) + Math.abs(img.x - opt.x) * 0.45 : 0;
          const score = dy * (sameRow ? 0.5 : 1.0) + dx * 0.35;
          if (score < bestOptDist) {
            secondOptDist = bestOptDist;
            bestOptDist = score;
            bestOpt = opt;
          } else if (score < secondOptDist) {
            secondOptDist = score;
          }
        }

        if (bestOpt && bestOptDist < 120) {
          targetField = bestOpt.field;
          if (secondOptDist - bestOptDist < 8) {
            uncertainAssociation = true;
            associationNote = `Image sits closely between ${bestOpt.field} and an adjacent option — verify association.`;
          }
        } else {
          uncertainAssociation = true;
          associationNote = 'Could not confidently determine option vs question placement — verify association.';
        }
      }
    }

    const existingInField = bestDraft.images.filter((i) => i.targetField === targetField).length;
    bestDraft.images.push({
      assetId: img.assetId,
      targetField,
      sequence: existingInField + 1,
      mimeType: img.mimeType,
      width: img.pixelWidth,
      height: img.pixelHeight,
      base64Data: img.base64Data,
      pageNumber: img.pageNumber,
      uncertainAssociation,
      associationNote,
      sha256: img.sha256,
    });
  }

  return { unassignedImages };
}

export interface QuestionValidationInputs {
  subjectModuleCount: number;
  departmentCode: string;
  semesterNumber: number;
  subjectCode: string;
  conversionId: string;
  existingQuestionTexts: string[];
  unassignedImages: QuestionImageAsset[];
}

export function revalidateQuestionSessionRecords(
  rawRecords: {
    previewId: string;
    rowNumber: number;
    questionNumber?: number | null;
    detectedModuleNumber?: number | null;
    assignedModuleNumber: number | null;
    moduleSource?: ModuleDetectionSource;
    pageNumber: number;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    answerKeyStatus: 'EXTRACTED' | 'MISSING' | 'INVALID';
    images: QuestionImageAsset[];
    confidence?: number;
    ocrUncertain?: boolean;
  }[],
  inputs: QuestionValidationInputs
): {
  records: ExtractedQuestionPreviewRow[];
  detectedModules: DetectedModuleGroup[];
  multiModuleDetected: boolean;
  readyModuleCount: number;
  needsModuleReviewCount: number;
  totalImageCount: number;
  validationErrors: QuestionConversionSession['validationErrors'];
  status: ConversionLifecycleStatus;
  statusMessage: string;
  downloadEligible: boolean;
} {
  const existingSet = new Set(
    inputs.existingQuestionTexts.map((t) => t.trim().toLowerCase())
  );
  const seenTextsInFile = new Map<string, number>();
  for (const r of rawRecords) {
    const norm = r.questionText.trim().toLowerCase();
    if (!norm) continue;
    seenTextsInFile.set(norm, (seenTextsInFile.get(norm) || 0) + 1);
  }

  const validationErrors: QuestionConversionSession['validationErrors'] = [];

  const records: ExtractedQuestionPreviewRow[] = rawRecords.map((raw, idx) => {
    const rowNumber = idx + 1;
    const previewId = raw.previewId || `prev-q-${rowNumber}`;
    const rawAssigned =
      raw.assignedModuleNumber === null || raw.assignedModuleNumber === undefined
        ? null
        : Number(raw.assignedModuleNumber);
    const hasValidRangeModule =
      rawAssigned !== null &&
      Number.isInteger(rawAssigned) &&
      rawAssigned >= 1 &&
      rawAssigned <= inputs.subjectModuleCount;
    const assignedModuleNumber = hasValidRangeModule ? rawAssigned : null;

    const questionText = (raw.questionText || '').trim();
    const optionA = (raw.optionA || '').trim();
    const optionB = (raw.optionB || '').trim();
    const optionC = (raw.optionC || '').trim();
    const optionD = (raw.optionD || '').trim();
    const correctOption = (raw.correctOption || '').trim().toUpperCase();

    const imgs = (raw.images || []).map((img, i) => ({
      ...img,
      sequence: img.sequence || i + 1,
    }));

    const qImgs = imgs.filter((im) => im.targetField === 'QUESTION_TEXT');
    const aImgs = imgs.filter((im) => im.targetField === 'OPTION_A');
    const bImgs = imgs.filter((im) => im.targetField === 'OPTION_B');
    const cImgs = imgs.filter((im) => im.targetField === 'OPTION_C');
    const dImgs = imgs.filter((im) => im.targetField === 'OPTION_D');

    const errors: string[] = [];
    let modInvalid = false;
    let uncertainModule = false;
    let qInvalid = false;
    let aInvalid = false;
    let bInvalid = false;
    let cInvalid = false;
    let dInvalid = false;
    let keyInvalid = false;
    let imgInvalid = false;

    if (rawAssigned !== null && !hasValidRangeModule) {
      modInvalid = true;
      uncertainModule = true;
      const msg = `Module ${rawAssigned} is outside configured subject range (1–${inputs.subjectModuleCount}). Assign a valid module manually.`;
      errors.push(msg);
      validationErrors.push({ rowNumber, previewId, field: 'Module Number', explanation: msg });
    } else if (assignedModuleNumber === null) {
      modInvalid = true;
      uncertainModule = true;
      const outOfRangeDetected =
        typeof raw.detectedModuleNumber === 'number' &&
        (raw.detectedModuleNumber < 1 || raw.detectedModuleNumber > inputs.subjectModuleCount);
      const msg = outOfRangeDetected
        ? `Detected Module ${raw.detectedModuleNumber} is outside configured subject range (1–${inputs.subjectModuleCount}). Select a valid module.`
        : `Needs Module Review — module could not be identified confidently from the document. Select Module 1–${inputs.subjectModuleCount}.`;
      errors.push(msg);
      validationErrors.push({ rowNumber, previewId, field: 'Module Number', explanation: msg });
    }

    if ((!questionText && qImgs.length === 0) || questionText.includes('???')) {
      qInvalid = true;
      const msg = 'Missing or unreadable Question Text (and no question diagram attached).';
      errors.push(msg);
      validationErrors.push({ rowNumber, previewId, field: 'Question Text', explanation: msg });
    } else if (questionText) {
      const norm = questionText.toLowerCase();
      if ((seenTextsInFile.get(norm) || 0) > 1) {
        qInvalid = true;
        const msg = 'Duplicate question text within this conversion batch.';
        errors.push(msg);
        validationErrors.push({ rowNumber, previewId, field: 'Question Text', explanation: msg });
      }
      if (existingSet.has(norm)) {
        qInvalid = true;
        const msg = 'Duplicate of an existing active question in this subject.';
        errors.push(msg);
        validationErrors.push({ rowNumber, previewId, field: 'Question Text', explanation: msg });
      }
    }

    const optsCheck: [string, QuestionImageAsset[], 'OPTION_A' | 'OPTION_B' | 'OPTION_C' | 'OPTION_D', () => void][] = [
      [optionA, aImgs, 'OPTION_A', () => { aInvalid = true; }],
      [optionB, bImgs, 'OPTION_B', () => { bInvalid = true; }],
      [optionC, cImgs, 'OPTION_C', () => { cInvalid = true; }],
      [optionD, dImgs, 'OPTION_D', () => { dInvalid = true; }],
    ];

    optsCheck.forEach(([txt, optImgs, label, markBad]) => {
      if ((!txt && optImgs.length === 0) || txt.includes('???')) {
        markBad();
        const msg = `${label.replace('_', ' ')} is missing both text and option image.`;
        errors.push(msg);
        validationErrors.push({ rowNumber, previewId, field: label, explanation: msg });
      }
    });

    const allPresent = !aInvalid && !bInvalid && !cInvalid && !dInvalid;
    if (allPresent) {
      const optSigs = [
        `${optionA.toLowerCase()}::${aImgs.map((x) => x.sha256 || x.assetId).join(',')}`,
        `${optionB.toLowerCase()}::${bImgs.map((x) => x.sha256 || x.assetId).join(',')}`,
        `${optionC.toLowerCase()}::${cImgs.map((x) => x.sha256 || x.assetId).join(',')}`,
        `${optionD.toLowerCase()}::${dImgs.map((x) => x.sha256 || x.assetId).join(',')}`,
      ];
      if (new Set(optSigs).size < 4) {
        aInvalid = true;
        bInvalid = true;
        const msg = 'Duplicate option content detected across Options A–D.';
        errors.push(msg);
        validationErrors.push({ rowNumber, previewId, field: 'Options A–D', explanation: msg });
      }
    }

    const answerKeyStatus: ExtractedQuestionPreviewRow['answerKeyStatus'] = !correctOption
      ? 'MISSING'
      : ['A', 'B', 'C', 'D'].includes(correctOption)
      ? 'EXTRACTED'
      : 'INVALID';

    if (answerKeyStatus === 'MISSING') {
      keyInvalid = true;
      const msg = 'Missing Correct Option — select A, B, C, or D manually (never auto-guessed).';
      errors.push(msg);
      validationErrors.push({ rowNumber, previewId, field: 'Correct Option', explanation: msg });
    } else if (answerKeyStatus === 'INVALID') {
      keyInvalid = true;
      const msg = `Invalid Correct Option "${correctOption}" — must be A, B, C, or D.`;
      errors.push(msg);
      validationErrors.push({ rowNumber, previewId, field: 'Correct Option', explanation: msg });
    }

    const uncertainImgs = imgs.filter((im) => im.uncertainAssociation);
    if (uncertainImgs.length > 0) {
      imgInvalid = true;
      const msg = `${uncertainImgs.length} image association(s) marked uncertain — confirm placement or reassign.`;
      errors.push(msg);
      validationErrors.push({ rowNumber, previewId, field: 'Images', explanation: msg });
    }

    for (const im of imgs) {
      if (!im.base64Data || (im.mimeType !== 'image/png' && im.mimeType !== 'image/jpeg')) {
        imgInvalid = true;
        const msg = `Corrupted or unsupported image asset (${im.assetId}).`;
        errors.push(msg);
        validationErrors.push({ rowNumber, previewId, field: 'Images', explanation: msg });
      }
    }

    const isValid = errors.length === 0;
    const uncertain =
      !isValid ||
      uncertainModule ||
      Boolean(raw.ocrUncertain) ||
      (typeof raw.confidence === 'number' && raw.confidence < 75);

    const moduleSource: ModuleDetectionSource =
      raw.moduleSource ||
      (assignedModuleNumber !== null ? 'MANUAL' : 'UNKNOWN');

    return {
      previewId,
      rowNumber,
      questionNumber: raw.questionNumber ?? null,
      detectedModuleNumber: raw.detectedModuleNumber ?? null,
      assignedModuleNumber,
      moduleSource,
      pageNumber: raw.pageNumber || 1,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      answerKeyStatus,
      images: imgs,
      confidence: raw.confidence,
      isValid,
      uncertain,
      uncertainModule,
      errors,
      invalidFields: {
        moduleNumber: modInvalid,
        questionText: qInvalid,
        optionA: aInvalid,
        optionB: bInvalid,
        optionC: cInvalid,
        optionD: dInvalid,
        correctOption: keyInvalid,
        images: imgInvalid,
      },
      note: isValid
        ? `Valid Module ${assignedModuleNumber} question`
        : errors.join(' | '),
    };
  });

  // Scope unassigned images per page-module when unambiguous, or block globally when ambiguous
  const unassignedByModule = new Map<number, number>();
  let globalUnresolvedImageBlock = false;
  for (const img of inputs.unassignedImages) {
    const pg = img.pageNumber || 1;
    const pageRecords = records.filter((r) => r.pageNumber === pg);
    const hasNullOnPage = pageRecords.some((r) => r.assignedModuleNumber === null);
    const pageModules = new Set(
      pageRecords
        .map((r) => r.assignedModuleNumber)
        .filter((m): m is number => m !== null)
    );
    if (pageRecords.length > 0 && !hasNullOnPage && pageModules.size === 1) {
      const targetMod = Array.from(pageModules)[0];
      unassignedByModule.set(targetMod, (unassignedByModule.get(targetMod) || 0) + 1);
    } else {
      globalUnresolvedImageBlock = true;
    }
  }

  // Group records by valid moduleNumber and validate each module independently
  const grouped = new Map<number, ExtractedQuestionPreviewRow[]>();
  for (const rec of records) {
    if (rec.assignedModuleNumber === null) continue;
    const list = grouped.get(rec.assignedModuleNumber) || [];
    list.push(rec);
    grouped.set(rec.assignedModuleNumber, list);
  }

  const detectedModules: DetectedModuleGroup[] = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([modNum, modRows]) => {
      const pageStart = Math.min(...modRows.map((r) => r.pageNumber || 1));
      const pageEnd = Math.max(...modRows.map((r) => r.pageNumber || 1));
      const questionCount = modRows.length;
      const validCount = modRows.filter((r) => r.isValid).length;
      const invalidCount = questionCount - validCount;
      const modNeedsReviewCount = modRows.filter((r) => r.uncertainModule).length;
      const missingOrInvalidKeyCount = modRows.filter((r) => r.invalidFields.correctOption).length;
      const modUnassignedCount = unassignedByModule.get(modNum) || 0;
      const uncertainImageCount =
        modRows.filter((r) => r.invalidFields.images).length + modUnassignedCount;
      const issueCount = invalidCount + modUnassignedCount;

      const modDownloadEligible =
        questionCount > 0 &&
        invalidCount === 0 &&
        modUnassignedCount === 0 &&
        !globalUnresolvedImageBlock;

      const hasHardValidationError = modRows.some(
        (r) =>
          !r.isValid &&
          (r.invalidFields.questionText ||
            r.invalidFields.optionA ||
            r.invalidFields.optionB ||
            r.invalidFields.optionC ||
            r.invalidFields.optionD ||
            r.invalidFields.correctOption)
      );

      const modStatus: DetectedModuleGroup['status'] = modDownloadEligible
        ? 'READY'
        : hasHardValidationError
        ? 'VALIDATION_FAILED'
        : 'REVIEW_REQUIRED';

      return {
        moduleNumber: modNum,
        pageStart,
        pageEnd,
        questionCount,
        validCount,
        invalidCount,
        needsModuleReviewCount: modNeedsReviewCount,
        missingOrInvalidKeyCount,
        uncertainImageCount,
        issueCount,
        status: modStatus,
        downloadEligible: modDownloadEligible,
        recommendedFileName: `${inputs.departmentCode}_Sem${inputs.semesterNumber}_${inputs.subjectCode}_Module_${modNum}_Questions.xlsx`,
        downloadUrl: `/hod/question-banks/conversions/${inputs.conversionId}/excel?moduleNumber=${modNum}`,
        label: `Module ${modNum} (${questionCount} question${questionCount === 1 ? '' : 's'}, pp. ${pageStart}–${pageEnd})`,
      };
    });

  const multiModuleDetected = detectedModules.length > 1;
  const readyModuleCount = detectedModules.filter((g) => g.downloadEligible).length;
  const needsModuleReviewCount = records.filter(
    (r) => r.assignedModuleNumber === null || r.uncertainModule
  ).length;
  const totalImageCount =
    records.reduce((sum, r) => sum + r.images.length, 0) + inputs.unassignedImages.length;

  let status: ConversionLifecycleStatus = 'READY_FOR_EXCEL_DOWNLOAD';
  let statusMessage = '';

  if (records.length === 0) {
    status = 'VALIDATION_FAILED';
    statusMessage = 'No question rows remain in this conversion session.';
  } else if (
    detectedModules.length > 0 &&
    readyModuleCount === detectedModules.length &&
    needsModuleReviewCount === 0 &&
    inputs.unassignedImages.length === 0
  ) {
    status = 'READY_FOR_EXCEL_DOWNLOAD';
    statusMessage = `Validation Passed: ${detectedModules.length} separate module Excel workbook${detectedModules.length === 1 ? '' : 's'} ready (${records.length} validated question${records.length === 1 ? '' : 's'}).`;
  } else if (
    readyModuleCount > 0 ||
    needsModuleReviewCount > 0 ||
    inputs.unassignedImages.length > 0
  ) {
    status = 'MANUAL_REVIEW_REQUIRED';
    const parts: string[] = [];
    if (readyModuleCount > 0) {
      const readyNames = detectedModules
        .filter((g) => g.downloadEligible)
        .map((g) => `Module ${g.moduleNumber}`)
        .join(', ');
      parts.push(
        `${readyModuleCount} of ${detectedModules.length} module workbook(s) ready for Excel download (${readyNames})`
      );
    }
    const blockedMods = detectedModules.filter((g) => !g.downloadEligible);
    if (blockedMods.length > 0) {
      parts.push(
        `${blockedMods.map((g) => `Module ${g.moduleNumber}`).join(', ')} require fixes before export`
      );
    }
    if (needsModuleReviewCount > 0) {
      parts.push(`${needsModuleReviewCount} question(s) marked "Needs Module Review"`);
    }
    if (inputs.unassignedImages.length > 0) {
      parts.push(`${inputs.unassignedImages.length} unassigned image(s) need attachment or discard`);
    }
    statusMessage = `${parts.join(' · ')}.`;
  } else {
    status = 'VALIDATION_FAILED';
    const invalidCount = records.filter((r) => !r.isValid).length;
    statusMessage = `Validation failed on ${invalidCount} question(s). Resolve missing answer keys, options, duplicates, or uncertain image associations before downloading module workbooks.`;
  }

  const downloadEligible = detectedModules.some((g) => g.downloadEligible);

  return {
    records,
    detectedModules,
    multiModuleDetected,
    readyModuleCount,
    needsModuleReviewCount,
    totalImageCount,
    validationErrors,
    status,
    statusMessage,
    downloadEligible,
  };
}

const questionSessions = new Map<string, QuestionConversionSession>();

export function cleanupExpiredQuestionSessions(): void {
  const now = Date.now();
  for (const [id, sess] of questionSessions.entries()) {
    if (Date.parse(sess.expiresAt) <= now) {
      questionSessions.delete(id);
    }
  }
}

export async function createQuestionConversionSession(params: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType?: string;
  hodUserId: string;
  departmentId: string;
  departmentCode: string;
  semesterNumber: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectModuleCount: number;
  existingQuestionTexts?: string[];
  selectedPageRange?: string;
}): Promise<QuestionConversionSession> {
  cleanupExpiredQuestionSessions();

  if (!Number.isInteger(params.subjectModuleCount) || params.subjectModuleCount < 1) {
    throw new DocumentProcessingError(
      `Invalid configured module count (${params.subjectModuleCount}) for subject ${params.subjectCode}.`,
      'UNSUPPORTED_FORMAT',
      400
    );
  }

  const extracted = await extractDocumentContent({
    buffer: params.fileBuffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    extractDiagramRegionsFromRaster: true,
  });

  if (extracted.lines.length === 0) {
    throw new DocumentProcessingError(
      'No readable question text could be extracted from the uploaded document.',
      'CORRUPTED_DOCUMENT',
      400
    );
  }

  const allowedPages = parsePageRangeSelection(params.selectedPageRange, extracted.pageCount);
  const filteredLines = allowedPages
    ? extracted.lines.filter((l) => allowedPages.has(l.pageNumber))
    : extracted.lines;
  const filteredImages = allowedPages
    ? extracted.images.filter((im) => allowedPages.has(im.pageNumber))
    : extracted.images;

  const { keyStartIdx, answersByQNum } = parseAnswerKeyMap(filteredLines);
  const questionLines = keyStartIdx >= 0 ? filteredLines.slice(0, keyStartIdx) : filteredLines;

  // Parse module headings, page labels, inline question tags & questions across all pages
  const drafts: RawQuestionDraft[] = [];
  let activeHeadingModule: number | null = null;
  let activeHeadingSource: ModuleDetectionSource = 'UNKNOWN';
  let currentDraft: RawQuestionDraft | null = null;
  let lastField: 'STEM' | 'OPTION_A' | 'OPTION_B' | 'OPTION_C' | 'OPTION_D' = 'STEM';

  const pushCurrentDraft = () => {
    if (!currentDraft) return;
    if (
      !currentDraft.correctOption &&
      currentDraft.questionNumber !== null &&
      answersByQNum.has(currentDraft.questionNumber)
    ) {
      const k = answersByQNum.get(currentDraft.questionNumber)!;
      currentDraft.correctOption = k;
      currentDraft.answerKeyStatus = ['A', 'B', 'C', 'D'].includes(k) ? 'EXTRACTED' : 'INVALID';
    }
    drafts.push(currentDraft);
    currentDraft = null;
  };

  for (const ln of questionLines) {
    const t = ln.text.trim();
    if (!t) continue;

    // 0. Check page-level module header labels BEFORE skipping generic page numbers
    const pageModLabel = detectPageModuleLabel(t);
    if (pageModLabel !== null) {
      pushCurrentDraft();
      activeHeadingModule = pageModLabel;
      activeHeadingSource = 'PAGE_LABEL';
      continue;
    }

    // Skip generic institutional/page banners
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(t)) continue;
    if (/^maharaja\s+institute\s+of\s+technology/i.test(t)) continue;

    // 1. Reset active heading context if an uncategorized/ambiguous section heading appears
    if (detectUncategorizedHeading(t)) {
      pushCurrentDraft();
      activeHeadingModule = null;
      activeHeadingSource = 'UNKNOWN';
      continue;
    }

    // 2. Detect explicit Module headings (persist across page boundaries until replaced)
    const modHeading = detectModuleHeading(t);
    if (modHeading !== null) {
      pushCurrentDraft();
      activeHeadingModule = modHeading;
      activeHeadingSource = 'HEADING';
      continue;
    }

    // 3. Support pipe-delimited tabular question format (e.g. "2 | Question | A | B | C | D | A")
    if (t.includes('|') && !/^(mod|module)\s*\|/i.test(t)) {
      const parts = t.split('|').map((p) => p.trim());
      if (parts.length >= 6) {
        pushCurrentDraft();
        const modColMatch = parts[0].match(/(\d{1,2})/);
        const modCol = modColMatch
          ? Number(modColMatch[1])
          : activeHeadingModule;
        const modColSource: ModuleDetectionSource = modColMatch
          ? 'QUESTION_LABEL'
          : activeHeadingModule !== null
          ? activeHeadingSource
          : 'UNKNOWN';
        const ansCol = (parts[6] || '').trim().toUpperCase();
        const draft: RawQuestionDraft = {
          previewId: `prev-q-${drafts.length + 1}`,
          questionNumber: drafts.length + 1,
          detectedModuleNumber: modCol,
          moduleSource: modColSource,
          pageStart: ln.pageNumber,
          pageEnd: ln.pageNumber,
          startY: ln.y,
          endY: ln.y + ln.height,
          stemLines: [ln],
          optionAnchors: [],
          questionText: parts[1] || '',
          optionA: parts[2] || '',
          optionB: parts[3] || '',
          optionC: parts[4] || '',
          optionD: parts[5] || '',
          correctOption: ansCol,
          answerKeyStatus: !ansCol ? 'MISSING' : ['A', 'B', 'C', 'D'].includes(ansCol) ? 'EXTRACTED' : 'INVALID',
          images: [],
          confidence: ln.confidence,
          ocrUncertain: ln.source === 'OCR' && ln.confidence < 75,
        };
        drafts.push(draft);
        continue;
      }
    }

    // 4. Detect inline answer line on current question (never fabricate if missing)
    const ansMatch = t.match(/^(?:\[?\s*(?:correct\s*(?:option|answer)|answer|ans|key)\s*[:=-]\s*([A-Za-z0-9]+)\s*\]?)$/i);
    if (ansMatch && currentDraft) {
      const val = ansMatch[1].toUpperCase();
      currentDraft.correctOption = val;
      currentDraft.answerKeyStatus = ['A', 'B', 'C', 'D'].includes(val) ? 'EXTRACTED' : 'INVALID';
      currentDraft.pageEnd = ln.pageNumber;
      currentDraft.endY = Math.max(currentDraft.endY, ln.y + ln.height);
      continue;
    }

    // 5. Extract question-level module tag either before OR after question number
    const preTag = extractInlineModuleTag(t);
    const candidateLine = preTag.moduleNumber !== null ? preTag.cleanedText : t;

    // Detect start of a new numbered question ("Question 1:", "Q1.", "Q.1)", "1.", "Q5 [M2]: ...")
    const qStartMatch =
      candidateLine.match(/^(?:question\s+|q\.?\s*)(\d{1,3})(?:\s*[.:)\-]\s*|\s+(?=\[|\())(.*)$/i) ||
      candidateLine.match(/^(\d{1,3})\s*[.)]\s+(?!.*\b(?:options?|answer)\b$)(.+)$/i);

    if (qStartMatch) {
      pushCurrentDraft();
      const qNum = Number(qStartMatch[1]);
      let qBody = (qStartMatch[2] || '').trim();

      let inlineAns = '';
      const trailingAns = qBody.match(/\s*\[?\s*(?:Ans(?:wer)?|Key)\s*[:=]\s*([A-Da-d])\s*\]?$/i);
      if (trailingAns) {
        inlineAns = trailingAns[1].toUpperCase();
        qBody = qBody.slice(0, trailingAns.index).trim();
      }

      const postTag = extractInlineModuleTag(qBody);
      const finalTagMod = preTag.moduleNumber ?? postTag.moduleNumber;
      if (postTag.moduleNumber !== null) {
        qBody = postTag.cleanedText;
      }

      const detectedMod = finalTagMod !== null ? finalTagMod : activeHeadingModule;
      const modSrc: ModuleDetectionSource =
        finalTagMod !== null
          ? 'QUESTION_LABEL'
          : activeHeadingModule !== null
          ? activeHeadingSource
          : 'UNKNOWN';

      currentDraft = {
        previewId: `prev-q-${drafts.length + 1}`,
        questionNumber: qNum,
        detectedModuleNumber: detectedMod,
        moduleSource: modSrc,
        pageStart: ln.pageNumber,
        pageEnd: ln.pageNumber,
        startY: ln.y,
        endY: ln.y + ln.height,
        stemLines: [ln],
        optionAnchors: [],
        questionText: qBody,
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: inlineAns,
        answerKeyStatus: inlineAns ? 'EXTRACTED' : 'MISSING',
        images: [],
        confidence: ln.confidence,
        ocrUncertain: ln.source === 'OCR' && ln.confidence < 75,
      };
      lastField = 'STEM';
      continue;
    }

    // If a standalone question had a leading inline tag without numeric prefix (e.g. "[M1] What is...")
    if (!currentDraft) {
      if (!isLikelyDocumentHeader(candidateLine)) {
        const inlineOnlyTag = preTag.moduleNumber !== null ? preTag : extractInlineModuleTag(t);
        const detectedMod =
          inlineOnlyTag.moduleNumber !== null ? inlineOnlyTag.moduleNumber : activeHeadingModule;
        const modSrc: ModuleDetectionSource =
          inlineOnlyTag.moduleNumber !== null
            ? 'QUESTION_LABEL'
            : activeHeadingModule !== null
            ? activeHeadingSource
            : 'UNKNOWN';

        currentDraft = {
          previewId: `prev-q-${drafts.length + 1}`,
          questionNumber: drafts.length + 1,
          detectedModuleNumber: detectedMod,
          moduleSource: modSrc,
          pageStart: ln.pageNumber,
          pageEnd: ln.pageNumber,
          startY: ln.y,
          endY: ln.y + ln.height,
          stemLines: [ln],
          optionAnchors: [],
          questionText: inlineOnlyTag.cleanedText,
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctOption: '',
          answerKeyStatus: 'MISSING',
          images: [],
          confidence: ln.confidence,
          ocrUncertain: ln.source === 'OCR' && ln.confidence < 75,
        };
        lastField = 'STEM';
      }
      continue;
    }

    currentDraft.pageEnd = ln.pageNumber;
    currentDraft.endY = ln.pageNumber === currentDraft.pageStart
      ? Math.max(currentDraft.endY, ln.y + ln.height)
      : ln.y + ln.height;
    currentDraft.confidence = Math.min(currentDraft.confidence, ln.confidence);
    if (ln.source === 'OCR' && ln.confidence < 75) currentDraft.ocrUncertain = true;

    // 6. Detect options on this line (single OR multi-column A..D on same horizontal row)
    const inlineOpts = extractInlineOptionsFromText(t);
    if (inlineOpts.length > 0) {
      inlineOpts.forEach((opt) => {
        let optText = opt.content;
        const ansInOpt = optText.match(/\s*\[?\s*(?:Ans(?:wer)?|Key)\s*[:=]\s*([A-Da-d])\s*\]?$/i);
        if (ansInOpt) {
          currentDraft!.correctOption = ansInOpt[1].toUpperCase();
          currentDraft!.answerKeyStatus = 'EXTRACTED';
          optText = optText.slice(0, ansInOpt.index).trim();
        }

        const fieldKey = `OPTION_${opt.label}` as 'OPTION_A' | 'OPTION_B' | 'OPTION_C' | 'OPTION_D';
        const approxX = ln.x + opt.approxRatioX * ln.width;
        currentDraft!.optionAnchors.push({
          field: fieldKey,
          pageNumber: ln.pageNumber,
          x: approxX,
          y: ln.y,
          width: ln.width / inlineOpts.length,
          height: ln.height,
          text: optText,
        });

        if (opt.label === 'A') currentDraft!.optionA = appendFieldText(currentDraft!.optionA, optText);
        if (opt.label === 'B') currentDraft!.optionB = appendFieldText(currentDraft!.optionB, optText);
        if (opt.label === 'C') currentDraft!.optionC = appendFieldText(currentDraft!.optionC, optText);
        if (opt.label === 'D') currentDraft!.optionD = appendFieldText(currentDraft!.optionD, optText);
        lastField = fieldKey;
      });
      continue;
    }

    // 7. Continuation line belonging to stem or active option
    let cleanCont = t;
    const trailingAnsCont = cleanCont.match(/\s*\[?\s*(?:Ans(?:wer)?|Key)\s*[:=]\s*([A-Da-d])\s*\]?$/i);
    if (trailingAnsCont) {
      currentDraft.correctOption = trailingAnsCont[1].toUpperCase();
      currentDraft.answerKeyStatus = 'EXTRACTED';
      cleanCont = cleanCont.slice(0, trailingAnsCont.index).trim();
    }
    if (!cleanCont) continue;

    if (lastField === 'STEM') {
      currentDraft.questionText = appendFieldText(currentDraft.questionText, cleanCont);
      currentDraft.stemLines.push(ln);
    } else if (lastField === 'OPTION_A') {
      currentDraft.optionA = appendFieldText(currentDraft.optionA, cleanCont);
    } else if (lastField === 'OPTION_B') {
      currentDraft.optionB = appendFieldText(currentDraft.optionB, cleanCont);
    } else if (lastField === 'OPTION_C') {
      currentDraft.optionC = appendFieldText(currentDraft.optionC, cleanCont);
    } else if (lastField === 'OPTION_D') {
      currentDraft.optionD = appendFieldText(currentDraft.optionD, cleanCont);
    }
  }
  pushCurrentDraft();

  if (drafts.length === 0) {
    throw new DocumentProcessingError(
      'Could not detect structured multiple-choice questions inside this document.',
      'CORRUPTED_DOCUMENT',
      422
    );
  }

  // Associate extracted embedded/cropped images with exact question/option blocks
  const { unassignedImages } = associateImagesWithDrafts(drafts, filteredImages);

  const conversionId = `qconv-${crypto.randomUUID().slice(0, 12)}`;

  // Retain ALL drafts across all detected modules (never filter by a single target module)
  const rawRows = drafts.map((d, idx) => {
    const inRange =
      d.detectedModuleNumber !== null &&
      Number.isInteger(d.detectedModuleNumber) &&
      d.detectedModuleNumber >= 1 &&
      d.detectedModuleNumber <= params.subjectModuleCount;
    return {
      previewId: `prev-q-${idx + 1}`,
      rowNumber: idx + 1,
      questionNumber: d.questionNumber,
      detectedModuleNumber: d.detectedModuleNumber,
      assignedModuleNumber: inRange ? d.detectedModuleNumber : null,
      moduleSource: d.moduleSource,
      pageNumber: d.pageStart,
      questionText: d.questionText,
      optionA: d.optionA,
      optionB: d.optionB,
      optionC: d.optionC,
      optionD: d.optionD,
      correctOption: d.correctOption,
      answerKeyStatus: d.answerKeyStatus,
      images: d.images,
      confidence: d.confidence,
      ocrUncertain: d.ocrUncertain,
    };
  });

  const validation = revalidateQuestionSessionRecords(rawRows, {
    subjectModuleCount: params.subjectModuleCount,
    departmentCode: params.departmentCode,
    semesterNumber: params.semesterNumber,
    subjectCode: params.subjectCode,
    conversionId,
    existingQuestionTexts: params.existingQuestionTexts || [],
    unassignedImages,
  });

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000);

  const session: QuestionConversionSession = {
    conversionId,
    hodUserId: params.hodUserId,
    departmentId: params.departmentId,
    departmentCode: params.departmentCode,
    semesterNumber: params.semesterNumber,
    subjectId: params.subjectId,
    subjectCode: params.subjectCode,
    subjectName: params.subjectName,
    subjectModuleCount: params.subjectModuleCount,
    originalFileName: params.fileName,
    fileType: extracted.fileType,
    status: validation.status,
    statusMessage: validation.statusMessage,
    pageCount: extracted.pageCount,
    multiModuleDetected: validation.multiModuleDetected,
    detectedModules: validation.detectedModules,
    readyModuleCount: validation.readyModuleCount,
    needsModuleReviewCount: validation.needsModuleReviewCount,
    totalImageCount: validation.totalImageCount,
    selectedPageRange: params.selectedPageRange,
    unassignedImages,
    records: validation.records,
    validationErrors: validation.validationErrors,
    downloadEligible: validation.downloadEligible,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  questionSessions.set(conversionId, session);
  return session;
}

function appendFieldText(existing: string, addition: string): string {
  if (!addition) return existing;
  if (!existing) return addition;
  return `${existing} ${addition}`.replace(/\s+/g, ' ').trim();
}

function isLikelyDocumentHeader(text: string): boolean {
  const t = text.trim();
  return (
    /^(department|dept|semester|sem|subject|course|max\.?\s*marks|time|date|instructions?|note|question\s*bank|model\s*paper)\s*[:|-]/i.test(
      t
    ) ||
    /^[A-Z]{2,5}\d{2,4}\s*[-:|]/i.test(t) ||
    /^(question\s+bank|model\s+question\s+paper|internal\s+assessment)\b/i.test(t)
  );
}

export function getQuestionConversionSession(
  conversionId: string,
  hodUserId: string,
  departmentId: string
): QuestionConversionSession | null {
  cleanupExpiredQuestionSessions();
  const sess = questionSessions.get(conversionId);
  if (!sess) return null;
  if (sess.hodUserId !== hodUserId || sess.departmentId !== departmentId) {
    return null;
  }
  return sess;
}

export function updateQuestionConversionSession(params: {
  conversionId: string;
  hodUserId: string;
  departmentId: string;
  records?: ExtractedQuestionPreviewRow[];
  unassignedImages?: QuestionImageAsset[];
  existingQuestionTexts?: string[];
}): QuestionConversionSession {
  const sess = getQuestionConversionSession(
    params.conversionId,
    params.hodUserId,
    params.departmentId
  );
  if (!sess) {
    throw new DocumentProcessingError('Question conversion session not found or expired.', 'CORRUPTED_DOCUMENT', 404);
  }

  if (Array.isArray(params.unassignedImages)) {
    sess.unassignedImages = params.unassignedImages;
  }

  const nextRecordsInput = (params.records || sess.records).map((r, idx) => ({
    previewId: r.previewId || `prev-q-${idx + 1}`,
    rowNumber: idx + 1,
    questionNumber: r.questionNumber ?? null,
    detectedModuleNumber: r.detectedModuleNumber ?? null,
    assignedModuleNumber:
      r.assignedModuleNumber === null || r.assignedModuleNumber === undefined
        ? null
        : Number(r.assignedModuleNumber),
    moduleSource:
      r.moduleSource ||
      (r.assignedModuleNumber === null || r.assignedModuleNumber === undefined ? 'UNKNOWN' : 'MANUAL'),
    pageNumber: r.pageNumber || 1,
    questionText: r.questionText,
    optionA: r.optionA,
    optionB: r.optionB,
    optionC: r.optionC,
    optionD: r.optionD,
    correctOption: r.correctOption,
    answerKeyStatus: r.answerKeyStatus,
    images: r.images || [],
    confidence: r.confidence,
  }));

  const validation = revalidateQuestionSessionRecords(nextRecordsInput, {
    subjectModuleCount: sess.subjectModuleCount,
    departmentCode: sess.departmentCode,
    semesterNumber: sess.semesterNumber,
    subjectCode: sess.subjectCode,
    conversionId: sess.conversionId,
    existingQuestionTexts: params.existingQuestionTexts || [],
    unassignedImages: sess.unassignedImages,
  });

  sess.records = validation.records;
  sess.detectedModules = validation.detectedModules;
  sess.multiModuleDetected = validation.multiModuleDetected;
  sess.readyModuleCount = validation.readyModuleCount;
  sess.needsModuleReviewCount = validation.needsModuleReviewCount;
  sess.totalImageCount = validation.totalImageCount;
  sess.validationErrors = validation.validationErrors;
  sess.status = validation.status;
  sess.statusMessage = validation.statusMessage;
  sess.downloadEligible = validation.downloadEligible;
  questionSessions.set(sess.conversionId, sess);
  return sess;
}
