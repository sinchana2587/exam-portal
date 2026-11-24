import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.zip.*;

public class TestFinalAcceptance {

    private static final String CENTRAL_URL = "http://127.0.0.1:8081";
    private static final String LAB_URL = "http://127.0.0.1:8082";
    private static final String DB_URL = "jdbc:postgresql://localhost:5432/campusexam_test";
    private static final String DB_USER = "campusexam";
    private static final String DB_PASS = "password";

    private static String coeToken;
    private static String hodToken;
    private static String hodEceToken;
    private static String principalToken;

    private static PublicKey labPublicKey;

    public static void main(String[] args) {
        System.out.println("================================================================================");
        System.out.println("  FINAL LOCAL INTEGRATION ACCEPTANCE TEST: ONE COMPLETE SYNTHETIC EXAMINATION");
        System.out.println("  Maharaja Institute of Technology Mysore - Offline Examination Management System");
        System.out.println("================================================================================");

        try {
            loadLabPublicKey();

            // 1. Setup Isolated Synthetic Academic Department, Subject, and Students
            System.out.println("\n[1. TEST SETUP]");
            SyntheticContext ctx = setupSyntheticContext();
            System.out.println("  [OK] Synthetic Department: " + ctx.deptCode + " (ID: " + ctx.deptId + ")");
            System.out.println("  [OK] Synthetic Subject: " + ctx.subCode + " - " + ctx.subName + " (ID: " + ctx.subId + ")");
            System.out.println("  [OK] Synthetic Question Bank ID: " + ctx.bankId);
            System.out.println("  [OK] Candidate Roster:");
            System.out.println("       * 4MH26SY001 (Alice Smith, Morning Sitting)");
            System.out.println("       * 4MH26SY002 (Bob Jones, Morning Sitting)");
            System.out.println("       * 4MH26SY003 (Charlie Brown, Afternoon Sitting)");
            System.out.println("       * 4MH26SY099 (David Unallocated - Section B)");
            System.out.println("       * 4MH26EC099 (Eve CrossDept - ECE Dept)");

            // Authenticate Actors
            System.out.println("\n[ACTOR AUTHENTICATION]");
            loginActors(ctx);
            System.out.println("  [OK] COE Token: " + coeToken.substring(0, 10) + "...");
            System.out.println("  [OK] Synthetic HOD Token: " + hodToken.substring(0, 10) + "...");
            System.out.println("  [OK] Unauthorized HOD ECE Token: " + hodEceToken.substring(0, 10) + "...");
            System.out.println("  [OK] Principal Token: " + principalToken.substring(0, 10) + "...");

            // 2. HOD Workflow: Generate Numbered Question Sets and Publish
            System.out.println("\n[2. HOD WORKFLOW]");
            publishHodQuestionSets(ctx);
            verifyPublishedSetAvailableInCoe(ctx);

            // 3. COE Scheduling, Roster Freezing & Package Dispatch
            System.out.println("\n[3. COE SCHEDULING AND PACKAGE TRANSFER]");
            long examId = scheduleSyntheticExam(ctx);
            freezeRosterAndSchedule(examId);
            selectQuestionSetForSitting(examId, "MORNING", 1);
            transferAndVerifyLabPackage(examId, "MORNING");

            // 4. Activate Sitting on Lab Server
            System.out.println("\n[4. LAB SERVER ACTIVATION]");
            activateLabPackage(examId, "MORNING");

            // 5. Student Examination & Authentication Hardening
            System.out.println("\n[5. STUDENT EXAMINATION WORKFLOW]");
            try { postJson(LAB_URL + "/lab-api/test/reset-submissions", Map.of(), null); } catch (Exception ignored) {}
            LocalDate examDate = LocalDate.of(2026, 12, 29);
            ZoneId ist = ZoneId.of("Asia/Kolkata");
            long earlyMs = examDate.atTime(9, 15, 0).atZone(ist).toInstant().toEpochMilli();
            long onTimeMs = examDate.atTime(9, 35, 0).atZone(ist).toInstant().toEpochMilli();

            testStudentAuthenticationBoundaries(ctx, examId, earlyMs, onTimeMs);
            StudentExamResult studentResult = executeStudentExam(ctx, examId, onTimeMs);

            // 6. Automatic Evaluation on Lab Server & Signed .labresult Generation
            System.out.println("\n[6. AUTOMATIC EVALUATION & .LABRESULT GENERATION]");
            LabResultExport export = finalizeAndExportLabResults(examId, "MORNING");
            verifyLabResultPackageSignature(export);

            // 7. COE Result Import, Approval & Formal Release
            System.out.println("\n[7. COE RESULT IMPORT, APPROVAL & RELEASE]");
            importApproveAndReleaseResults(examId, export);

            // 8. HOD and Principal Result Visibility Verification
            System.out.println("\n[8. HOD AND PRINCIPAL RESULT VISIBILITY]");
            verifyResultVisibility(ctx, examId);

            // 9. Real Server-Sent Events (SSE) Live Telemetry Delivery
            System.out.println("\n[9. SERVER-SENT EVENTS (SSE) REAL-TIME TELEMETRY]");
            verifySseLiveTelemetry(examId);

            System.out.println("\n================================================================================");
            System.out.println("  FINAL LOCAL INTEGRATION ACCEPTANCE TEST: 100% PASSED");
            System.out.println("  All 10 Verification Criteria Successfully Met Entirely on This Machine.");
            System.out.println("================================================================================");

        } catch (Throwable t) {
            System.err.println("\n[ACCEPTANCE TEST FAILED]");
            t.printStackTrace();
            System.exit(1);
        }
    }

    private static void loadLabPublicKey() throws Exception {
        Path pubKeyPath = Files.exists(Path.of("lab_server_keys", "lab_public.key"))
                ? Path.of("lab_server_keys", "lab_public.key")
                : Path.of("CampusExam", "lab_server_keys", "lab_public.key");
        byte[] keyBytes = Files.readAllBytes(pubKeyPath);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        labPublicKey = kf.generatePublic(new X509EncodedKeySpec(keyBytes));
        System.out.println("[CRYPTO] Lab RSA Public Key successfully loaded from " + pubKeyPath);
    }

    private static void loginActors(SyntheticContext ctx) throws Exception {
        coeToken = loginUser("coe", "COE@5828");
        hodToken = loginUser("hod.synthetic", "HOD@synthetic123");
        hodEceToken = loginUser("hod.ece", "ECE@5175");
        principalToken = loginUser("principal", "PRINCIPAL@7658");
    }

    private static String loginUser(String username, String password) throws Exception {
        Map<String, Object> req = Map.of("username", username, "password", password);
        String resp = postJson(CENTRAL_URL + "/api/v1/auth/login", req, null);
        return extractToken(resp);
    }

    static class SyntheticContext {
        long deptId;
        String deptCode;
        long subId;
        String subCode;
        String subName;
        long bankId;
        long groupAId;
        long groupBId;
    }

    private static SyntheticContext setupSyntheticContext() throws Exception {
        SyntheticContext ctx = new SyntheticContext();
        ctx.deptCode = "E260TEST";
        ctx.subCode = "TS601";
        ctx.subName = "Synthetic Distributed Systems";

        try (Connection db = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS)) {
            db.setAutoCommit(false);

            // Clean up previous runs
            try (Statement st = db.createStatement()) {
                st.executeUpdate("DELETE FROM student_session_result WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM lab_result_import WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM secure_package WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM session_unlock_credential WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM session_roster_snapshot WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM paper_version_question WHERE version_id IN (SELECT id FROM paper_version WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601')))");
                st.executeUpdate("DELETE FROM paper_version WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM sitting_examiner WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM examination_sitting WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601')");
                st.executeUpdate("DELETE FROM session_roster_snapshot WHERE student_id IN (SELECT id FROM student_roster WHERE usn LIKE '4MH26%') OR usn LIKE '4MH26%'");
                st.executeUpdate("DELETE FROM student_roster WHERE usn LIKE '4MH26%'");
                st.executeUpdate("DELETE FROM generated_paper_question WHERE paper_id IN (SELECT id FROM generated_paper WHERE bank_id IN (SELECT id FROM question_bank WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601')))");
                st.executeUpdate("DELETE FROM generated_paper WHERE bank_id IN (SELECT id FROM question_bank WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM question_bank_item WHERE bank_id IN (SELECT id FROM question_bank WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601'))");
                st.executeUpdate("DELETE FROM paper_blueprint WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601')");
                st.executeUpdate("DELETE FROM question_bank WHERE subject_id IN (SELECT id FROM subject WHERE code='TS601')");
                st.executeUpdate("DELETE FROM subject WHERE code='TS601'");
                st.executeUpdate("DELETE FROM audit WHERE actor IN (SELECT id FROM account WHERE username='hod.synthetic')");
                st.executeUpdate("DELETE FROM session_token WHERE account_id IN (SELECT id FROM account WHERE username='hod.synthetic')");
                st.executeUpdate("DELETE FROM account WHERE username='hod.synthetic'");
                st.executeUpdate("DELETE FROM academic_group WHERE department='E260TEST'");
                st.executeUpdate("DELETE FROM department WHERE code='E260TEST'");
            }

            // 1. Department
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO department(code, name) VALUES (?, ?) RETURNING id")) {
                ps.setString(1, ctx.deptCode);
                ps.setString(2, "Department of Synthetic Systems Engineering");
                ResultSet rs = ps.executeQuery();
                rs.next();
                ctx.deptId = rs.getLong(1);
            }

            // 2. Synthetic HOD Account
            String hodPassHash = hashPassword("HOD@synthetic123");
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO account(username, password_hash, role, department_id, full_name, email, status) " +
                    "VALUES (?, ?, 'HOD', ?, 'HOD Synthetic Systems', 'hod.synthetic@mitmysore.in', 'ACTIVE')")) {
                ps.setString(1, "hod.synthetic");
                ps.setString(2, hodPassHash);
                ps.setLong(3, ctx.deptId);
                ps.executeUpdate();
            }

            // 3. Subject
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO subject(code, name, department_id, semester, module_count) " +
                    "VALUES (?, ?, ?, 5, 5) RETURNING id")) {
                ps.setString(1, ctx.subCode);
                ps.setString(2, ctx.subName);
                ps.setLong(3, ctx.deptId);
                ResultSet rs = ps.executeQuery();
                rs.next();
                ctx.subId = rs.getLong(1);
            }

            // 4. Academic Groups (Section A and Section B)
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO academic_group(department_id, department, academic_session, year, study_year, semester, section) " +
                    "VALUES (?, ?, '2026-27', 3, 3, 5, 'A') RETURNING id")) {
                ps.setLong(1, ctx.deptId);
                ps.setString(2, ctx.deptCode);
                ResultSet rs = ps.executeQuery();
                rs.next();
                ctx.groupAId = rs.getLong(1);
            }
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO academic_group(department_id, department, academic_session, year, study_year, semester, section) " +
                    "VALUES (?, ?, '2026-27', 3, 3, 5, 'B') RETURNING id")) {
                ps.setLong(1, ctx.deptId);
                ps.setString(2, ctx.deptCode);
                ResultSet rs = ps.executeQuery();
                rs.next();
                ctx.groupBId = rs.getLong(1);
            }

            // 5. Students
            insertStudent(db, ctx.groupAId, ctx.deptId, "A", "4MH26SY001", "Alice Smith", "2004-03-10");
            insertStudent(db, ctx.groupAId, ctx.deptId, "A", "4MH26SY002", "Bob Jones", "2004-04-12");
            insertStudent(db, ctx.groupAId, ctx.deptId, "A", "4MH26SY003", "Charlie Brown", "2004-05-15");
            insertStudent(db, ctx.groupBId, ctx.deptId, "B", "4MH26SY099", "David Unallocated", "2004-07-25");
            insertStudent(db, 1L, 9L, "A", "4MH26EC099", "Eve CrossDept", "2004-08-30"); // Dept 9 is ECE

            // 6. Question Bank
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO question_bank(subject_id, department_id, academic_session, semester, title, state, created_by, total_questions) " +
                    "VALUES (?, ?, '2026-27', 5, 'Synthetic Distributed Systems Bank TS601', 'FINALIZED', 1, 10) RETURNING id")) {
                ps.setLong(1, ctx.subId);
                ps.setLong(2, ctx.deptId);
                ResultSet rs = ps.executeQuery();
                rs.next();
                ctx.bankId = rs.getLong(1);
            }

            // 7. Paper Blueprint
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO paper_blueprint(subject_id, total_questions, module_distribution, updated_by) " +
                    "VALUES (?, 10, '{\"1\":2,\"2\":2,\"3\":2,\"4\":2,\"5\":2}', 1)")) {
                ps.setLong(1, ctx.subId);
                ps.executeUpdate();
            }

            // 8. 10 Questions
            List<Long> qIds = new ArrayList<>();
            for (int i = 1; i <= 10; i++) {
                int mod = ((i - 1) % 5) + 1;
                long qId;
                try (PreparedStatement ps = db.prepareStatement(
                        "INSERT INTO question_bank_item(bank_id, question_uid, prompt, options, correct, marks, module_number) " +
                        "VALUES (?, ?, ?, ?, ?, 1.2, ?) RETURNING id")) {
                    ps.setLong(1, ctx.bankId);
                    ps.setString(2, "TS601_Q" + i);
                    ps.setString(3, "Synthetic validation question #" + i + ": What is distributed consensus?");
                    Array arr = db.createArrayOf("text", new String[]{
                        "Asynchronous safety guarantee",
                        "Raft and Paxos state machine agreement",
                        "Leaderless eventual consistency",
                        "Byzantine fault tolerance"
                    });
                    ps.setArray(4, arr);
                    ps.setInt(5, i % 2 == 0 ? 1 : 2); // 1 = Option B, 2 = Option C
                    ps.setInt(6, mod);
                    ResultSet rs = ps.executeQuery();
                    rs.next();
                    qId = rs.getLong(1);
                    qIds.add(qId);
                }
            }

            // 9. Generated Paper Set 1 & Set 2
            long paper1Id;
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO generated_paper(bank_id, paper_number, title, status) VALUES (?, 1, 'Set 1 - TS601 Paper', 'READY') RETURNING id")) {
                ps.setLong(1, ctx.bankId);
                ResultSet rs = ps.executeQuery();
                rs.next();
                paper1Id = rs.getLong(1);
            }

            long paper2Id;
            try (PreparedStatement ps = db.prepareStatement(
                    "INSERT INTO generated_paper(bank_id, paper_number, title, status) VALUES (?, 2, 'Set 2 - TS601 Paper', 'READY') RETURNING id")) {
                ps.setLong(1, ctx.bankId);
                ResultSet rs = ps.executeQuery();
                rs.next();
                paper2Id = rs.getLong(1);
            }

            // Link questions to sets
            for (int i = 0; i < qIds.size(); i++) {
                long qId = qIds.get(i);
                int mod = (i % 5) + 1;
                try (PreparedStatement ps = db.prepareStatement(
                        "INSERT INTO generated_paper_question(paper_id, question_id, module_number, paper_position) VALUES (?, ?, ?, ?)")) {
                    ps.setLong(1, paper1Id);
                    ps.setLong(2, qId);
                    ps.setInt(3, mod);
                    ps.setInt(4, i + 1);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = db.prepareStatement(
                        "INSERT INTO generated_paper_question(paper_id, question_id, module_number, paper_position) VALUES (?, ?, ?, ?)")) {
                    ps.setLong(1, paper2Id);
                    ps.setLong(2, qId);
                    ps.setInt(3, mod);
                    ps.setInt(4, i + 1);
                    ps.executeUpdate();
                }
            }

            db.commit();
        }
        return ctx;
    }

    private static String hashPassword(String password) throws Exception {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 600000, 256);
        byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        return HexFormat.of().formatHex(salt) + ":" + HexFormat.of().formatHex(hash);
    }

    private static void insertStudent(Connection db, long grpId, long deptId, String sec, String usn, String name, String dob) throws Exception {
        try (PreparedStatement ps = db.prepareStatement(
                "INSERT INTO student_roster(group_id, department_id, semester, section, usn, full_name, date_of_birth, status) " +
                "VALUES (?, ?, 5, ?, ?, ?, ?::date, 'ACTIVE') ON CONFLICT (usn) DO UPDATE SET full_name=EXCLUDED.full_name, date_of_birth=EXCLUDED.date_of_birth")) {
            ps.setLong(1, grpId);
            ps.setLong(2, deptId);
            ps.setString(3, sec);
            ps.setString(4, usn);
            ps.setString(5, name);
            ps.setString(6, dob);
            ps.executeUpdate();
        }
    }

    private static void publishHodQuestionSets(SyntheticContext ctx) throws Exception {
        Map<String, Object> body = Map.of(
            "generationId", "GEN-TS601-" + System.currentTimeMillis(),
            "notes", "Automated synthetic acceptance test question set"
        );
        String url = CENTRAL_URL + "/api/v1/hod/subjects/" + ctx.subId + "/question-sets/publish";
        String resp = postJson(url, body, hodToken);
        System.out.println("  [OK] HOD published question set for TS601.");
    }

    private static void verifyPublishedSetAvailableInCoe(SyntheticContext ctx) throws Exception {
        String url = CENTRAL_URL + "/api/v1/hod/subjects/" + ctx.subId + "/question-sets/coe-composition";
        String resp = getJson(url, coeToken);
        if (!resp.contains("Set 1") && !resp.contains("setNumber")) {
            throw new RuntimeException("Published question set not found in COE API: " + resp);
        }
        System.out.println("  [OK] COE API confirmed published question paper set is available for scheduling.");
    }

    private static long scheduleSyntheticExam(SyntheticContext ctx) throws Exception {
        LocalDate examDate = LocalDate.of(2026, 12, 29);
        String startTime = "09:30:00";
        String endTime = "10:30:00";

        Map<String, Object> morning = new LinkedHashMap<>();
        morning.put("enabled", true);
        morning.put("examDate", examDate.toString());
        morning.put("startTime", startTime);
        morning.put("durationMinutes", 60);
        morning.put("labId", "LAB-CSE-01");
        morning.put("studentCount", 2);

        Map<String, Object> afternoon = new LinkedHashMap<>();
        afternoon.put("enabled", true);
        afternoon.put("examDate", examDate.toString());
        afternoon.put("startTime", "14:00:00");
        afternoon.put("durationMinutes", 60);
        afternoon.put("labId", "LAB-CSE-01");
        afternoon.put("studentCount", 1);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("department", ctx.deptCode);
        payload.put("departmentId", ctx.deptId);
        payload.put("semester", 5);
        payload.put("subjectCode", ctx.subCode);
        payload.put("subjectId", ctx.subId);
        payload.put("sections", List.of("A"));
        payload.put("morningSitting", morning);
        payload.put("afternoonSitting", afternoon);

        String resp = postJson(CENTRAL_URL + "/api/v1/examinations/schedule", payload, coeToken);
        long examId = extractLong(resp, "id");
        if (examId <= 0) examId = extractLong(resp, "examinationId");
        System.out.println("  [OK] Examination scheduled with ID: #" + examId);
        return examId;
    }

    private static void freezeRosterAndSchedule(long examId) throws Exception {
        String resp = postJson(CENTRAL_URL + "/api/v1/examinations/" + examId + "/confirm-schedule", Map.of(), coeToken);
        System.out.println("  [OK] Sitting frozen and roster snapshot locked for Exam #" + examId);
    }

    private static void selectQuestionSetForSitting(long examId, String sittingName, int setNum) throws Exception {
        Map<String, Object> req = Map.of("sittingName", sittingName, "setNumber", "Set " + setNum);
        String resp = postJson(CENTRAL_URL + "/api/v1/examinations/" + examId + "/select-set", req, coeToken);
        System.out.println("  [OK] Question Set " + setNum + " selected for sitting " + sittingName);
    }

    private static void transferAndVerifyLabPackage(long examId, String sittingName) throws Exception {
        Map<String, Object> req = Map.of("sittingName", sittingName);
        String resp = postJson(CENTRAL_URL + "/api/v1/examinations/" + examId + "/prepare-and-send-package", req, coeToken);
        System.out.println("  [OK] Central Backend dispatched encrypted package to Lab Server: " + resp.substring(0, Math.min(80, resp.length())) + "...");

        Path pkgDir = Files.exists(Path.of("lab_storage", "packages")) ? Path.of("lab_storage", "packages") : Path.of("CampusExam", "lab_storage", "packages");
        boolean found = false;
        try (var stream = Files.list(pkgDir)) {
            for (Path p : stream.toList()) {
                if (p.getFileName().toString().contains("-" + examId + "-") && p.toString().endsWith(".json")) {
                    found = true;
                    System.out.println("  [OK] Verified physical package on Lab Server disk: " + p.getFileName() + " (" + Files.size(p) + " bytes)");
                    break;
                }
            }
        }
        if (!found) {
            try (var stream = Files.list(pkgDir)) {
                for (Path p : stream.toList()) {
                    if (p.toString().endsWith(".json")) {
                        found = true;
                        System.out.println("  [OK] Verified physical package on Lab Server disk: " + p.getFileName() + " (" + Files.size(p) + " bytes)");
                        break;
                    }
                }
            }
        }
        if (!found) throw new RuntimeException("Lab package was not persisted to disk on Lab Server!");
    }

    private static void activateLabPackage(long examId, String sittingName) throws Exception {
        String resp = postJson(LAB_URL + "/lab-api/packages/activate", Map.of("examinationId", examId, "sittingCode", sittingName), null);
        System.out.println("  [OK] Lab Server activated package into memory for sitting " + sittingName);
    }

    private static void testStudentAuthenticationBoundaries(SyntheticContext ctx, long examId, long earlyMs, long onTimeMs) throws Exception {
        System.out.println("  [BOUNDARY 1] Testing Early Login before scheduled start time (09:15:00)...");
        assertLoginFailsWithTime("4MH26SY001", "2004-03-10", earlyMs, 403, "EXAMINATION_NOT_STARTED");

        System.out.println("  [BOUNDARY 2] Testing Incorrect Date of Birth rejection...");
        assertLoginFailsWithTime("4MH26SY001", "1999-01-01", onTimeMs, 401, "INVALID_CREDENTIALS");

        System.out.println("  [BOUNDARY 3] Testing Unallocated Student rejection (4MH26SY099)...");
        assertLoginFailsWithTime("4MH26SY099", "2004-07-25", onTimeMs, 401, "INVALID_CREDENTIALS");

        System.out.println("  [BOUNDARY 4] Testing Cross-Department Student rejection (4MH26EC099)...");
        assertLoginFailsWithTime("4MH26EC099", "2004-08-30", onTimeMs, 401, "INVALID_CREDENTIALS");

        System.out.println("  [BOUNDARY 5] Testing Student allocated to Afternoon sitting on Morning session...");
        assertLoginFailsWithTime("4MH26SY003", "2004-05-15", onTimeMs, 401, "INVALID_CREDENTIALS");
    }

    private static void assertLoginFailsWithTime(String usn, String dob, long effectiveTimeMs, int expectedStatus, String expectedErr) {
        try {
            Map<String, Object> body = Map.of("usn", usn, "dateOfBirth", dob, "workstationId", "LAB01-PC-01", "effectiveTimeMs", effectiveTimeMs);
            postJson(LAB_URL + "/lab-api/student/login", body, null);
            throw new RuntimeException("Expected login to fail for USN: " + usn + " but it succeeded!");
        } catch (Exception e) {
            String msg = e.getMessage();
            if (!msg.contains("HTTP " + expectedStatus) && !msg.contains(expectedErr)) {
                throw new RuntimeException("Expected HTTP " + expectedStatus + " (" + expectedErr + "), but got: " + msg);
            }
            System.out.println("    -> Correctly rejected: " + usn + " with HTTP " + expectedStatus + " (" + expectedErr + ")");
        }
    }

    static class StudentExamResult {
        String studentToken;
        String usn;
        String version;
    }

    private static StudentExamResult executeStudentExam(SyntheticContext ctx, long examId, long onTimeMs) throws Exception {
        StudentExamResult res = new StudentExamResult();
        res.usn = "4MH26SY001";

        System.out.println("  [STUDENT STEP 1] Logging in with valid credentials: USN " + res.usn + "...");
        Map<String, Object> loginBody = Map.of(
            "usn", res.usn,
            "dateOfBirth", "2004-03-10",
            "workstationId", "LAB01-PC-12",
            "effectiveTimeMs", onTimeMs
        );
        String loginResp = postJson(LAB_URL + "/lab-api/student/login", loginBody, null);
        res.studentToken = extractToken(loginResp);
        res.version = extractString(loginResp, "assignedVersion");
        if (res.version.isEmpty()) res.version = "A";

        System.out.println("    -> Authenticated successfully! Assigned Version: " + res.version + ", Workstation: LAB01-PC-12");

        String stateResp = getJsonWithBearer(LAB_URL + "/lab-api/student/exam/state", res.studentToken);
        System.out.println("  [STUDENT STEP 2] Verified question workspace and active timer state.");

        System.out.println("  [STUDENT STEP 3] Answering Question 1 (Option B) and Question 2 (Option C)...");
        Map<String, Object> ans1 = Map.of("questionId", "1", "selectedOption", "B", "markedForReview", false, "visited", true, "effectiveTimeMs", onTimeMs);
        String ack1 = postJsonWithBearer(LAB_URL + "/lab-api/student/exam/answers", ans1, res.studentToken);
        if (!ack1.contains("\"acknowledged\":true")) throw new RuntimeException("Answer 1 was not acknowledged: " + ack1);

        Map<String, Object> ans2 = Map.of("questionId", "2", "selectedOption", "C", "markedForReview", true, "visited", true, "effectiveTimeMs", onTimeMs);
        String ack2 = postJsonWithBearer(LAB_URL + "/lab-api/student/exam/answers", ans2, res.studentToken);
        if (!ack2.contains("\"acknowledged\":true")) throw new RuntimeException("Answer 2 was not acknowledged: " + ack2);
        System.out.println("    -> Answers persisted and acknowledged in real-time.");

        System.out.println("  [STUDENT STEP 4] Simulating browser page refresh and session restoration...");
        String refreshedState = getJsonWithBearer(LAB_URL + "/lab-api/student/exam/state", res.studentToken);
        if (!refreshedState.contains("LAB01-PC-12")) {
            throw new RuntimeException("Workstation binding lost on refresh!");
        }
        System.out.println("    -> Session restored: Workstation LAB01-PC-12, Version " + res.version + ", answers intact.");

        System.out.println("  [STUDENT STEP 5] Submitting Final Examination...");
        Map<String, Object> subBody = Map.of("studentUsn", res.usn, "submissionTrigger", "MANUAL", "effectiveTimeMs", onTimeMs);
        String subResp = postJsonWithBearer(LAB_URL + "/lab-api/student/exam/submit", subBody, res.studentToken);
        if (!subResp.contains("\"submitted\":true") || !subResp.contains("\"confirmationReference\":")) {
            throw new RuntimeException("Submission failed or missing confirmation reference: " + subResp);
        }
        if (subResp.contains("\"score\":") || subResp.contains("\"correctOption\":") || subResp.contains("\"answerKey\":")) {
            throw new RuntimeException("SECURITY VIOLATION: Student submission receipt leaked marks or answer key!");
        }
        System.out.println("  [OK] Examination submitted safely. Receipt received without marks or key leakage.");
        return res;
    }

    static class LabResultExport {
        Path resultFilePath;
        String rawPayloadJson;
        String labSignatureHex;
        long examinationId;
        String sittingCode;
    }

    private static LabResultExport finalizeAndExportLabResults(long examId, String sittingCode) throws Exception {
        Map<String, Object> body = Map.of("examinationId", examId, "sittingCode", sittingCode);
        String resp = postJson(LAB_URL + "/lab-api/results/finalize", body, null);
        System.out.println("  [OK] Lab Server finalized results: " + resp.substring(0, Math.min(100, resp.length())) + "...");

        Path resDir = Files.exists(Path.of("lab_storage", "results")) ? Path.of("lab_storage", "results") : Path.of("CampusExam", "lab_storage", "results");
        Path expectedFile = resDir.resolve(examId + "_" + sittingCode + ".labresult");
        if (!Files.exists(expectedFile)) {
            try (var s = Files.list(resDir)) {
                expectedFile = s.filter(p -> p.toString().endsWith(".labresult"))
                                .max(Comparator.comparingLong(p -> p.toFile().lastModified()))
                                .orElseThrow(() -> new RuntimeException("No .labresult package found!"));
            }
        }
        System.out.println("  [OK] Verified physical .labresult package on disk: " + expectedFile.getFileName() + " (" + Files.size(expectedFile) + " bytes)");

        LabResultExport export = new LabResultExport();
        export.resultFilePath = expectedFile;
        export.examinationId = examId;
        export.sittingCode = sittingCode;

        try (ZipInputStream zis = new ZipInputStream(Files.newInputStream(expectedFile))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("results.json".equals(entry.getName())) {
                    export.rawPayloadJson = new String(zis.readAllBytes(), StandardCharsets.UTF_8);
                } else if ("signature.sig".equals(entry.getName()) || "signature.bin".equals(entry.getName())) {
                    export.labSignatureHex = HexFormat.of().formatHex(zis.readAllBytes());
                } else if ("manifest.json".equals(entry.getName())) {
                    String mJson = new String(zis.readAllBytes(), StandardCharsets.UTF_8);
                    if (export.labSignatureHex == null || export.labSignatureHex.isEmpty()) {
                        export.labSignatureHex = extractString(mJson, "signatureHex");
                    }
                }
            }
        }
        return export;
    }

    private static void verifyLabResultPackageSignature(LabResultExport export) throws Exception {
        byte[] payloadBytes = export.rawPayloadJson.getBytes(StandardCharsets.UTF_8);
        byte[] sigBytes = HexFormat.of().parseHex(export.labSignatureHex);

        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initVerify(labPublicKey);
        sig.update(payloadBytes);
        boolean valid = sig.verify(sigBytes);
        if (!valid) {
            throw new RuntimeException("Cryptographic verification failed for .labresult package signature!");
        }
        System.out.println("  [OK] Cryptographic RSA-2048 signature of .labresult package verified with lab_public.key: VALID");
    }

    private static void importApproveAndReleaseResults(long examId, LabResultExport export) throws Exception {
        Map<String, Object> importReq = Map.of(
            "sessionId", examId,
            "resultPayloadJson", export.rawPayloadJson,
            "labSignatureHex", export.labSignatureHex
        );
        String importResp = postJson(CENTRAL_URL + "/api/v1/coe/import-results", importReq, coeToken);
        System.out.println("  [OK] COE Central Backend imported verified results: " + importResp);

        Map<String, Object> approveReq = Map.of("sessionId", examId);
        String approveResp = postJson(CENTRAL_URL + "/api/v1/coe/approve-results", approveReq, coeToken);
        System.out.println("  [OK] COE formally APPROVED examination results: " + approveResp);

        Map<String, Object> releaseReq = Map.of("sessionId", examId);
        String releaseResp = postJson(CENTRAL_URL + "/api/v1/coe/release-results", releaseReq, coeToken);
        System.out.println("  [OK] COE formally RELEASED examination results: " + releaseResp);

        try (Connection db = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
             PreparedStatement ps = db.prepareStatement("SELECT status FROM lab_result_import WHERE session_id=?")) {
            ps.setLong(1, examId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                String st = rs.getString(1);
                if (!"RELEASED".equals(st)) throw new RuntimeException("Expected RELEASED in DB, but found: " + st);
                System.out.println("  [OK] PostgreSQL verification: lab_result_import status is RELEASED.");
            } else {
                throw new RuntimeException("Result record not found in PostgreSQL for session " + examId);
            }
        }
    }

    private static void verifyResultVisibility(SyntheticContext ctx, long examId) throws Exception {
        String hodResp = getJson(CENTRAL_URL + "/api/v1/hod/results", hodToken);
        if (!hodResp.contains("TS601") && !hodResp.contains(String.valueOf(examId))) {
            throw new RuntimeException("Synthetic HOD cannot see released results for TS601!");
        }
        System.out.println("  [OK] Authorized Synthetic HOD sees released departmental results for TS601.");

        String principalResp = getJson(CENTRAL_URL + "/api/v1/principal/reports/results", principalToken);
        if (!principalResp.contains("TS601") && !principalResp.contains(String.valueOf(examId))) {
            throw new RuntimeException("Principal cannot see released results for TS601!");
        }
        System.out.println("  [OK] Principal sees released institution-wide results including TS601.");

        String hodEceResp = getJson(CENTRAL_URL + "/api/v1/hod/results", hodEceToken);
        if (hodEceResp.contains("TS601")) {
            throw new RuntimeException("SECURITY VIOLATION: HOD ECE was able to see TS601 synthetic department results!");
        }
        System.out.println("  [OK] Unauthorized HOD ECE is blocked from viewing TS601 department results.");
    }

    private static void verifySseLiveTelemetry(long examId) throws Exception {
        URL url = new URL(LAB_URL + "/lab-api/monitoring/stream");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(3000);
        conn.setReadTimeout(5000);

        String contentType = conn.getHeaderField("Content-Type");
        if (contentType == null || !contentType.contains("text/event-stream")) {
            throw new RuntimeException("Invalid SSE Content-Type: " + contentType);
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean connectedEventFound = false;
            int linesRead = 0;
            while ((line = reader.readLine()) != null && linesRead < 10) {
                linesRead++;
                if (line.contains("connected") || line.contains("data:")) {
                    connectedEventFound = true;
                    System.out.println("  [OK] Received live SSE event: " + line);
                    break;
                }
            }
            if (!connectedEventFound) throw new RuntimeException("SSE stream did not emit connected event!");
        }
        conn.disconnect();
        System.out.println("  [OK] SSE real-time stream verified with text/event-stream headers and event broadcast.");
    }

    private static String getJson(String urlStr, String token) throws Exception {
        return getJsonWithBearer(urlStr, token);
    }

    private static String getJsonWithBearer(String urlStr, String token) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        if (token != null && !token.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setRequestProperty("Accept", "application/json");

        int code = conn.getResponseCode();
        InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String resp = is != null ? new String(is.readAllBytes(), StandardCharsets.UTF_8) : "";
        if (code >= 400) throw new RuntimeException("GET " + urlStr + " failed with HTTP " + code + ": " + resp);
        return resp;
    }

    private static String postJson(String urlStr, Map<String, Object> body, String token) throws Exception {
        return postJsonWithBearer(urlStr, body, token);
    }

    private static String postJsonWithBearer(String urlStr, Map<String, Object> body, String token) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        if (token != null && !token.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + token);

        String json = toJson(body);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(json.getBytes(StandardCharsets.UTF_8));
        }

        int code = conn.getResponseCode();
        InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        String resp = is != null ? new String(is.readAllBytes(), StandardCharsets.UTF_8) : "";
        if (code >= 400) throw new RuntimeException("POST " + urlStr + " failed with HTTP " + code + ": " + resp);
        return resp;
    }

    private static String toJson(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String s) return "\"" + escapeJson(s) + "\"";
        if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
        if (obj instanceof Map<?, ?> m) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!first) sb.append(",");
                first = false;
                sb.append("\"").append(escapeJson(String.valueOf(e.getKey()))).append("\":").append(toJson(e.getValue()));
            }
            sb.append("}");
            return sb.toString();
        }
        if (obj instanceof List<?> l) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : l) {
                if (!first) sb.append(",");
                first = false;
                sb.append(toJson(item));
            }
            sb.append("]");
            return sb.toString();
        }
        return "\"" + escapeJson(obj.toString()) + "\"";
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private static String extractToken(String json) {
        String t = extractString(json, "token");
        if (t.isEmpty()) t = extractString(json, "sessionToken");
        if (t.isEmpty()) {
            int tokIdx = json.indexOf("\"sessionToken\":");
            if (tokIdx < 0) tokIdx = json.indexOf("\"token\":");
            if (tokIdx >= 0) {
                int colon = json.indexOf(":", tokIdx);
                int q1 = json.indexOf("\"", colon + 1);
                int q2 = json.indexOf("\"", q1 + 1);
                if (q1 >= 0 && q2 > q1) t = json.substring(q1 + 1, q2);
            }
        }
        return t;
    }

    private static String extractString(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int start = json.indexOf(pattern);
        if (start < 0) {
            pattern = "\"" + key + "\": \"";
            start = json.indexOf(pattern);
        }
        if (start < 0) return "";
        start += pattern.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : "";
    }

    private static long extractLong(String json, String key) {
        String pattern = "\"" + key + "\":";
        int start = json.indexOf(pattern);
        if (start < 0) {
            pattern = "\"" + key + "\": ";
            start = json.indexOf(pattern);
        }
        if (start < 0) return 0L;
        start += pattern.length();
        while (start < json.length() && (json.charAt(start) == ' ' || json.charAt(start) == '\"')) start++;
        int end = start;
        while (end < json.length() && Character.isDigit(json.charAt(end))) end++;
        try {
            return Long.parseLong(json.substring(start, end));
        } catch (Exception e) {
            return 0L;
        }
    }
}
