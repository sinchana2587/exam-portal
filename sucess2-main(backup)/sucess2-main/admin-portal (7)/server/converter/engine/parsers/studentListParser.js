/**
 * Layout-Aware Student List Parser
 * Maps heterogeneous column headers and arrangements into the 7 locked standard fields:
 * 1. S.No
 * 2. USN
 * 3. Student Name
 * 4. DOB
 * 5. Section
 * 6. Semester
 * 7. Department
 *
 * Strictly approved official departments (10):
 * 1. CSE AI
 * 2. AI & ML
 * 3. Information Science (IS)
 * 4. Internet of Things (IoT)
 * 5. Computer Science and Business Systems (CSBS)
 * 6. Computer Science and Data Science (CSDS)
 * 7. Computer Engineering (CE)
 * 8. Civil Engineering
 * 9. Mechanical Engineering
 * 10. Electronics and Communication Engineering (ECE)
 */

export const OFFICIAL_DEPARTMENTS = [
  'CSE AI',
  'AI & ML',
  'Information Science (IS)',
  'Internet of Things (IoT)',
  'Computer Science and Business Systems (CSBS)',
  'Computer Science and Data Science (CSDS)',
  'Computer Engineering (CE)',
  'Civil Engineering',
  'Mechanical Engineering',
  'Electronics and Communication Engineering (ECE)'
];

const SYNONYMS = {
  usn: [
    'usn', 'university seat number', 'register number', 'reg number', 'reg no',
    'reg_no', 'regno', 'roll number', 'roll no', 'roll_no', 'hall ticket',
    'candidate id', 'student id', 'registration no'
  ],
  studentName: [
    'student name', 'student_name', 'name of the student', 'candidate name',
    'name', 'full name', 'fullname', 'student', 'candidate'
  ],
  dob: [
    'dob', 'date of birth', 'birth date', 'd.o.b', 'd.o.b.', 'birthdate',
    'date_of_birth', 'birth_date', 'birthday'
  ],
  section: [
    'section', 'sec', 'class', 'division', 'group', 'batch'
  ],
  semester: [
    'semester', 'sem', 'term', 'year/sem'
  ],
  department: [
    'department', 'dept', 'branch', 'programme', 'stream', 'course'
  ],
  serialNumber: [
    'serial number', 'serial no', 'sl no', 'sl.no', 's.no', 'sno', 'si no',
    'sl', 's no', '#', 'id', 'sr no'
  ],
  roomNumber: [
    'room', 'room number', 'room no', 'room_no', 'hall', 'exam hall', 'lab', 'lab room', 'seat', 'seat no', 'seat number'
  ]
};

function normalizeHeader(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mapColumnHeader(rawHeader) {
  const norm = normalizeHeader(rawHeader);
  if (!norm) return null;

  for (const [field, syns] of Object.entries(SYNONYMS)) {
    for (const s of syns) {
      const normSyn = normalizeHeader(s);
      if (norm === normSyn || norm.startsWith(normSyn) || norm.includes(normSyn)) {
        return field;
      }
    }
  }
  return null;
}

/**
 * Maps raw department text to the closest approved official department name
 */
export function mapDepartmentToOfficial(rawDept) {
  if (!rawDept) return null;
  const clean = String(rawDept).trim().toLowerCase();

  for (const dept of OFFICIAL_DEPARTMENTS) {
    if (clean === dept.toLowerCase()) return dept;
  }

  // Keyword heuristic mapping (CAC removed completely!)
  if (clean === 'cse' || clean.includes('cse') || clean.includes('cse ai') || clean.includes('cse-ai') || clean.includes('computer science and engineering')) return 'CSE AI';
  if (clean.includes('ai & ml') || clean.includes('aiml') || clean.includes('ai and ml') || clean.includes('machine learning')) return 'AI & ML';
  if (clean.includes('information science') || clean.includes('is') || clean.includes('ise')) return 'Information Science (IS)';
  if (clean.includes('iot') || clean.includes('internet of things')) return 'Internet of Things (IoT)';
  if (clean.includes('csbs') || clean.includes('business systems')) return 'Computer Science and Business Systems (CSBS)';
  if (clean.includes('csds') || clean.includes('data science')) return 'Computer Science and Data Science (CSDS)';
  if (clean.includes('computer engineering') || clean === 'ce') return 'Computer Engineering (CE)';
  if (clean.includes('civil') || clean === 'civ') return 'Civil Engineering';
  if (clean.includes('mechanical') || clean === 'mech') return 'Mechanical Engineering';
  if (clean.includes('ece') || clean.includes('electronics')) return 'Electronics and Communication Engineering (ECE)';

  return null;
}

/**
 * Normalizes DOB to DD-MM-YYYY
 */
export function normalizeDobDate(rawVal) {
  if (!rawVal) return null;
  const str = String(rawVal).trim();

  // Format 1: DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, '0');
    const m = ddmmyyyy[2].padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${d}-${m}-${y}`;
  }

  // Format 2: YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, '0');
    const d = yyyymmdd[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // Format 3: Excel serial date
  if (!isNaN(str) && Number(str) > 20000 && Number(str) < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Number(str) * 86400000);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return null;
}

/**
 * Parses raw extracted rows into standard student records with 7 columns
 */
export function parseStudentList(rawRows, defaultMeta = {}) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      records: [],
      duplicateRecords: [],
      columnMapping: {},
      summary: {
        totalRows: 0,
        validCount: 0,
        duplicateUsnCount: 0,
        missingFieldsCount: 0,
        missingDobCount: 0,
        missingDeptCount: 0,
        invalidSemesterCount: 0
      }
    };
  }

  // 1. Establish Column Mapping from the first row's keys
  const sampleRow = rawRows[0];
  const originalHeaders = Object.keys(sampleRow);
  const columnMapping = {};

  originalHeaders.forEach(header => {
    const matched = mapColumnHeader(header);
    if (matched && !Object.values(columnMapping).includes(matched)) {
      columnMapping[header] = matched;
    }
  });

  // Fallback heuristic for USN
  if (!Object.values(columnMapping).includes('usn')) {
    for (const h of originalHeaders) {
      const sampleVal = String(sampleRow[h] || '');
      if (/^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$/i.test(sampleVal.trim())) {
        columnMapping[h] = 'usn';
        break;
      }
    }
  }

  const fieldToHeader = {};
  for (const [orig, std] of Object.entries(columnMapping)) {
    fieldToHeader[std] = orig;
  }

  const parsedRecords = [];
  const duplicateRecords = [];
  const seenUsns = new Map();

  let validCount = 0;
  let duplicateUsnCount = 0;
  let missingFieldsCount = 0;
  let missingDobCount = 0;
  let missingDeptCount = 0;
  let invalidSemesterCount = 0;

  rawRows.forEach((row, index) => {
    const rawSl = fieldToHeader.serialNumber ? row[fieldToHeader.serialNumber] : (index + 1);
    const rawUsn = fieldToHeader.usn ? row[fieldToHeader.usn] : '';
    const rawName = fieldToHeader.studentName ? row[fieldToHeader.studentName] : '';
    const rawDob = fieldToHeader.dob ? row[fieldToHeader.dob] : '';
    const rawSec = fieldToHeader.section ? row[fieldToHeader.section] : (defaultMeta.section || 'A');
    const rawSem = fieldToHeader.semester ? row[fieldToHeader.semester] : (defaultMeta.semester || 5);
    const rawDept = fieldToHeader.department ? row[fieldToHeader.department] : '';
    const rawRoom = fieldToHeader.roomNumber ? row[fieldToHeader.roomNumber] : (row['Room'] || row['Room Number'] || row['Hall'] || row['room'] || row['Seat'] || '');

    const serialNumber = parseInt(rawSl, 10) || (index + 1);
    const usn = String(rawUsn || '').trim().toUpperCase();
    const studentName = String(rawName || '').trim();
    const dob = normalizeDobDate(rawDob);
    const section = String(rawSec || 'A').trim().toUpperCase().slice(0, 3);
    
    // Extract department from row or map if present; DO NOT automatically assign
    const department = mapDepartmentToOfficial(rawDept);

    let semester = parseInt(rawSem, 10);
    if (isNaN(semester)) {
      const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
      semester = romanMap[String(rawSem).trim().toUpperCase()] || (defaultMeta.semester || 5);
    }

    const validationErrors = [];

    if (!usn) {
      validationErrors.push('Missing USN');
      missingFieldsCount++;
    }

    if (!studentName) {
      validationErrors.push('Missing Student Name');
      missingFieldsCount++;
    }

    if (!dob) {
      validationErrors.push('Missing or Invalid DOB (DD-MM-YYYY format required)');
      missingDobCount++;
    }

    if (!department) {
      validationErrors.push('Missing Department - Manual Selection Required');
      missingDeptCount++;
    }

    if (semester < 1 || semester > 8) {
      validationErrors.push(`Invalid Semester (${semester}). Must be between 1 and 8`);
      invalidSemesterCount++;
    }

    let isDuplicate = false;
    if (usn) {
      if (seenUsns.has(usn)) {
        isDuplicate = true;
        duplicateUsnCount++;
        validationErrors.push(`Duplicate USN detected (previously seen at Sl #${seenUsns.get(usn).serialNumber})`);
      } else {
        seenUsns.set(usn, { serialNumber, index });
      }
    }

    const record = {
      id: `std_${index + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      serialNumber,
      usn,
      studentName,
      dob: dob || null,
      section: section || 'A',
      semester: (semester >= 1 && semester <= 8) ? semester : 5,
      department: department || '',
      roomNumber: String(rawRoom || '').trim(),
      isDuplicate,
      validationErrors,
      validationStatus: validationErrors.length === 0 ? 'valid' : isDuplicate ? 'duplicate' : 'error',
      originalRow: row
    };

    if (isDuplicate) {
      duplicateRecords.push(record);
    }

    if (validationErrors.length === 0) {
      validCount++;
    }

    parsedRecords.push(record);
  });

  return {
    records: parsedRecords,
    duplicateRecords,
    columnMapping,
    summary: {
      totalRows: parsedRecords.length,
      validCount,
      duplicateUsnCount,
      missingFieldsCount,
      missingDobCount,
      missingDeptCount,
      invalidSemesterCount,
      confidenceScore: parsedRecords.length > 0 ? Math.round((validCount / parsedRecords.length) * 100) / 100 : 0
    }
  };
}
