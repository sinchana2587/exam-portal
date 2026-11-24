# MIT Mysore CBT Examination Portal - Backend API Contract

**Version:** 1.0.0  
**Target Environment:** Local College LAN / Examination Server  
**Default Base URL:** `http://localhost:8080` (Development) / `http://192.168.10.100:8080` (Lab Production)  
**Content-Type:** `application/json`  
**Authentication Scheme:** Bearer Token via HTTP Header (`Authorization: Bearer <sessionToken>`)

---

## 1. Global Conventions

### 1.1 Error Response Specification
All non-`2xx` HTTP responses return a structured JSON body:
```json
{
  "code": "ERROR_IDENTIFIER_STRING",
  "message": "Human-readable explanation suitable for display to student or proctor.",
  "details": null
}
```

Standard HTTP status codes used:
- `400 Bad Request`: Validation failure or malformed payload.
- `401 Unauthorized`: Missing or invalid session token. Frontend clears session and redirects to login.
- `403 Forbidden`: Action prohibited (e.g., student attempting to modify answers after exam submission or lock).
- `404 Not Found`: Student, examination session, or question not found.
- `500 Internal Server Error`: Lab Server internal processing error.

---

## 2. Student Examination Endpoints

### 2.1 Authenticate Student
Validates candidate credentials and retrieves their examination assignment.

- **Method**: `POST`
- **Path**: `/api/student/login`
- **Authentication**: None
- **Request Body**:
```json
{
  "usn": "4MH25CS149",
  "dateOfBirth": "2004-05-14"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "authenticated": true,
  "student": {
    "usn": "4MH25CS149",
    "fullName": "Aditya Deshmukh",
    "department": "Computer Science & Engineering",
    "semester": "5",
    "section": "A",
    "assignedWorkstationId": "LAB01-PC-03",
    "assignedVersion": "A",
    "sessionToken": "jwt_or_opaque_session_token_here",
    "dateOfBirth": "2004-05-14"
  },
  "examSession": {
    "examinationId": "EXAM-2026-BCS501",
    "sessionId": "SES-CSE-5A-BCS501-MORN",
    "cycleName": "Internal Assessment - I",
    "examinationType": "Computer-Based MCQ",
    "subjectCode": "BCS501",
    "subjectName": "Operating Systems & System Software",
    "department": "Computer Science & Engineering",
    "semester": "5",
    "section": "A",
    "scheduledDate": "2026-11-16",
    "startTime": "09:30 AM",
    "endTime": "10:15 AM",
    "sessionSlot": "Morning Slot 1",
    "durationMinutes": 45,
    "totalQuestions": 30,
    "totalMarks": 30,
    "marksPerCorrect": 1,
    "negativeMarkingPerWrong": 0,
    "laboratoryName": "CSE Central Computing Facility - Lab 1",
    "availabilityState": "ACTIVE",
    "availabilityMessage": "Examination session is live.",
    "instructionsAvailable": true,
    "selectedPaperLabel": "Paper Version A",
    "assignedVersion": "A",
    "workstationId": "LAB01-PC-03"
  },
  "serverTimestampMs": 1731771000000
}
```

---

### 2.2 Student Logout
Invalidates the current session token on the server.

- **Method**: `POST`
- **Path**: `/api/student/logout`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true
}
```

---

### 2.3 Fetch Current Examination Session
Retrieves the candidate's active session envelope for session resumption or page reload.

- **Method**: `GET`
- **Path**: `/api/student/exam-session`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Success Response (`200 OK`)**:
```json
{
  "student": { ... },
  "examSession": { ... },
  "examStarted": true,
  "instructionsConfirmed": true,
  "submitted": false,
  "submissionReceipt": null
}
```

---

### 2.4 Fetch Examination Instructions
Retrieves syllabus instructions, duration, and conduct rules.

- **Method**: `GET`
- **Path**: `/api/student/instructions`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Success Response (`200 OK`)**:
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "institutionName": "Maharaja Institute of Technology Mysore",
  "subjectCode": "BCS501",
  "subjectName": "Operating Systems & System Software",
  "examinationType": "Internal Assessment - I (Computer-Based MCQ)",
  "scheduledDate": "2026-11-16",
  "startTime": "09:30 AM",
  "endTime": "10:15 AM",
  "sessionSlot": "Morning Slot 1",
  "laboratoryName": "CSE Examination Lab 1",
  "durationMinutes": 45,
  "totalQuestions": 30,
  "totalMarks": 30,
  "marksPerCorrect": 1,
  "negativeMarkingPerWrong": 0,
  "generalRules": [
    "The exam consists of 30 Multiple Choice Questions.",
    "Strict Monitoring: Do not switch browser tabs, minimize window, or open other applications."
  ],
  "navigationRules": [
    "Use Previous and Save & Next to move between questions.",
    "Click question numbers in the palette to jump directly."
  ],
  "answerModificationRules": [
    "Click option card to select response.",
    "Use Clear Response to remove selection."
  ],
  "submissionAndAutoSubmitRules": [
    "Final submission permanently locks answers.",
    "Timer reaching 00:00 will auto-submit all saved responses."
  ]
}
```

---

### 2.5 Fetch Assigned Question Paper
Returns candidate's assigned version of questions without answers or grading keys.

- **Method**: `GET`
- **Path**: `/api/student/exam/questions`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Success Response (`200 OK`)**:
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "workstationId": "LAB01-PC-03",
  "selectedPaperLabel": "Paper Version A",
  "assignedVersion": "A",
  "totalQuestions": 30,
  "questions": [
    {
      "questionId": "Q01",
      "displayNumber": 1,
      "moduleNumber": 1,
      "moduleTitle": "Module 1: Core Principles",
      "questionText": "In a preemptive operating system, how does a counting semaphore handle multiple concurrent process requests?",
      "codeSnippet": null,
      "options": [
        { "optionKey": "A", "optionId": "OPT_01_A", "text": "By decrementing the semaphore value and blocking..." },
        { "optionKey": "B", "optionId": "OPT_01_B", "text": "By converting concurrent threads into..." },
        { "optionKey": "C", "optionId": "OPT_01_C", "text": "By terminating lowest priority process..." },
        { "optionKey": "D", "optionId": "OPT_01_D", "text": "By resetting program counter..." }
      ]
    }
  ]
}
```

---

### 2.6 Start Examination / Confirm Instructions
Starts the official countdown timer on the Lab Server.

- **Method**: `POST`
- **Path**: `/api/student/exam/start`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "instructionsConfirmed": true
}
```
- **Success Response (`200 OK`)**:
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "assignedVersion": "A",
  "workstationId": "LAB01-PC-03",
  "instructionsConfirmed": true,
  "examStarted": true,
  "submitted": false,
  "serverTimestampMs": 1731771000000,
  "examExpiresAtMs": 1731773700000,
  "remainingSeconds": 2700,
  "responses": {}
}
```

---

### 2.7 Fetch Authoritative Runtime & Timer State
Synchronizes remaining time and previously saved answers.

- **Method**: `GET`
- **Path**: `/api/student/exam/state`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Success Response (`200 OK`)**: Returns `ExamRuntimeStateResponse` with current `remainingSeconds` and `responses`.

---

### 2.8 Save Student Answer
Records selection, review mark, or cleared answer for a question.

- **Method**: `POST`
- **Path**: `/api/student/exam/answers`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "questionId": "Q01",
  "selectedOption": "A",
  "markedForReview": false,
  "visited": true,
  "assignedVersion": "A",
  "clientSequence": 1
}
```
*(Note: If `selectedOption` is `null`, the response is cleared.)*
- **Success Response (`200 OK`)**:
```json
{
  "acknowledged": true,
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "questionId": "Q01",
  "selectedOption": "A",
  "markedForReview": false,
  "visited": true,
  "assignedVersion": "A",
  "savedAt": "09:35:12 AM",
  "serverTimestampMs": 1731771312000,
  "remainingSeconds": 2388
}
```

---

### 2.9 Submit Final Examination
Finalizes the examination, locks responses on the server, and issues official receipt.

- **Method**: `POST`
- **Path**: `/api/student/exam/submit`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "assignedVersion": "A",
  "submissionTrigger": "MANUAL"
}
```
*(Values for `submissionTrigger`: `"MANUAL"` or `"AUTO_TIMER_EXPIRED"`)*
- **Success Response (`200 OK`)**:
```json
{
  "submitted": true,
  "locked": true,
  "receipt": {
    "confirmationReference": "MIT-CBT-2026-9F7A2B",
    "examinationId": "EXAM-2026-BCS501",
    "sessionId": "SES-CSE-5A-BCS501-MORN",
    "studentUsn": "4MH25CS149",
    "studentName": "Aditya Deshmukh",
    "department": "Computer Science & Engineering",
    "semester": "5",
    "section": "A",
    "subjectCode": "BCS501",
    "subjectName": "Operating Systems & System Software",
    "examinationType": "Internal Assessment - I (Computer-Based MCQ)",
    "assignedWorkstationId": "LAB01-PC-03",
    "submittedAt": "10:14:52 AM",
    "submissionTrigger": "MANUAL",
    "totalQuestions": 30,
    "answeredCount": 28,
    "unansweredCount": 2
  }
}
```

---

## 3. Security & Lockdown Endpoints

### 3.1 Report Security Violation
Notifies the Lab Server proctoring engine of candidate window infractions.

- **Method**: `POST`
- **Path**: `/api/security/violation`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
```json
{
  "violationType": "TAB_SWITCH",
  "label": "Browser Tab Switch",
  "description": "Candidate navigated away from the active examination browser tab.",
  "studentUsn": "4MH25CS149",
  "examinationId": "EXAM-2026-BCS501",
  "currentQuestionIndex": 3,
  "remainingSeconds": 2400,
  "answeredCount": 3
}
```
- **Success Response (`200 OK`)**:
```json
{
  "isLocked": true,
  "violationCount": 1,
  "isPermanentlyLocked": false,
  "lockedAtMs": 1731771600000
}
```

---

### 3.2 Invigilator Password Unlock
Verifies room invigilator credentials to resume a locked candidate session.

- **Method**: `POST`
- **Path**: `/api/security/unlock`
- **Headers**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
```json
{
  "enteredPassword": "secret_password",
  "studentUsn": "4MH25CS149",
  "examinationId": "EXAM-2026-BCS501"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Invigilator authorization verified. Resuming examination session.",
  "state": {
    "isLocked": false,
    "violation": null,
    "violationCount": 1,
    "lockedAtMs": null,
    "failedAttempts": 0,
    "maxAttempts": 3,
    "isPermanentlyLocked": false,
    "resumptionCount": 1,
    "lastResumedAt": "09:40:00 AM",
    "savedQuestionIndex": 3,
    "savedRemainingSeconds": 2400,
    "savedAnswerCount": 3
  }
}
```

---

## 4. COE Emergency Recovery & Instructor Console

### 4.1 Instructor Login
- **Method**: `POST`
- **Path**: `/api/instructor/login`
- **Request Body**:
```json
{
  "recoveryId": "EMGR-LOGIN-01",
  "recoveryKey": "ProTick-0011"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "authenticated": true,
  "token": "instr_session_token_jwt",
  "instructor": {
    "recoveryId": "EMGR-LOGIN-01",
    "name": "COE Emergency Recovery Invigilator"
  }
}
```

---

### 4.2 Fetch Re-Login Authorisation List
- **Method**: `GET`
- **Path**: `/api/recovery/relogin-authorisations`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Success Response (`200 OK`)**:
```json
[
  {
    "studentUsn": "4MH25CS149",
    "studentName": "Aditya Deshmukh",
    "assignedSystemId": "LAB01-PC-03",
    "reloginSystemId": "LAB01-PC-07",
    "examinationSessionStatus": "INTERRUPTED",
    "reloginRequestStatus": "PENDING_APPROVAL",
    "instructorAuthorisation": "Pending Lab Instructor Review",
    "dateTime": "11/16/2026, 09:35:00 AM",
    "canApprove": true,
    "activeTokenId": null
  }
]
```

---

### 4.3 Approve Re-Login Request
- **Method**: `POST`
- **Path**: `/api/recovery/relogin-authorisations/approve`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Request Body**:
```json
{
  "usn": "4MH25CS149",
  "reason": "Terminal Hardware Crash on LAB01-PC-03"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "tokenId": "REL-AUTH-2026-4MH25CS149-8F21",
  "studentUsn": "4MH25CS149",
  "studentName": "Aditya Deshmukh",
  "assignedSystemId": "LAB01-PC-03",
  "targetSystemId": "Any Available PC",
  "examinationSessionStatus": "INTERRUPTED",
  "reloginRequestStatus": "APPROVED",
  "instructorAuthorisation": "EMGR-LOGIN-01 (Lab Instructor)",
  "reason": "Terminal Hardware Crash on LAB01-PC-03",
  "authorisedAt": "2026-11-16T09:45:00.000Z",
  "expiresAt": "2026-11-16T10:00:00.000Z",
  "isOneTimeUsed": false
}
```

---

### 4.4 Get Student Recovery Overview
- **Method**: `GET`
- **Path**: `/api/recovery/overview`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Query Parameters**: `?search=&department=&status=&laboratory=`
- **Success Response (`200 OK`)**: Array of `StudentRecoveryOverview`.

---

### 4.5 Get Multi-Computer Transfer History
- **Method**: `GET`
- **Path**: `/api/recovery/transfers`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Success Response (`200 OK`)**: Array of `SessionTransferRecord`.

---

### 4.6 Get Recovery Audit Trail
- **Method**: `GET`
- **Path**: `/api/recovery/audit-logs`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Success Response (`200 OK`)**: Array of `RecoveryAuditLog`.

---

### 4.7 Get / Update COE Configuration
- **Methods**: `GET /api/recovery/config` & `PUT /api/recovery/config`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Success Response (`200 OK`)**:
```json
{
  "enabled": true,
  "recoveryId": "EMGR-LOGIN-01",
  "recoveryKey": "ProTick-0011",
  "lastRotatedAt": "2026-11-12T09:00:00.000Z",
  "rotatedBy": "COE Administration (MIT Mysore)"
}
```

---

### 4.8 Clear Dynamic Session Recovery Data (Fresh Start)
- **Method**: `POST`
- **Path**: `/api/recovery/fresh-start`
- **Headers**: `Authorization: Bearer <instructorToken>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "All session attempts and locks reset."
}
```

---

## 5. Health Check
- **Method**: `GET`
- **Path**: `/api/health`
- **Authentication**: None
- **Success Response (`200 OK`)**:
```json
{
  "status": "UP",
  "timestamp": 1731771000000
}
```
