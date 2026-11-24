import { SemesterRecord } from '../types';

export interface MasterSemesterOption {
  number: number;
  label: string;
  shortLabel: string;
}

const ORDINAL_LABELS: Record<number, string> = {
  1: '1st Semester',
  2: '2nd Semester',
  3: '3rd Semester',
  4: '4th Semester',
  5: '5th Semester',
  6: '6th Semester',
  7: '7th Semester',
  8: '8th Semester',
};

export function formatSemesterOrdinal(semesterNumber: number): string {
  if (ORDINAL_LABELS[semesterNumber]) {
    return ORDINAL_LABELS[semesterNumber];
  }
  const mod100 = semesterNumber % 100;
  const mod10 = semesterNumber % 10;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = 'st';
    else if (mod10 === 2) suffix = 'nd';
    else if (mod10 === 3) suffix = 'rd';
  }
  return `${semesterNumber}${suffix} Semester`;
}

/**
 * Institutional master configuration for all 8 engineering semesters in ascending order.
 * Never restrict this list by odd/even cycle, Active/Upcoming flags, or existing records.
 */
export const MASTER_SEMESTER_OPTIONS: readonly MasterSemesterOption[] = Array.from(
  { length: 8 },
  (_, idx) => {
    const number = idx + 1;
    return {
      number,
      label: formatSemesterOrdinal(number),
      shortLabel: `Sem ${number}`,
    };
  }
);

export const MASTER_SEMESTER_NUMBERS: readonly number[] = MASTER_SEMESTER_OPTIONS.map(
  (s) => s.number
);

export function mergeWithMasterSemesters(existing?: SemesterRecord[]): SemesterRecord[] {
  const byNumber = new Map<number, SemesterRecord>();
  (existing || []).forEach((rec) => {
    if (rec.number >= 1 && rec.number <= 8) {
      byNumber.set(rec.number, rec);
    }
  });

  return MASTER_SEMESTER_OPTIONS.map((opt) => {
    const existingRec = byNumber.get(opt.number);
    return {
      id: existingRec?.id || `sem-${opt.number}`,
      number: opt.number,
      name: opt.label,
      status: existingRec?.status || 'Active',
    };
  });
}
