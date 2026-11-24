import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { triggerBlobDownload } from './exportUtils';

export type ExamType = 'INTERNAL' | 'SEE';

export interface QpQuestion {
  id: string;
  moduleNumber: number;
  questionText: string;
  options: string[]; // [Option A, Option B, Option C, Option D]
  correctIndex: number; // 0..3
  correctOptionLetter?: 'A' | 'B' | 'C' | 'D';
  rawAnswerInput?: string;
  sourceRow?: number;
}

export interface BlueprintConfig {
  examType: ExamType;
  selectedModules: number[];
  questionsPerModule: Record<number, number>;
  totalQuestions: number;
  totalMarks: number;
  marksPerQuestion: number;
  setsCount: number; // e.g. 1, 2, 4
  versionsCount: number; // e.g. 4 for A, B, C, D
  shuffleQuestions: boolean; // Randomize question positions across versions
  shuffleOptions: boolean; // Randomize options A-D across versions
  randomSeed?: number | string; // Optional seed for reproducible shuffling
}

export interface GeneratedVersionQuestion {
  position: number; // 1-based question number on question paper
  originalId: string;
  moduleNumber: number;
  questionText: string;
  options: string[]; // Permuted options [A, B, C, D]
  correctIndex: number; // 0..3
  correctLetter: 'A' | 'B' | 'C' | 'D';
}

export interface VersionAnswerKeyRow {
  position: number;
  originalId: string;
  moduleNumber: number;
  correctLetter: 'A' | 'B' | 'C' | 'D';
  correctAnswerText: string;
}

export interface GeneratedVersion {
  versionLabel: string; // 'A' | 'B' | 'C' | 'D'
  questions: GeneratedVersionQuestion[];
  answerKeys: VersionAnswerKeyRow[];
}

export interface GeneratedSet {
  setNumber: number;
  setTitle: string; // e.g. 'Set 1'
  baseQuestions: QpQuestion[];
  versions: Record<string, GeneratedVersion>;
  totalQuestions: number;
}

export interface GenerationResult {
  generatedAt: string;
  subjectCode: string;
  subjectName: string;
  departmentCode: string;
  semester: number;
  blueprint: BlueprintConfig;
  sets: GeneratedSet[];
  totalPoolQuestions: number;
  totalUniqueQuestionsAllocated: number;
  isDisjoint: boolean;
  overlapDetected: boolean;
  summaryText: string;
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
export const VERSION_LABELS = ['A', 'B', 'C', 'D'] as const;

/**
 * Creates a deterministic pseudo-random number generator (Mulberry32).
 * If no seed is provided, generates one from current timestamp and random bits.
 */
export function createRng(seedInput?: number | string): { rng: () => number; seed: number } {
  let seedNum: number;
  if (typeof seedInput === 'number' && Number.isFinite(seedInput)) {
    seedNum = seedInput >>> 0;
  } else if (typeof seedInput === 'string' && seedInput.trim().length > 0) {
    let hash = 2166136261;
    for (let i = 0; i < seedInput.length; i++) {
      hash ^= seedInput.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    seedNum = hash >>> 0;
  } else {
    seedNum = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  }

  // Mulberry32
  let a = seedNum;
  const rng = () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return { rng, seed: seedNum };
}

/**
 * In-place Fisher-Yates array shuffle using the provided RNG.
 * If size >= 2 and order is unchanged, swaps first and last to guarantee permutation.
 */
export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  const n = result.length;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }

  if (n >= 2 && result.every((val, idx) => val === items[idx])) {
    const tmp = result[0];
    result[0] = result[n - 1];
    result[n - 1] = tmp;
  }
  return result;
}

export function indexToLetter(idx: number): 'A' | 'B' | 'C' | 'D' {
  const safe = Math.max(0, Math.min(3, Math.floor(idx)));
  return OPTION_LETTERS[safe];
}

export function letterToIndex(letter: string): number {
  const upper = (letter || '').trim().toUpperCase();
  const found = OPTION_LETTERS.indexOf(upper as any);
  return found >= 0 ? found : 0;
}

/**
 * Permutes question options while tracking the correct answer's new index and letter.
 */
export function permuteOptions(
  options: string[],
  correctIndex: number,
  rng: () => number = Math.random
): {
  options: string[];
  correctIndex: number;
  correctLetter: 'A' | 'B' | 'C' | 'D';
} {
  const base = options && options.length > 0 ? options.slice(0, 4) : ['', '', '', ''];
  while (base.length < 4) base.push('');

  const indexed = base.map((text, idx) => ({
    text,
    isCorrect: idx === correctIndex,
  }));

  const shuffled = shuffleArray(indexed, rng);
  const newIndex = Math.max(0, shuffled.findIndex((item) => item.isCorrect));

  return {
    options: shuffled.map((item) => item.text),
    correctIndex: newIndex,
    correctLetter: indexToLetter(newIndex),
  };
}

/**
 * Checks whether candidate question permutation has position collisions
 * with any previously accepted permutation (i.e. question at pos i in both).
 */
export function hasPositionCollision<T extends { id: string }>(
  candidate: T[],
  acceptedPositionMaps: Map<string, number>[]
): boolean {
  for (const posMap of acceptedPositionMaps) {
    for (let i = 0; i < candidate.length; i++) {
      const qId = candidate[i].id;
      const prevPos = posMap.get(qId);
      if (prevPos !== undefined && prevPos === i) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Port of reference `PaperSetVersionGenerator.generateDistinctPositionPermutations`:
 * Generates distinct position permutations across versions, attempting up to 250 random trials
 * to find collision-free permutations before falling back to deterministic cyclic rotations.
 */
export function generateDistinctPositionPermutations<T extends { id: string }>(
  questions: T[],
  versionCount: number,
  rng: () => number = Math.random
): T[][] {
  const total = questions.length;
  if (total === 0) {
    return Array.from({ length: versionCount }, () => []);
  }

  const results: T[][] = [];
  const positionMaps: Map<string, number>[] = [];

  if (total >= versionCount) {
    for (let attempt = 0; attempt < 250 && results.length < versionCount; attempt++) {
      const candidate = shuffleArray(questions, rng);
      if (!hasPositionCollision(candidate, positionMaps)) {
        const map = new Map<string, number>();
        candidate.forEach((q, idx) => map.set(q.id, idx));
        results.push(candidate);
        positionMaps.push(map);
      }
    }
    if (results.length === versionCount) {
      return results;
    }
  }

  // Fallback: Deterministic cyclic rotation offset
  results.length = 0;
  const shuffledBase = shuffleArray(questions, rng);
  const step = Math.max(1, Math.floor(total / versionCount));

  for (let v = 0; v < versionCount; v++) {
    const rotated: T[] = [];
    const offset = v * step;
    for (let i = 0; i < total; i++) {
      rotated.push(shuffledBase[(i + offset) % total]);
    }
    results.push(rotated);
  }
  return results;
}

/**
 * Calculates blueprint parameters and validation details.
 */
export function calculateBlueprint(
  examType: ExamType,
  selectedModules: number[],
  customPerModule: Record<number, number> = {},
  marksPerQuestion: number = 1
): BlueprintConfig {
  const modules =
    selectedModules.length > 0
      ? [...selectedModules].sort((a, b) => a - b)
      : examType === 'SEE'
        ? [1, 2, 3, 4, 5]
        : [1, 2, 3];

  const questionsPerModule: Record<number, number> = {};
  let totalQuestions = 0;

  modules.forEach((mod) => {
    const rawVal = customPerModule[mod];
    const count =
      rawVal !== undefined && Number.isFinite(Number(rawVal)) && Number(rawVal) >= 0
        ? Math.floor(Number(rawVal))
        : examType === 'SEE'
          ? 6
          : 10;
    questionsPerModule[mod] = count;
    totalQuestions += count;
  });

  return {
    examType,
    selectedModules: modules,
    questionsPerModule,
    totalQuestions,
    totalMarks: totalQuestions * marksPerQuestion,
    marksPerQuestion,
    setsCount: 4,
    versionsCount: 4,
    shuffleQuestions: true,
    shuffleOptions: true,
  };
}

/**
 * Main QP Shuffling & Disjoint Sets + Variants Generation Engine.
 * Implements strict zero-overlap between Sets, and collision-free question/option permutations across Versions.
 */
export function generateQPSetsAndVariants(params: {
  subjectCode: string;
  subjectName: string;
  departmentCode: string;
  semester: number;
  questionPool: QpQuestion[];
  blueprint: BlueprintConfig;
}): GenerationResult {
  const { subjectCode, subjectName, departmentCode, semester, questionPool, blueprint } = params;
  const { rng, seed } = createRng(blueprint.randomSeed);

  // 1. Group active valid questions by module
  const byModule: Record<number, QpQuestion[]> = {};
  blueprint.selectedModules.forEach((m) => {
    byModule[m] = [];
  });

  questionPool.forEach((q) => {
    if (byModule[q.moduleNumber]) {
      byModule[q.moduleNumber].push(q);
    }
  });

  // 2. Validate question count per module
  const shortages: string[] = [];
  blueprint.selectedModules.forEach((mod) => {
    const reqPerSet = blueprint.questionsPerModule[mod] || 0;
    const totalRequired = reqPerSet * blueprint.setsCount;
    const available = byModule[mod]?.length || 0;
    if (available < totalRequired) {
      shortages.push(
        `Module ${mod} has ${available} questions, needs ${totalRequired} (${reqPerSet}/set × ${blueprint.setsCount} sets).`
      );
    }
  });

  if (shortages.length > 0) {
    throw new Error(`Insufficient question bank pool:\n${shortages.join('\n')}`);
  }

  // 3. Shuffle each module's pool and slice disjoint chunks for each Set
  const setQuestions: QpQuestion[][] = Array.from({ length: blueprint.setsCount }, () => []);
  const allAllocatedIds = new Set<string>();

  blueprint.selectedModules.forEach((mod) => {
    const reqPerSet = blueprint.questionsPerModule[mod] || 0;
    const pool = shuffleArray(byModule[mod], rng);

    for (let s = 0; s < blueprint.setsCount; s++) {
      const start = s * reqPerSet;
      const end = start + reqPerSet;
      const slice = pool.slice(start, end);
      setQuestions[s].push(...slice);
      slice.forEach((q) => allAllocatedIds.add(q.id));
    }
  });

  // 4. Generate Versions (A, B, C, D) for each Set
  const sets: GeneratedSet[] = [];
  const versionKeys: ('A' | 'B' | 'C' | 'D')[] = VERSION_LABELS.slice(0, blueprint.versionsCount);

  for (let s = 0; s < blueprint.setsCount; s++) {
    const setNum = s + 1;
    const baseList = setQuestions[s];

    // Position permutations for this set across versions
    const permutedLists = blueprint.shuffleQuestions
      ? generateDistinctPositionPermutations(baseList, blueprint.versionsCount, rng)
      : Array.from({ length: blueprint.versionsCount }, () => [...baseList]);

    const versions: Record<string, GeneratedVersion> = {};

    versionKeys.forEach((vLabel, vIdx) => {
      const qList = permutedLists[vIdx];
      const versionQuestions: GeneratedVersionQuestion[] = [];
      const answerKeys: VersionAnswerKeyRow[] = [];

      qList.forEach((q, qIdx) => {
        const position = qIdx + 1;
        let finalOptions = q.options;
        let finalCorrectIndex = q.correctIndex;
        let finalCorrectLetter = q.correctOptionLetter || indexToLetter(q.correctIndex);

        if (blueprint.shuffleOptions) {
          const perm = permuteOptions(q.options, q.correctIndex, rng);
          finalOptions = perm.options;
          finalCorrectIndex = perm.correctIndex;
          finalCorrectLetter = perm.correctLetter;
        }

        versionQuestions.push({
          position,
          originalId: q.id,
          moduleNumber: q.moduleNumber,
          questionText: q.questionText,
          options: finalOptions,
          correctIndex: finalCorrectIndex,
          correctLetter: finalCorrectLetter,
        });

        answerKeys.push({
          position,
          originalId: q.id,
          moduleNumber: q.moduleNumber,
          correctLetter: finalCorrectLetter,
          correctAnswerText: finalOptions[finalCorrectIndex] || '',
        });
      });

      versions[vLabel] = {
        versionLabel: vLabel,
        questions: versionQuestions,
        answerKeys,
      };
    });

    sets.push({
      setNumber: setNum,
      setTitle: `Set ${setNum}`,
      baseQuestions: baseList,
      versions,
      totalQuestions: baseList.length,
    });
  }

  // 5. Verify disjoint property
  let overlapDetected = false;
  for (let i = 0; i < sets.length; i++) {
    const idsA = new Set(sets[i].baseQuestions.map((q) => q.id));
    for (let j = i + 1; j < sets.length; j++) {
      for (const qB of sets[j].baseQuestions) {
        if (idsA.has(qB.id)) {
          overlapDetected = true;
          break;
        }
      }
    }
  }

  const summaryText = `Generated ${sets.length} strictly disjoint question sets for ${subjectCode} (${subjectName}) with ${blueprint.versionsCount} shuffled versions each. Zero overlap: ${!overlapDetected}. Seed: ${seed}.`;

  return {
    generatedAt: new Date().toISOString(),
    subjectCode,
    subjectName,
    departmentCode,
    semester,
    blueprint,
    sets,
    totalPoolQuestions: questionPool.length,
    totalUniqueQuestionsAllocated: allAllocatedIds.size,
    isDisjoint: !overlapDetected,
    overlapDetected,
    summaryText,
  };
}

/**
 * Exports generated QP and answer keys to Excel (.xlsx) workbook.
 */
export function exportQpToExcel(result: GenerationResult): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Generation Summary
  const summaryRows = [
    ['Maharaja Institute of Technology Mysore'],
    ['Department Question Paper Generation & Shuffling Summary'],
    [],
    ['Subject Code', result.subjectCode],
    ['Subject Name', result.subjectName],
    ['Department', result.departmentCode],
    ['Semester', result.semester],
    ['Exam Type', result.blueprint.examType],
    ['Total Questions / Paper', result.blueprint.totalQuestions],
    ['Total Sets Generated', result.sets.length],
    ['Versions per Set', result.blueprint.versionsCount],
    ['Disjoint Sets Confirmed', result.isDisjoint ? 'YES (Zero Overlap)' : 'NO'],
    ['Total Unique Questions Used', result.totalUniqueQuestionsAllocated],
    ['Total Pool Available', result.totalPoolQuestions],
    ['Generated At', result.generatedAt],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Sheet 2: Master Answer Keys for All Sets and Versions
  const answerKeyHeaders = [
    'Set',
    'Version',
    'Q.No',
    'Module',
    'Correct Option',
    'Answer Text',
    'Question ID',
  ];
  const answerKeyRows: (string | number)[][] = [];

  result.sets.forEach((set) => {
    Object.values(set.versions).forEach((ver) => {
      ver.answerKeys.forEach((k) => {
        answerKeyRows.push([
          `Set ${set.setNumber}`,
          `Version ${ver.versionLabel}`,
          k.position,
          k.moduleNumber,
          k.correctLetter,
          k.correctAnswerText,
          k.originalId,
        ]);
      });
    });
  });

  const answerSheet = XLSX.utils.aoa_to_sheet([answerKeyHeaders, ...answerKeyRows]);
  answerSheet['!cols'] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 16 },
    { wch: 45 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, answerSheet, 'Answer_Keys');

  // Sheets for each Set and Version
  result.sets.forEach((set) => {
    Object.values(set.versions).forEach((ver) => {
      const qHeaders = [
        'Q.No',
        'Module',
        'Question Text',
        'Option A',
        'Option B',
        'Option C',
        'Option D',
        'Correct Option',
      ];
      const qRows = ver.questions.map((q) => [
        q.position,
        q.moduleNumber,
        q.questionText,
        q.options[0] || '',
        q.options[1] || '',
        q.options[2] || '',
        q.options[3] || '',
        q.correctLetter,
      ]);

      const qSheet = XLSX.utils.aoa_to_sheet([qHeaders, ...qRows]);
      qSheet['!cols'] = [
        { wch: 6 },
        { wch: 8 },
        { wch: 55 },
        { wch: 28 },
        { wch: 28 },
        { wch: 28 },
        { wch: 28 },
        { wch: 14 },
      ];
      const sheetName = `Set${set.setNumber}_Ver${ver.versionLabel}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, qSheet, sheetName);
    });
  });

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `${result.subjectCode}_QP_Sets_${new Date().toISOString().slice(0, 10)}.xlsx`;
  triggerBlobDownload(blob, filename);
}

/**
 * Exports generated QP to JSON for system import/archival.
 */
export function exportQpToJson(result: GenerationResult): void {
  const jsonStr = JSON.stringify(result, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const filename = `${result.subjectCode}_QP_Generated_${new Date().toISOString().slice(0, 10)}.json`;
  triggerBlobDownload(blob, filename);
}

/**
 * Exports formatted Question Paper PDF for a specific Set & Version (or all sets).
 */
export function exportQpToPdf(
  result: GenerationResult,
  targetSetNumber?: number,
  targetVersionLabel?: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const setsToExport =
    targetSetNumber !== undefined
      ? result.sets.filter((s) => s.setNumber === targetSetNumber)
      : result.sets;

  let isFirstPage = true;

  setsToExport.forEach((set) => {
    const versionsToExport =
      targetVersionLabel !== undefined
        ? [set.versions[targetVersionLabel]].filter(Boolean)
        : Object.values(set.versions);

    versionsToExport.forEach((ver) => {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      // Header Banner
      doc.setFillColor(23, 36, 58);
      doc.rect(36, 30, 523, 56, 'F');

      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE', 297, 50, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Department of ${result.departmentCode} · ${result.blueprint.examType === 'SEE' ? 'Semester End Examination' : 'Internal Assessment'}`,
        297,
        66,
        { align: 'center' }
      );

      // Meta Box
      doc.setDrawColor(217, 226, 239);
      doc.setFillColor(245, 247, 251);
      doc.roundedRect(36, 94, 523, 52, 4, 4, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(23, 36, 58);
      doc.setFont('helvetica', 'bold');
      doc.text(`Subject: ${result.subjectCode} - ${result.subjectName}`, 46, 110);
      doc.text(`Semester: ${result.semester}`, 46, 126);
      doc.text(`Max Marks: ${result.blueprint.totalMarks}`, 46, 138);

      doc.text(`Question Set: ${set.setTitle}`, 390, 110);
      doc.text(`Version: ${ver.versionLabel}`, 390, 126);
      doc.text(`Total Questions: ${ver.questions.length}`, 390, 138);

      // Questions Table
      const tableRows = ver.questions.map((q) => [
        String(q.position),
        `M${q.moduleNumber}`,
        `${q.questionText}\n(A) ${q.options[0] || '-'}\n(B) ${q.options[1] || '-'}\n(C) ${q.options[2] || '-'}\n(D) ${q.options[3] || '-'}`,
      ]);

      autoTable(doc, {
        startY: 156,
        head: [['Q#', 'Mod', 'Question & Multiple-Choice Options']],
        body: tableRows,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 6,
          textColor: [31, 41, 55],
          lineColor: [229, 231, 235],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 32, halign: 'center' },
          1: { cellWidth: 38, halign: 'center' },
          2: { cellWidth: 'auto' },
        },
        margin: { left: 36, right: 36, bottom: 40 },
      });

      // Answer Key Page
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(23, 36, 58);
      doc.text(
        `CONFIDENTIAL MASTER ANSWER KEY · ${set.setTitle} · VERSION ${ver.versionLabel}`,
        297,
        45,
        { align: 'center' }
      );
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${result.subjectCode} - ${result.subjectName} · Generated: ${new Date().toLocaleDateString()}`,
        297,
        60,
        { align: 'center' }
      );

      const keyTableRows = ver.answerKeys.map((k) => [
        String(k.position),
        `Module ${k.moduleNumber}`,
        k.correctLetter,
        k.correctAnswerText,
        k.originalId,
      ]);

      autoTable(doc, {
        startY: 75,
        head: [['Q#', 'Module', 'Correct Option', 'Correct Answer Text', 'Source Question ID']],
        body: keyTableRows,
        theme: 'striped',
        styles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [31, 41, 55],
        },
        headStyles: {
          fillColor: [23, 36, 58],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 60, halign: 'center' },
          2: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 200 },
          4: { cellWidth: 'auto', textColor: [100, 116, 139] },
        },
        margin: { left: 36, right: 36, bottom: 40 },
      });
    });
  });

  const filename = `${result.subjectCode}_QP_${targetSetNumber ? `Set${targetSetNumber}_` : ''}${targetVersionLabel ? `Ver${targetVersionLabel}_` : ''}${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Parses uploaded multi-sheet or single-sheet Excel spreadsheet into standard QpQuestion records.
 * Supports the standard 5-sheet template (`Module 1`..`Module 5`, 12 columns) as well as legacy 7-column sheets.
 */
export async function parseQpExcelFile(file: File): Promise<QpQuestion[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const questions: QpQuestion[] = [];

  for (let sheetIdx = 0; sheetIdx < wb.SheetNames.length; sheetIdx++) {
    const sheetName = wb.SheetNames[sheetIdx];
    if (!sheetName || sheetName.startsWith('_') || sheetName.toLowerCase() === 'summary') continue;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
    if (rows.length < 2) continue;

    // Infer default module number from sheet name (e.g. "Module 1" .. "Module 5")
    const modMatch = sheetName.match(/module\s*(\d+)/i);
    const sheetDefaultMod = modMatch ? parseInt(modMatch[1], 10) : Math.min(5, sheetIdx + 1);

    // Detect header columns (excluding image columns like "Question image", "option A img")
    const headerRow = rows[0].map((c) =>
      String(c || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    );
    const findTextCol = (exactKeys: string[], containsKeys: string[] = []): number => {
      const exactIdx = headerRow.findIndex((h) => exactKeys.includes(h));
      if (exactIdx >= 0) return exactIdx;
      return headerRow.findIndex(
        (h) =>
          !h.includes('img') &&
          !h.includes('image') &&
          containsKeys.some((k) => h.includes(k))
      );
    };

    const modCol = findTextCol(['modulenumber', 'module', 'mod'], ['module', 'mod']);
    let textCol = findTextCol(['questions', 'questiontext', 'question', 'prompt', 'stem'], ['question', 'stem', 'qtext']);
    let optACol = findTextCol(['optiona', 'opta', 'choicea', 'opt1'], ['optiona', 'opta', 'choicea']);
    let optBCol = findTextCol(['optionb', 'optb', 'choiceb', 'opt2'], ['optionb', 'optb', 'choiceb']);
    let optCCol = findTextCol(['optionc', 'optc', 'choicec', 'opt3'], ['optionc', 'optc', 'choicec']);
    let optDCol = findTextCol(['optiond', 'optd', 'choiced', 'opt4'], ['optiond', 'optd', 'choiced']);
    let ansCol = findTextCol(['keyanswer', 'correctoption', 'correctanswer', 'answer', 'correct', 'key'], ['keyanswer', 'correct', 'answer', 'key']);

    // Standard 12-column q_template.xlsx fallback
    if (headerRow.length >= 10) {
      if (textCol < 0) textCol = 1;
      if (optACol < 0) optACol = 3;
      if (optBCol < 0) optBCol = 5;
      if (optCCol < 0) optCCol = 7;
      if (optDCol < 0) optDCol = 9;
      if (ansCol < 0) ansCol = 11;
    }

    if (textCol < 0 || optACol < 0 || ansCol < 0) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawModVal = modCol >= 0 ? String(row[modCol] || '').replace(/[^0-9]/g, '') : '';
      const modNum = rawModVal ? parseInt(rawModVal, 10) : sheetDefaultMod;
      const clampedMod = Math.max(1, Math.min(5, Number.isFinite(modNum) ? modNum : sheetDefaultMod));

      const text = textCol >= 0 ? String(row[textCol] || '').trim() : '';
      const optA = optACol >= 0 ? String(row[optACol] || '').trim() : '';
      const optB = optBCol >= 0 ? String(row[optBCol] || '').trim() : '';
      const optC = optCCol >= 0 ? String(row[optCCol] || '').trim() : '';
      const optD = optDCol >= 0 ? String(row[optDCol] || '').trim() : '';
      let rawAns = ansCol >= 0 ? String(row[ansCol] || '').trim().toUpperCase() : 'A';
      if (rawAns.startsWith('OPTION ')) rawAns = rawAns.substring(7).trim();
      else if (rawAns.startsWith('OPTION')) rawAns = rawAns.substring(6).trim();

      if (!text && !optA && !optB) continue;

      let correctIdx = 0;
      if (['A', '1', 'OPT A'].some((k) => rawAns.startsWith(k))) correctIdx = 0;
      else if (['B', '2', 'OPT B'].some((k) => rawAns.startsWith(k))) correctIdx = 1;
      else if (['C', '3', 'OPT C'].some((k) => rawAns.startsWith(k))) correctIdx = 2;
      else if (['D', '4', 'OPT D'].some((k) => rawAns.startsWith(k))) correctIdx = 3;

      questions.push({
        id: `IMP-M${clampedMod}-S${sheetIdx + 1}-${String(i).padStart(3, '0')}`,
        moduleNumber: clampedMod,
        questionText: text,
        options: [optA, optB, optC, optD],
        correctIndex: correctIdx,
        correctOptionLetter: indexToLetter(correctIdx),
        sourceRow: i + 1,
      });
    }
  }
  return questions;
}
