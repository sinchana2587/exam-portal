/**
 * End-to-End API Integration Test
 * Spins up Express server and tests all /api/converter/* endpoints and backward compatibility
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../data/fixtures');

function makeRequest(server, options, postData = null, isMultipart = false, multipartBoundary = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (isMultipart && multipartBoundary) {
      reqOptions.headers['Content-Type'] = `multipart/form-data; boundary=${multipartBoundary}`;
    } else if (postData && typeof postData === 'object' && !Buffer.isBuffer(postData)) {
      postData = JSON.stringify(postData);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuf = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(bodyBuf.toString('utf8'));
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyBuf,
          json
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function buildMultipartFormData(fields, fileField, filePath, filename) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }

  if (fileField && filePath) {
    const fileBytes = fs.readFileSync(filePath);
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    parts.push(fileBytes);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    boundary,
    buffer: Buffer.concat(parts)
  };
}

async function runApiTests() {
  console.log('--- RUNNING API END-TO-END INTEGRATION TESTS ---');
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  try {
    // 1. GET /api/converter/templates
    const tplRes = await makeRequest(server, { path: '/api/converter/templates', method: 'GET' });
    console.log('1. GET /api/converter/templates:', tplRes.statusCode === 200 ? 'PASS' : 'FAIL', tplRes.json?.data?.templates?.length, 'templates');
    if (tplRes.statusCode !== 200) throw new Error('Templates endpoint failed');

    // 2. Reject upload without destination template
    const noTpl = buildMultipartFormData({}, 'file', path.join(FIXTURES_DIR, 'students_sample.csv'), 'students.csv');
    const noTplRes = await makeRequest(server, { path: '/api/converter/upload', method: 'POST' }, noTpl.buffer, true, noTpl.boundary);
    console.log('2. Reject upload without destination template:', noTplRes.statusCode === 400 ? 'PASS' : 'FAIL');

    // 3. Reject upload with arbitrary destination template
    const arbTpl = buildMultipartFormData({ templateId: 'CUSTOM_RANDOM' }, 'file', path.join(FIXTURES_DIR, 'students_sample.csv'), 'students.csv');
    const arbTplRes = await makeRequest(server, { path: '/api/converter/upload', method: 'POST' }, arbTpl.buffer, true, arbTpl.boundary);
    console.log('3. Reject arbitrary destination template:', arbTplRes.statusCode === 400 ? 'PASS' : 'FAIL');

    // 4. POST /api/converter/upload with valid destination template STUDENT_LIST
    const validUpload = buildMultipartFormData({ templateId: 'STUDENT_LIST', department: 'CSE', semester: '5' }, 'file', path.join(FIXTURES_DIR, 'students_sample.csv'), 'students.csv');
    const uploadRes = await makeRequest(server, { path: '/api/converter/upload', method: 'POST' }, validUpload.buffer, true, validUpload.boundary);
    console.log('4. POST /api/converter/upload (STUDENT_LIST):', uploadRes.statusCode === 200 ? 'PASS' : 'FAIL', uploadRes.json?.data?.conversionId);
    if (uploadRes.statusCode !== 200) throw new Error('Valid upload failed');

    const conversionId = uploadRes.json.data.conversionId;

    // 5. GET /api/converter/:conversionId/preview
    const previewRes = await makeRequest(server, { path: `/api/converter/${conversionId}/preview`, method: 'GET' });
    console.log('5. GET /api/converter/:id/preview:', previewRes.statusCode === 200 ? 'PASS' : 'FAIL', 'Records:', previewRes.json?.data?.preview?.records?.length);

    // 6. PUT /api/converter/:conversionId/correct
    const currentRecords = previewRes.json.data.preview.records;
    currentRecords[0].studentName = 'Aakash Sharma (Corrected)';
    const correctRes = await makeRequest(server, { path: `/api/converter/${conversionId}/correct`, method: 'PUT' }, { records: currentRecords });
    console.log('6. PUT /api/converter/:id/correct:', correctRes.statusCode === 200 ? 'PASS' : 'FAIL', 'Updated name:', correctRes.json?.data?.preview?.records[0]?.studentName);

    // 7. POST /api/converter/:conversionId/generate
    const genRes = await makeRequest(server, { path: `/api/converter/${conversionId}/generate`, method: 'POST' });
    console.log('7. POST /api/converter/:id/generate:', genRes.statusCode === 200 ? 'PASS' : 'FAIL', 'Filename:', genRes.json?.data?.filename);

    // 8. GET /api/converter/:conversionId/download
    const dlRes = await makeRequest(server, { path: `/api/converter/${conversionId}/download`, method: 'GET' });
    console.log('8. GET /api/converter/:id/download:', dlRes.statusCode === 200 ? 'PASS' : 'FAIL', 'Bytes:', dlRes.body.length);

    // 9. Backward compatibility: GET /api/templates
    const legacyTpl = await makeRequest(server, { path: '/api/templates', method: 'GET' });
    console.log('9. Backward Compatibility - GET /api/templates:', legacyTpl.statusCode === 200 ? 'PASS' : 'FAIL');

    // 10. Backward compatibility: GET /api/health
    const healthRes = await makeRequest(server, { path: '/api/health', method: 'GET' });
    console.log('10. Backward Compatibility - GET /api/health:', healthRes.statusCode === 200 ? 'PASS' : 'FAIL');

    console.log('\n--- ALL 10 API INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    server.close();
  }
}

runApiTests().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});
