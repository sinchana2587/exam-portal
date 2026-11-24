import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

const SEMESTER_STORAGE_PREFIX = 'mit_mysore_hod_semester';
const DEFAULT_HOD_SEMESTER = 5;

export function parseValidSemester(raw: unknown): number | null {
  const num = Number(raw);
  return Number.isInteger(num) && num >= 1 && num <= 8 ? num : null;
}

function getStorageKey(scopeId?: string): string {
  return `${SEMESTER_STORAGE_PREFIX}:${scopeId || 'default'}`;
}

function readStoredSemester(scopeId?: string): number {
  try {
    const raw = sessionStorage.getItem(getStorageKey(scopeId));
    return parseValidSemester(raw) ?? DEFAULT_HOD_SEMESTER;
  } catch {
    return DEFAULT_HOD_SEMESTER;
  }
}

function readUrlSemester(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return parseValidSemester(params.get('semester'));
  } catch {
    return null;
  }
}

interface HodSemesterContextValue {
  selectedSemester: number;
  setSelectedSemester: (semester: number) => void;
}

const HodSemesterContext = createContext<HodSemesterContextValue | undefined>(undefined);

export const HodSemesterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const scopeId = user?.departmentId || user?.id;

  const [selectedSemester, setSelectedSemesterState] = useState<number>(() => {
    return readUrlSemester() ?? readStoredSemester(scopeId);
  });

  useEffect(() => {
    const fromUrl = readUrlSemester();
    const resolved = fromUrl ?? readStoredSemester(scopeId);
    setSelectedSemesterState(resolved);
    try {
      sessionStorage.setItem(getStorageKey(scopeId), String(resolved));
    } catch {
      // Ignore storage errors
    }
  }, [scopeId]);

  const setSelectedSemester = useCallback(
    (semester: number) => {
      const valid = parseValidSemester(semester);
      if (valid === null) return;
      setSelectedSemesterState(valid);
      try {
        sessionStorage.setItem(getStorageKey(scopeId), String(valid));
      } catch {
        // Ignore storage errors
      }
    },
    [scopeId]
  );

  return (
    <HodSemesterContext.Provider value={{ selectedSemester, setSelectedSemester }}>
      {children}
    </HodSemesterContext.Provider>
  );
};

export function useHodSemester(): HodSemesterContextValue {
  const ctx = useContext(HodSemesterContext);
  if (!ctx) {
    throw new Error('useHodSemester must be used within HodSemesterProvider');
  }
  return ctx;
}
