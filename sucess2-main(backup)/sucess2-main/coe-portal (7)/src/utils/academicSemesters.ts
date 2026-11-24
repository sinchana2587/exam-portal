import { AcademicSemester } from '../types/examination';

export const ACADEMIC_SEMESTERS: readonly AcademicSemester[] = [
  { semesterNumber: 1, label: '1st Semester', shortLabel: '1st' },
  { semesterNumber: 2, label: '2nd Semester', shortLabel: '2nd' },
  { semesterNumber: 3, label: '3rd Semester', shortLabel: '3rd' },
  { semesterNumber: 4, label: '4th Semester', shortLabel: '4th' },
  { semesterNumber: 5, label: '5th Semester', shortLabel: '5th' },
  { semesterNumber: 6, label: '6th Semester', shortLabel: '6th' },
  { semesterNumber: 7, label: '7th Semester', shortLabel: '7th' },
  { semesterNumber: 8, label: '8th Semester', shortLabel: '8th' },
] as const;

export function normalizeAcademicSemesters(
  backendSemesters?: Partial<AcademicSemester>[] | null
): AcademicSemester[] {
  const byNumber = new Map<number, AcademicSemester>();

  ACADEMIC_SEMESTERS.forEach((sem) => {
    byNumber.set(sem.semesterNumber, { ...sem });
  });

  if (Array.isArray(backendSemesters)) {
    backendSemesters.forEach((item) => {
      const num = Number(item.semesterNumber);
      if (Number.isInteger(num) && num >= 1 && num <= 8) {
        const canonical = byNumber.get(num)!;
        byNumber.set(num, {
          semesterNumber: num,
          label: item.label?.trim() || canonical.label,
          shortLabel: item.shortLabel?.trim() || canonical.shortLabel,
        });
      }
    });
  }

  return Array.from(byNumber.values()).sort(
    (a, b) => a.semesterNumber - b.semesterNumber
  );
}

export function formatSemesterLabel(semesterNumber: number): string {
  const match = ACADEMIC_SEMESTERS.find((s) => s.semesterNumber === semesterNumber);
  return match ? match.label : `Semester ${semesterNumber}`;
}

export function formatSemesterShortLabel(semesterNumber: number): string {
  const match = ACADEMIC_SEMESTERS.find((s) => s.semesterNumber === semesterNumber);
  return match ? match.shortLabel : String(semesterNumber);
}
