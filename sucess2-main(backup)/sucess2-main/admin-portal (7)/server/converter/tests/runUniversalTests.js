/**
 * Comprehensive Universal Conversion Test Suite
 *
 * Verifies:
 * 1. File type detection, validation, and error rejection
 * 2. Ingestion across all supported formats (PDF, DOCX, XLSX, XLS, CSV, TXT, PNG, JPG)
 * 3. Intelligent mapping to FIXED destination templates (QUESTION_PAPER, STUDENT_LIST)
 * 4. Template-specific validation (errors, warnings, duplicate USN retention, DOB formatting)
 * 5. Institutional Excel (.xlsx) generation and workbook integrity verification
 * 6. Regression verification across all 10 standard institutional sample documents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { ingestDocument, validateSourceFile } from '../engine/ingestion/universalIngestionService.js';
import { mapToQuestionPaperTemplate, mapToStudentListTemplate, mapHeaderToField } from '../engine/mapping/intelligentMappingEngine.js';
import { validateMappedContent } from '../engine/validation/validationEngine.js';
import { generateInstitutionalWorkbook, validateWorkbookBuffer } from '../engine/exporters/universalExcelExporter.js';
import { validateDestinationTemplate, getAllTemplates, TEMPLATE_IDS } from '../engine/registry/templateRegistry.js';
import { generateAllSampleDocuments } from '../sampleGenerator.js';
import { processDocumentConversion } from '../engine/conversionEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../data/fixtures');
const SAMPLES_DIR = path.resolve(__dirname, '../../data/sample_documents');

async function runTestSuite() {
  console.log('================================================================');
  console.log('SMART EXAMINATION DOCUMENT CONVERTER — UNIVERSAL TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;
  const testResults = [];

  function recordResult(group, name, passed, details = '') {
    if (passed) {
      passedTests++;
      console.log(`  [PASS] ${group} > ${name}${details ? ' (' + details + ')' : ''}`);
    } else {
      failedTests++;
      console.error(`  [FAIL] ${group} > ${name}: ${details}`);
    }
    testResults.push({ group, name, passed, details });
  }

  // ============================================================================
  // GROUP 1: TEMPLATE REGISTRY & SECURITY
  // ============================================================================
  console.log('--- 1. FIXED TEMPLATE REGISTRY & DESTINATION VALIDATION ---');
  try {
    const templates = getAllTemplates();
    recordResult('Registry', 'Lists fixed destination templates', templates.length === 2, `Count: ${templates.length}`);

    const qpValid = validateDestinationTemplate('QUESTION_PAPER');
    recordResult('Registry', 'Validates QUESTION_PAPER template', qpValid.valid);

    const slValid = validateDestinationTemplate('STUDENT_LIST');
    recordResult('Registry', 'Validates STUDENT_LIST template', slValid.valid);

    const arbitraryRejection = validateDestinationTemplate('CUSTOM_USER_TEMPLATE_X');
    recordResult('Registry', 'Strictly rejects arbitrary destination template', !arbitraryRejection.valid, arbitraryRejection.error);
  } catch (err) {
    recordResult('Registry', 'Template registry checks', false, err.message);
  }

  // ============================================================================
  // GROUP 2: FILE INGESTION & FORMAT VALIDATION
  // ============================================================================
  console.log('\n--- 2. FILE INGESTION & INTEGRITY VALIDATION ---');
  try {
    // 2.1 Empty file rejection
    const emptyValidation = validateSourceFile({ path: path.join(FIXTURES_DIR, 'empty_file.pdf') });
    recordResult('Ingestion', 'Rejects empty 0-byte file', !emptyValidation.valid, emptyValidation.error);

    // 2.2 Corrupted file rejection (binary disguised as txt)
    const corruptValidation = validateSourceFile({ path: path.join(FIXTURES_DIR, 'corrupted_disguised.txt') });
    recordResult('Ingestion', 'Rejects corrupted binary disguised as text', !corruptValidation.valid, corruptValidation.error);

    // 2.3 Unsupported format rejection (.exe)
    const unsupportedValidation = validateSourceFile({ path: path.join(FIXTURES_DIR, 'unsupported.exe') });
    recordResult('Ingestion', 'Rejects unsupported format (.exe)', !unsupportedValidation.valid, unsupportedValidation.error);

    // 2.4 Ingest CSV student file
    const csvIngest = await ingestDocument({ path: path.join(FIXTURES_DIR, 'students_sample.csv') });
    recordResult('Ingestion', 'Ingests CSV file', csvIngest.extraction.status.startsWith('completed'), `Rows: ${csvIngest.extractedData.tableRows.length}`);

    // 2.5 Ingest TXT student file
    const txtStudentIngest = await ingestDocument({ path: path.join(FIXTURES_DIR, 'students_sample.txt') });
    recordResult('Ingestion', 'Ingests TXT student list', txtStudentIngest.extractedData.rawText.length > 50, `Length: ${txtStudentIngest.extractedData.rawText.length}`);

    // 2.6 Ingest TXT question paper
    const txtQpIngest = await ingestDocument({ path: path.join(FIXTURES_DIR, 'question_paper_sample.txt') });
    recordResult('Ingestion', 'Ingests TXT question paper', txtQpIngest.extractedData.rawText.includes('MODULE 1'));

    // 2.7 Ingest CSV question paper
    const csvQpIngest = await ingestDocument({ path: path.join(FIXTURES_DIR, 'question_paper_sample.csv') });
    recordResult('Ingestion', 'Ingests CSV question paper', csvQpIngest.extractedData.tableRows.length === 3);

    // 2.8 Ingest DOCX if present
    const docxPath = path.join(FIXTURES_DIR, 'sample_questions.docx');
    if (fs.existsSync(docxPath)) {
      const docxIngest = await ingestDocument({ path: docxPath });
      recordResult('Ingestion', 'Ingests DOCX file', docxIngest.extraction.method === 'docx', `Text length: ${docxIngest.extractedData.rawText.length}`);
    }
  } catch (err) {
    recordResult('Ingestion', 'File ingestion checks', false, err.message);
  }

  // ============================================================================
  // GROUP 3: INTELLIGENT FIELD MAPPING
  // ============================================================================
  console.log('\n--- 3. INTELLIGENT FIELD MAPPING ---');
  try {
    const map1 = mapHeaderToField('Registration Number');
    recordResult('Mapping', 'Maps "Registration Number" -> usn', map1.targetField === 'usn', `Method: ${map1.method}`);

    const map2 = mapHeaderToField('Candidate Name');
    recordResult('Mapping', 'Maps "Candidate Name" -> studentName', map2.targetField === 'studentName', `Method: ${map2.method}`);

    const map3 = mapHeaderToField('Birth Date');
    recordResult('Mapping', 'Maps "Birth Date" -> dateOfBirth', map3.targetField === 'dateOfBirth', `Method: ${map3.method}`);

    const map4 = mapHeaderToField('Roll No.');
    recordResult('Mapping', 'Maps "Roll No." -> usn', map4.targetField === 'usn', `Confidence: ${map4.confidence}`);

    const map5 = mapHeaderToField('Unrelated Random Header 123');
    recordResult('Mapping', 'Leaves unrecognized header unmapped without guessing', map5.targetField === null);
  } catch (err) {
    recordResult('Mapping', 'Header mapping checks', false, err.message);
  }

  // ============================================================================
  // GROUP 4: STUDENT LIST MAPPING, VALIDATION & EXCEL GENERATION
  // ============================================================================
  console.log('\n--- 4. STUDENT LIST DESTINATION TEMPLATE CONVERSION ---');
  try {
    // 4.1 Ingest CSV with duplicates and messy headers
    const csvFile = path.join(FIXTURES_DIR, 'students_sample.csv');
    const ingestRes = await ingestDocument({ path: csvFile });
    const mappedStudentData = mapToStudentListTemplate(ingestRes.extractedData, { department: 'CSE', semester: 5 });

    recordResult('StudentList', 'Maps 5 student rows from CSV', mappedStudentData.records.length === 5, `Count: ${mappedStudentData.records.length}`);

    // 4.2 Validation
    const validation = validateMappedContent(TEMPLATE_IDS.STUDENT_LIST, mappedStudentData);
    const hasDuplicateWarning = validation.warnings.some(w => w.code === 'DUPLICATE_USN');
    recordResult('StudentList', 'Detects duplicate USN without silent deletion', hasDuplicateWarning, '4MT21CS001 detected twice');

    // 4.3 Institutional Excel Workbook Generation
    const generated = await generateInstitutionalWorkbook(TEMPLATE_IDS.STUDENT_LIST, mappedStudentData, { filenamePrefix: 'Test_Students' });
    recordResult('StudentList', 'Generates 4-column institutional Excel workbook', generated.buffer.byteLength > 1000, `Size: ${generated.buffer.byteLength} bytes`);

    // 4.4 Validate generated Excel structure
    const testWb = new ExcelJS.Workbook();
    await testWb.xlsx.load(generated.buffer);
    const sheet1 = testWb.getWorksheet('Sheet1');
    const headers = sheet1.getRow(1).values.slice(1);
    const expectedHeaders = ['Sl.no.', 'Student Name', 'USN', 'Date of Birth'];
    const headersMatch = headers.length === expectedHeaders.length && headers.every((h, i) => h === expectedHeaders[i]);
    recordResult('StudentList', 'Excel headers match exact 4 locked COE columns', headersMatch, JSON.stringify(headers));

    // Check row count in generated Excel
    recordResult('StudentList', 'All 5 student rows present in final Excel sheet', sheet1.rowCount >= 6, `Total rows: ${sheet1.rowCount}`);
  } catch (err) {
    recordResult('StudentList', 'Student list conversion checks', false, err.message);
  }

  // ============================================================================
  // GROUP 5: QUESTION PAPER MAPPING, VALIDATION & EXCEL GENERATION
  // ============================================================================
  console.log('\n--- 5. QUESTION PAPER DESTINATION TEMPLATE CONVERSION ---');
  try {
    // 5.1 Ingest TXT question paper
    const txtFile = path.join(FIXTURES_DIR, 'question_paper_sample.txt');
    const ingestQp = await ingestDocument({ path: txtFile });
    const mappedQpData = mapToQuestionPaperTemplate(ingestQp.extractedData, { department: 'CSE', semester: 5, subjectName: 'Computer Networks', subjectCode: '21CS51' });

    recordResult('QuestionPaper', 'Extracts questions across dynamic modules', mappedQpData.totalQuestions === 3, `Extracted: ${mappedQpData.totalQuestions} questions across ${mappedQpData.totalModules} modules`);

    // 5.2 Validate Question Paper
    const validation = validateMappedContent(TEMPLATE_IDS.QUESTION_PAPER, mappedQpData);
    recordResult('QuestionPaper', 'Validation passes with high confidence', validation.isValid, `Confidence: ${validation.summary.confidenceScore}`);

    // 5.3 Generate Institutional Question Paper Workbook
    const generated = await generateInstitutionalWorkbook(TEMPLATE_IDS.QUESTION_PAPER, mappedQpData, { filenamePrefix: 'Test_QP' });
    recordResult('QuestionPaper', 'Generates multi-sheet institutional Excel workbook', generated.buffer.byteLength > 2000, `Size: ${generated.buffer.byteLength} bytes`);

    // 5.4 Validate generated Question Paper Excel structure
    const testWb = new ExcelJS.Workbook();
    await testWb.xlsx.load(generated.buffer);
    const mod1 = testWb.getWorksheet('Module 1');
    const mod2 = testWb.getWorksheet('Module 2');
    recordResult('QuestionPaper', 'Generates Module 1 and Module 2 worksheets', Boolean(mod1 && mod2));

    const mod1Headers = mod1.getRow(1).values.slice(1);
    recordResult('QuestionPaper', 'Worksheet enforces exact 12-column hierarchy', mod1Headers.length === 12, `Columns: ${mod1Headers.length}`);
  } catch (err) {
    recordResult('QuestionPaper', 'Question paper conversion checks', false, err.message);
  }

  // ============================================================================
  // GROUP 6: REGRESSION TEST SUITE (ALL 10 SAMPLE SCENARIOS)
  // ============================================================================
  console.log('\n--- 6. REGRESSION SUITE: ALL 10 ORIGINAL INSTITUTIONAL SAMPLES ---');
  try {
    const samples = await generateAllSampleDocuments();
    let samplePasses = 0;

    for (const sample of samples) {
      const file = {
        path: sample.path,
        originalname: path.basename(sample.path),
        size: fs.statSync(sample.path).size
      };

      const res = await processDocumentConversion(file, {
        documentType: sample.type,
        department: 'CSE',
        semester: 5,
        uploadedBy: 'Automated Regression Suite'
      });

      const passed = res.success === true;
      if (passed) samplePasses++;
      recordResult('Regression', `Sample #${sample.id}: ${sample.name}`, passed, `Type: ${sample.type}`);
    }

    recordResult('Regression', 'All 10 original samples pass without regression', samplePasses === 10, `${samplePasses} of 10 passed`);
  } catch (err) {
    recordResult('Regression', 'Regression suite execution', false, err.message);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`TEST EXECUTION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('================================================================\n');

  return {
    total: passedTests + failedTests,
    passed: passedTests,
    failed: failedTests,
    allPassed: failedTests === 0,
    results: testResults
  };
}

runTestSuite().then(summary => {
  if (!summary.allPassed) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
