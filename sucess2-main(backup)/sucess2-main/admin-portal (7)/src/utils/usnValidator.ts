export const DEPT_USN_BRANCH_PREFIXES: Record<string, string[]> = {
  // Institutional department codes (MIT Mysore E158XX)
  E158CS: ['CS'],
  E158IS: ['IS'],
  E158EC: ['EC'],
  E158ME: ['ME'],
  E158CV: ['CV'],
  E158CE: ['CE'],
  E158CA: ['CA', 'AI'],
  E158CD: ['CD', 'DS', 'AD'],
  E158CB: ['CB', 'CSBS'],
  E158CI: ['CI', 'AI', 'AM', 'AL'],
  E158IC: ['IC', 'IO', 'CY'],
  E158EE: ['EE'],

  // Standard short codes and aliases
  CSE: ['CS'],
  CS: ['CS'],
  ISE: ['IS'],
  IS: ['IS'],
  ECE: ['EC'],
  EC: ['EC'],
  ME: ['ME'],
  CV: ['CV'],
  CE: ['CE'],
  EEE: ['EE'],
  EE: ['EE'],
  CA: ['CA', 'AI'],
  CD: ['CD', 'DS', 'AD'],
  CB: ['CB', 'CSBS'],
  CI: ['CI', 'AI', 'AM', 'AL'],
  IC: ['IC', 'IO', 'CY'],
  AIML: ['AI', 'AM', 'AL', 'CI'],
  AIDS: ['AD', 'AI', 'DS'],
};

export function getAllowedDeptBranchPrefixes(deptCode: string): string[] {
  const upper = deptCode.trim().toUpperCase();
  if (!upper) return [];
  return DEPT_USN_BRANCH_PREFIXES[upper] || [];
}

export interface UsnValidationResult {
  valid: boolean;
  normalized: string;
  branchToken?: string;
  departmentMismatch?: boolean;
  error?: string;
}

/**
 * Validates MIT Mysore / VTU institutional USN patterns:
 * - Standard regular / lateral admission: 4MH{YY}{BRANCH}{ROLL} (e.g. 4MH24CS001, 4MH21CS002, 4MH24CS401)
 */
export function validateInstitutionalUsn(
  rawUsn: string,
  expectedDepartmentCode?: string
): UsnValidationResult {
  const normalized = rawUsn.trim().toUpperCase();
  if (!normalized || normalized.includes('?') || normalized.includes('_')) {
    return {
      valid: false,
      normalized,
      error: 'Missing or unreadable USN.',
    };
  }

  const match = normalized.match(/^4MH\d{2}([A-Z]{2,4})\d{3}$/);
  if (!match) {
    const samplePrefix = expectedDepartmentCode
      ? (getAllowedDeptBranchPrefixes(expectedDepartmentCode)[0] || 'CS')
      : 'CS';
    return {
      valid: false,
      normalized,
      error: `Invalid MIT Mysore USN format "${normalized}" (expected e.g. 4MH24${samplePrefix}001).`,
    };
  }

  const branchToken = match[1];
  if (expectedDepartmentCode) {
    const allowed = getAllowedDeptBranchPrefixes(expectedDepartmentCode);
    if (allowed.length === 0) {
      return {
        valid: false,
        normalized,
        branchToken,
        departmentMismatch: true,
        error: `USN branch mapping has not been configured for department "${expectedDepartmentCode}".`,
      };
    }
    if (!allowed.includes(branchToken)) {
      return {
        valid: false,
        normalized,
        branchToken,
        departmentMismatch: true,
        error: `Department-prefix mismatch ("${branchToken}" does not belong to ${expectedDepartmentCode}).`,
      };
    }
  }

  return {
    valid: true,
    normalized,
    branchToken,
  };
}
