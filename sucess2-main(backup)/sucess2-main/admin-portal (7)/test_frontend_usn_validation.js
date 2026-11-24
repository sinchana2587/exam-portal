import { validateInstitutionalUsn, getAllowedDeptBranchPrefixes, DEPT_USN_BRANCH_PREFIXES } from './src/utils/usnValidator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

console.log('=== 1. TEST FRONTEND DEPT_USN_BRANCH_PREFIXES MAPPING ===');
assert(getAllowedDeptBranchPrefixes('E158CS').includes('CS'), 'E158CS maps to CS');
assert(getAllowedDeptBranchPrefixes('E158IS').includes('IS'), 'E158IS maps to IS');
assert(getAllowedDeptBranchPrefixes('E158EC').includes('EC'), 'E158EC maps to EC');
assert(getAllowedDeptBranchPrefixes('E158ME').includes('ME'), 'E158ME maps to ME');
assert(getAllowedDeptBranchPrefixes('E158CV').includes('CV'), 'E158CV maps to CV');
assert(getAllowedDeptBranchPrefixes('E158CE').includes('CE'), 'E158CE maps to CE');
assert(getAllowedDeptBranchPrefixes('E158CA').includes('CA') && getAllowedDeptBranchPrefixes('E158CA').includes('AI'), 'E158CA maps to CA and AI');
assert(getAllowedDeptBranchPrefixes('E158CD').includes('CD') && getAllowedDeptBranchPrefixes('E158CD').includes('DS'), 'E158CD maps to CD and DS');
assert(getAllowedDeptBranchPrefixes('E158CB').includes('CB') && getAllowedDeptBranchPrefixes('E158CB').includes('CSBS'), 'E158CB maps to CB and CSBS');
assert(getAllowedDeptBranchPrefixes('E158CI').includes('CI') && getAllowedDeptBranchPrefixes('E158CI').includes('AI'), 'E158CI maps to CI and AI');
assert(getAllowedDeptBranchPrefixes('E158IC').includes('IC'), 'E158IC maps to IC');
assert(getAllowedDeptBranchPrefixes('E158EE').includes('EE'), 'E158EE maps to EE');

// Short code aliases
assert(getAllowedDeptBranchPrefixes('CSE').includes('CS'), 'CSE maps to CS');
assert(getAllowedDeptBranchPrefixes('ISE').includes('IS'), 'ISE maps to IS');
assert(getAllowedDeptBranchPrefixes('ECE').includes('EC'), 'ECE maps to EC');

// Unconfigured department
assert(getAllowedDeptBranchPrefixes('E158UNKNOWN').length === 0, 'Unconfigured department returns empty array');

console.log('\n=== 2. TEST FRONTEND validateInstitutionalUsn ===');
// Test 1: E158CS with 4MH21CS001 is accepted
const r1 = validateInstitutionalUsn('4MH21CS001', 'E158CS');
assert(r1.valid === true, 'E158CS accepts 4MH21CS001');

// Test 2: E158CS with 4MH23CS001 is accepted
const r2 = validateInstitutionalUsn('4MH23CS001', 'E158CS');
assert(r2.valid === true, 'E158CS accepts 4MH23CS001');

// Test 3: Multiple valid CS USNs across admission years
const r3a = validateInstitutionalUsn('4MH21CS002', 'E158CS');
const r3b = validateInstitutionalUsn('4MH23CS012', 'E158CS');
const r3c = validateInstitutionalUsn('4MH24CS001', 'E158CS');
const r3d = validateInstitutionalUsn('4MH24CS401', 'E158CS'); // lateral entry
assert(r3a.valid && r3b.valid && r3c.valid && r3d.valid, 'E158CS accepts 4MH21CS002, 4MH23CS012, 4MH24CS001, 4MH24CS401');

// Test 4: Genuinely mismatched department branch rejected
const r4 = validateInstitutionalUsn('4MH21EC001', 'E158CS');
assert(r4.valid === false && r4.departmentMismatch === true && r4.error.includes('Department-prefix mismatch'), 'E158CS rejects 4MH21EC001 with department-prefix mismatch error');

const r4b = validateInstitutionalUsn('4MH23IS005', 'E158CS');
assert(r4b.valid === false && r4b.departmentMismatch === true && r4b.error.includes('Department-prefix mismatch'), 'E158CS rejects 4MH23IS005 with department-prefix mismatch error');

// Test 5: Format error
const r5 = validateInstitutionalUsn('INVALID123', 'E158CS');
assert(r5.valid === false && r5.error.includes('Invalid MIT Mysore USN format'), 'Rejects malformed USN format');

// Test 6: Unconfigured department
const r6 = validateInstitutionalUsn('4MH21CS001', 'E158UNKNOWN');
assert(r6.valid === false && r6.error.includes('USN branch mapping has not been configured'), 'Unconfigured department reports clear configuration error');

console.log(`\nFrontend Validation Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
