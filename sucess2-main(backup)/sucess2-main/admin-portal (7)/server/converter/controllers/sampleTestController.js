import fs from 'fs';
import path from 'path';
import { generateAllSampleDocuments } from '../sampleGenerator.js';
import { processDocumentConversion } from '../engine/conversionEngine.js';

export async function listSampleDocuments(req, res) {
  try {
    const samples = await generateAllSampleDocuments();
    res.json({
      success: true,
      statusCode: 200,
      data: samples.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        filename: path.basename(s.path)
      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'SAMPLE_ERROR', message: err.message }
    });
  }
}

export async function runSampleTest(req, res) {
  try {
    const { testId } = req.params;
    const samples = await generateAllSampleDocuments();
    const target = samples.find(s => s.id === Number(testId));

    if (!target) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: `Test case #${testId} not found` }
      });
    }

    const file = {
      path: target.path,
      originalname: path.basename(target.path),
      size: fs.statSync(target.path).size
    };

    const conversionResult = await processDocumentConversion(file, {
      documentType: target.type,
      department: 'CSE',
      semester: 5,
      subjectName: target.type === 'question_paper' ? 'Automated Test Paper' : '',
      subjectCode: target.type === 'question_paper' ? '21CS51' : '',
      uploadedBy: 'Test Runner Suite'
    });

    res.json({
      success: true,
      statusCode: 200,
      message: `Test Case #${testId} (${target.name}) executed successfully`,
      data: {
        testId: target.id,
        testName: target.name,
        documentType: target.type,
        conversionResult
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'TEST_RUN_ERROR', message: err.message }
    });
  }
}

export async function runAllTests(req, res) {
  try {
    const samples = await generateAllSampleDocuments();
    const results = [];

    for (const sample of samples) {
      const file = {
        path: sample.path,
        originalname: path.basename(sample.path),
        size: fs.statSync(sample.path).size
      };

      const tStart = Date.now();
      const conv = await processDocumentConversion(file, {
        documentType: sample.type,
        department: 'CSE',
        semester: 5,
        uploadedBy: 'Automated Test Suite'
      });
      const durationMs = Date.now() - tStart;

      results.push({
        testId: sample.id,
        name: sample.name,
        type: sample.type,
        passed: conv.success,
        durationMs,
        stats: conv.record?.stats || {},
        recordId: conv.recordId
      });
    }

    const totalPassed = results.filter(r => r.passed).length;

    res.json({
      success: true,
      statusCode: 200,
      message: `Automated test run complete: ${totalPassed} of ${results.length} passed`,
      data: {
        total: results.length,
        passed: totalPassed,
        allPassed: totalPassed === results.length,
        results
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      error: { code: 'TEST_SUITE_ERROR', message: err.message }
    });
  }
}

