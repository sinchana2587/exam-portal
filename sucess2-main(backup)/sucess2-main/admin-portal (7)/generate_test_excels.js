import ExcelJS from 'exceljs';

async function generateWorkbooks() {
  // 1. Valid CS roster workbook for Sem 5 Sec A
  const wbValid = new ExcelJS.Workbook();
  const wsValid = wbValid.addWorksheet('Students');
  wsValid.addRow(['USN', 'Student Name', 'DOB']);
  wsValid.addRow(['4MH21CS001', 'Candidate 4MH21CS001', '2003-05-14']);
  wsValid.addRow(['4MH21CS002', 'Candidate 4MH21CS002', '2003-11-30']);
  wsValid.addRow(['4MH21CS003', 'Candidate 4MH21CS003', '2003-08-22']);
  wsValid.addRow(['4MH21CS046', 'New Candidate 046', '2003-02-18']);
  wsValid.addRow(['4MH21CS047', 'New Candidate 047', '2003-07-09']);
  await wbValid.xlsx.writeFile('test_students_valid_cs.xlsx');
  console.log('Created test_students_valid_cs.xlsx');

  // 2. Mismatch roster workbook (contains EC USN in CS upload)
  const wbMismatch = new ExcelJS.Workbook();
  const wsMismatch = wbMismatch.addWorksheet('Students');
  wsMismatch.addRow(['USN', 'Student Name', 'DOB']);
  wsMismatch.addRow(['4MH21CS001', 'Candidate 4MH21CS001', '2003-05-14']);
  wsMismatch.addRow(['4MH21EC001', 'Kavya Rao ECE', '2003-09-19']); // Mismatch!
  await wbMismatch.xlsx.writeFile('test_students_mismatch.xlsx');
  console.log('Created test_students_mismatch.xlsx');

  // 3. Duplicate USN workbook
  const wbDup = new ExcelJS.Workbook();
  const wsDup = wbDup.addWorksheet('Students');
  wsDup.addRow(['USN', 'Student Name', 'DOB']);
  wsDup.addRow(['4MH21CS048', 'Student One', '2003-05-14']);
  wsDup.addRow(['4MH21CS048', 'Student One Duplicate', '2003-05-14']);
  await wbDup.xlsx.writeFile('test_students_duplicate.xlsx');
  console.log('Created test_students_duplicate.xlsx');

  // 4. Invalid DOB workbook
  const wbDob = new ExcelJS.Workbook();
  const wsDob = wbDob.addWorksheet('Students');
  wsDob.addRow(['USN', 'Student Name', 'DOB']);
  wsDob.addRow(['4MH21CS049', 'Student Invalid DOB', 'NOT-A-DATE']);
  await wbDob.xlsx.writeFile('test_students_invalid_dob.xlsx');
  console.log('Created test_students_invalid_dob.xlsx');
}

generateWorkbooks().catch(console.error);
