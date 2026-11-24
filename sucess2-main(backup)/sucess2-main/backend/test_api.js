const http = require('http');

async function test(name, path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-hod-department-id': 'CS'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('[PASS] ' + name + ' (' + res.statusCode + '): ' + data.slice(0, 120) + '...');
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (e) => {
      console.log('[FAIL] ' + name + ': ' + e.message);
      resolve({ error: e });
    });
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAll() {
  console.log('--- STARTING LOCALHOST:8080 INTEGRATION TESTS WITH POSTGRESQL ---');
  await test('1. Health Check', '/api/health');
  await test('2. Principal Login', '/api/v1/auth/login', 'POST', { username: 'principal', password: 'PRINCIPAL@7658' });
  await test('3. HOD Login', '/api/v1/auth/login', 'POST', { username: 'hod.cs', password: 'Hod@cs123' });
  await test('4. COE Login', '/api/v1/auth/coe/login', 'POST', { username: 'coe', password: 'COE@5828' });
  await test('5. Student Login', '/api/student/login', 'POST', { usn: '4MH21CS001', dateOfBirth: '2003-01-15' });
  await test('6. Connection 1 (HOD Exams)', '/api/v1/hod/examinations');
  await test('7. Connection 2 (COE Eligibility)', '/api/v1/institution/eligibility?departmentId=CS&semesterId=5');
  await test('8. Connection 3 (Student Instructions)', '/api/student/instructions');
  await test('9. Connection 4 (COE Session Monitoring)', '/monitoring/sessions');
  await test('10. Connection 5 (HOD Results)', '/api/v1/hod/results');
  console.log('--- ALL INTEGRATION TESTS COMPLETED ---');
}

runAll();
