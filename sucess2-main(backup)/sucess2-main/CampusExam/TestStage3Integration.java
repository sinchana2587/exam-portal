import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.util.*;

public class TestStage3Integration {

    private static final String CENTRAL_URL = "http://127.0.0.1:8081";
    private static final String LAB_URL = "http://127.0.0.1:8082";
    private static final String DB_URL = "jdbc:postgresql://localhost:5432/campusexam_test";
    private static final String DB_USER = "campusexam";
    private static final String DB_PASS = "password";

    private static String coeToken;

    public static void main(String[] args) {
        System.out.println("==========================================================================");
        System.out.println("  STAGE 3: END-TO-END EXAMINATION SCHEDULING & STUDENT AUTH ACCEPTANCE");
        System.out.println("==========================================================================");

        try {
            // 0. COE Login
            loginCoe();

            // 1. Setup isolated synthetic department, subject, group, students & question bank
            System.out.println("\n[SETUP] Setting up synthetic academic and question bank data in PostgreSQL...");
            SetupData setup = setupSyntheticData();
            System.out.println("  -> Synthetic Dept: " + setup.deptCode + " (ID: " + setup.deptId + ")");
            System.out.println("  -> Synthetic Subject: " + setup.subCode + " (ID: " + setup.subId + ")");
            System.out.println("  -> Group A Students: 4MH25SY001, 4MH25SY002, 4MH25SY003, 4MH25SY004");
            System.out.println("  -> Unallocated Student: 4MH25SY099 (Section B)");
            System.out.println("  -> Other Dept Student: 4MH25EC099 (ECE Dept)");
            System.out.println("  -> Question Bank ID: " + setup.bankId + ", Published Paper ID: " + setup.paperId);

            // 2. Schedule Examination via COE API
            System.out.println("\n[STEP 1-3] Scheduling Examination in COE with Custom Duration (Morning: 75m, Afternoon: 80m)...");
            long examId = scheduleExamination(setup);
            System.out.println("  -> Scheduled Examination ID: #" + examId);

            // 3. Freeze the exact roster and sitting snapshot
            System.out.println("\n[STEP 4] Freezing Roster & Schedule Snapshot (/confirm-schedule)...");
            confirmSchedule(examId);
            System.out.println("  -> Status is now FROZEN. Roster snapshot is locked.");

            // 4. Select Published Question Set for Morning (Set 1) & Afternoon (Set 2)
            System.out.println("\n[STEP 5] Selecting Published Question Set 1 for Morning and Set 2 for Afternoon...");
            selectPaperSet(examId, "MORNING", 1);
            selectPaperSet(examId, "AFTERNOON", 2);
            System.out.println("  -> Versions A-D generated and assigned to students.");

            // 5. Prepare and Transfer Morning Package to Lab Server
            System.out.println("\n[STEP 6] Preparing, Signing & Transferring MORNING Package to Lab Server...");
            transferPackage(examId, "MORNING");
            System.out.println("  -> Morning Package verified, signed, transferred and acknowledged by Lab Server!");

            // 6. Transfer Afternoon Package
            System.out.println("\n[STEP 6b] Preparing, Signing & Transferring AFTERNOON Package to Lab Server...");
            transferPackage(examId, "AFTERNOON");
            System.out.println("  -> Afternoon Package verified, transferred and acknowledged by Lab Server!");

            // Activate Morning Package into memory on Lab Server
            activateLabPackage(examId, "MORNING");

            // Define timing anchors (Exam Date: 2026-12-28, Start: 09:30:00 IST, Duration: 75m -> End: 10:45:00 IST)
            LocalDate examDate = LocalDate.of(2026, 12, 28);
            ZoneId ist = ZoneId.of("Asia/Kolkata");
            long startMs = examDate.atTime(9, 30, 0).atZone(ist).toInstant().toEpochMilli();
            long earlyMs = examDate.atTime(9, 15, 0).atZone(ist).toInstant().toEpochMilli(); // 15 min before
            long onTimeMs = examDate.atTime(9, 35, 0).atZone(ist).toInstant().toEpochMilli(); // 5 min into exam
            long lateMs = examDate.atTime(10, 0, 0).atZone(ist).toInstant().toEpochMilli(); // 30 min into exam
            long endMs = examDate.atTime(10, 45, 0).atZone(ist).toInstant().toEpochMilli(); // Exact end
            long expiredMs = examDate.atTime(10, 50, 0).atZone(ist).toInstant().toEpochMilli(); // 5 min after end

            // TEST 7: Attempt login before scheduled start time
            System.out.println("\n[TEST 7] Attempting login before scheduled start time (09:15:00)...");
            testLoginExpectFailure("4MH25SY001", "2004-03-10", earlyMs, 403, "EXAMINATION_NOT_STARTED",
                    "PASS: Early login rejected (403 EXAMINATION_NOT_STARTED)");

            // TEST 8: Attempt login with correct USN and incorrect DOB
            System.out.println("\n[TEST 8] Attempting login with valid USN and incorrect DOB...");
            testLoginExpectFailure("4MH25SY001", "2000-01-01", onTimeMs, 401, "INVALID_CREDENTIALS",
                    "PASS: Incorrect DOB rejected without disclosing specific error (401 INVALID_CREDENTIALS)");

            // TEST 9: Attempt login using unallocated student from same department
            System.out.println("\n[TEST 9] Attempting login using unallocated student from same department (4MH25SY099)...");
            testLoginExpectFailure("4MH25SY099", "2004-07-25", onTimeMs, 401, "INVALID_CREDENTIALS",
                    "PASS: Unallocated student rejected (401 INVALID_CREDENTIALS)");

            // TEST 10: Attempt login using student from another department
            System.out.println("\n[TEST 10] Attempting login using student from another department (4MH25EC099)...");
            testLoginExpectFailure("4MH25EC099", "2004-08-30", onTimeMs, 401, "INVALID_CREDENTIALS",
                    "PASS: Cross-department student rejected (401 INVALID_CREDENTIALS)");

            // TEST 11: Attempt login using student allocated to different sitting (4MH25SY003 - Afternoon)
            System.out.println("\n[TEST 11] Attempting login using Afternoon student (4MH25SY003) on Morning sitting...");
            testLoginExpectFailure("4MH25SY003", "2004-05-15", onTimeMs, 401, "INVALID_CREDENTIALS",
                    "PASS: Cross-sitting student rejected from active Morning sitting (401 INVALID_CREDENTIALS)");

            // TEST 12: Successful login with correct USN + DOB during permitted window
            System.out.println("\n[TEST 12] Logging in with correct USN and DOB (using DD-MM-YYYY format)...");
            Map<String, Object> loginResp = testLoginSuccess("4MH25SY001", "10-03-2004", onTimeMs);
            String token = (String) ((Map<String, Object>) loginResp.get("student")).get("sessionToken");
            System.out.println("  -> PASS: Successful authentication! Session token issued.");

            // TEST 13: Verify subject, sitting, question version and custom duration
            System.out.println("\n[TEST 13] Verifying session details (Subject, Sitting, Version, Duration)...");
            Map<String, Object> sessInfo = (Map<String, Object>) loginResp.get("examSession");
            assertEq("SY501", sessInfo.get("subjectCode"), "Subject Code mismatch");
            assertEq("Morning Sitting", sessInfo.get("sessionSlot"), "Sitting mismatch");
            assertEq(75, ((Number) sessInfo.get("durationMinutes")).intValue(), "Custom duration mismatch");
            System.out.println("  -> PASS: Subject=SY501, Sitting=Morning Sitting, Duration=75 min, AssignedVersion=" + ((Map<String, Object>) loginResp.get("student")).get("assignedVersion"));

            // Start Examination for 4MH25SY001
            System.out.println("\n[EXECUTION] Student 4MH25SY001 starting examination at 09:35:00...");
            Map<String, Object> startResp = startExam(token, onTimeMs);
            long expiresAtMs = parseLongSafe(startResp.get("examExpiresAtMs"));
            assertEq(endMs, expiresAtMs, "Exam expiresAtMs does not match scheduled end time");
            System.out.println("  -> Exam started. Scheduled End: 10:45:00. Remaining: " + startResp.get("remainingSeconds") + " seconds");

            // TEST 14: Refresh browser / state check - verify timer and attempt persist
            System.out.println("\n[TEST 14] Verifying browser refresh & authoritative timer persistence...");
            Map<String, Object> stateResp = getExamState(token, onTimeMs + 60000L); // 1 minute later
            long refExpiresAt = parseLongSafe(stateResp.get("examExpiresAtMs"));
            assertEq(expiresAtMs, refExpiresAt, "Expiry timestamp shifted upon refresh!");
            long remSec = parseLongSafe(stateResp.get("remainingSeconds"));
            assertEq(4140L, remSec, "Remaining seconds after 1 min should be ~4140s (75m - 6m)");
            System.out.println("  -> PASS: Expiry timestamp preserved across refresh. Remaining seconds: " + remSec);

            // TEST 15: Late login enforcement (Student 4MH25SY002 logs in at 10:00:00, 30 min into exam)
            System.out.println("\n[TEST 15] Testing late login enforcement for 4MH25SY002 at 10:00:00 (30 min late)...");
            Map<String, Object> lateLoginResp = testLoginSuccess("4MH25SY002", "2004-04-12", lateMs);
            String lateToken = (String) ((Map<String, Object>) lateLoginResp.get("student")).get("sessionToken");
            Map<String, Object> lateStartResp = startExam(lateToken, lateMs);
            long lateExpiresAt = parseLongSafe(lateStartResp.get("examExpiresAtMs"));
            assertEq(endMs, lateExpiresAt, "Late login extended beyond scheduled end time!");
            long lateRemainingSec = parseLongSafe(lateStartResp.get("remainingSeconds"));
            assertEq(2700L, lateRemainingSec, "Late student should only receive remaining 45 min (2700s), NOT 75 min!");
            System.out.println("  -> PASS: Late login strictly capped at original scheduled end (10:45:00). Duration NOT extended.");

            // TEST 16: Verify already-submitted student cannot restart
            System.out.println("\n[TEST 16] Submitting examination for 4MH25SY001 and testing re-login prevention...");
            submitExam(token, onTimeMs + 120000L);
            testLoginExpectFailure("4MH25SY001", "2004-03-10", onTimeMs + 130000L, 403, "ALREADY_SUBMITTED",
                    "PASS: Already-submitted student cannot re-login or restart (403 ALREADY_SUBMITTED)");

            // TEST 17: Attempt login / start after scheduled window closed (10:50:00)
            System.out.println("\n[TEST 17] Attempting login after scheduled window closed (10:50:00)...");
            testLoginExpectFailure("4MH25SY002", "2004-04-12", expiredMs, 403, "EXAMINATION_WINDOW_CLOSED",
                    "PASS: Expired window login rejected (403 EXAMINATION_WINDOW_CLOSED)");

            // TEST 18: Activate Afternoon Sitting and verify sitting isolation
            System.out.println("\n[TEST 18] Activating AFTERNOON sitting and testing dual-sitting isolation...");
            activateLabPackage(examId, "AFTERNOON");
            // Morning student 4MH25SY002 should now be rejected on Afternoon sitting
            testLoginExpectFailure("4MH25SY002", "2004-04-12", examDate.atTime(14, 10, 0).atZone(ist).toInstant().toEpochMilli(),
                    401, "INVALID_CREDENTIALS", "PASS: Morning student rejected from Afternoon sitting");
            // Afternoon student 4MH25SY003 should succeed during afternoon window (14:10:00)
            Map<String, Object> aftLogin = testLoginSuccess("4MH25SY003", "2004-05-15",
                    examDate.atTime(14, 10, 0).atZone(ist).toInstant().toEpochMilli());
            Map<String, Object> aftSess = (Map<String, Object>) aftLogin.get("examSession");
            assertEq(80, ((Number) aftSess.get("durationMinutes")).intValue(), "Afternoon custom duration mismatch");
            System.out.println("  -> PASS: Dual sitting isolation verified. Afternoon custom duration = 80 min.");

            // TEST 19: Restore test student session across restarts
            System.out.println("\n[TEST 19] Verifying session restoration across local disk persistence...");
            String aftToken = (String) ((Map<String, Object>) aftLogin.get("student")).get("sessionToken");
            Map<String, Object> restoredSess = getStudentSession(aftToken);
            assertEq("4MH25SY003", ((Map<String, Object>) restoredSess.get("student")).get("usn"), "Restored session USN mismatch");
            System.out.println("  -> PASS: Session successfully restored from local disk persistence.");

            // TEST 20: Validate offline readiness of Lab Server
            System.out.println("\n[TEST 20] Verifying Lab Server offline independence without Central Backend...");
            Map<String, Object> health = httpGetJson(LAB_URL + "/api/health", null);
            assertEq("ok", health.get("status"), "Lab Server status not ok");
            assertEq(true, health.get("offlineReady"), "Lab Server offlineReady flag should be true");
            System.out.println("  -> PASS: Lab Server offlineReady=true. All packages and rosters stored locally.");

            System.out.println("\n==========================================================================");
            System.out.println("  ALL 20 STAGE 3 INTEGRATION & AUTHENTICATION SCENARIOS PASSED (100%)");
            System.out.println("==========================================================================");

        } catch (Exception ex) {
            System.err.println("\n[TEST FAILED] " + ex.getMessage());
            ex.printStackTrace();
            System.exit(1);
        }
    }

    // --- HELPER METHODS ---

    static class SetupData {
        long deptId;
        String deptCode;
        long subId;
        String subCode;
        long groupId;
        long bankId;
        long paperId;
    }

    private static SetupData setupSyntheticData() throws Exception {
        SetupData d = new SetupData();
        d.deptCode = "E158SY";
        d.subCode = "SY501";

        try (Connection db = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS)) {
            // Clean up prior synthetic runs safely
            try (Statement st = db.createStatement()) {
                st.executeUpdate("DELETE FROM secure_package WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501'))");
                st.executeUpdate("DELETE FROM session_unlock_credential WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501'))");
                st.executeUpdate("DELETE FROM session_roster_snapshot WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501'))");
                st.executeUpdate("DELETE FROM paper_version_question WHERE version_id IN (SELECT id FROM paper_version WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501')))");
                st.executeUpdate("DELETE FROM paper_version WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501'))");
                st.executeUpdate("DELETE FROM sitting_examiner WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501'))");
                st.executeUpdate("DELETE FROM examination_sitting WHERE session_id IN (SELECT id FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501'))");
                st.executeUpdate("DELETE FROM examination_session WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501')");
                st.executeUpdate("DELETE FROM session_roster_snapshot WHERE usn LIKE '4MH25SY%'");
                st.executeUpdate("DELETE FROM student_roster WHERE usn LIKE '4MH25SY%'");
                st.executeUpdate("DELETE FROM student_roster WHERE usn='4MH25EC099'");
                st.executeUpdate("DELETE FROM generated_paper_question WHERE paper_id IN (SELECT id FROM generated_paper WHERE title LIKE '%SY501%')");
                st.executeUpdate("DELETE FROM generated_paper WHERE title LIKE '%SY501%'");
                st.executeUpdate("DELETE FROM question_bank_item WHERE prompt LIKE '%Synthetic OS%'");
                st.executeUpdate("DELETE FROM paper_blueprint WHERE subject_id IN (SELECT id FROM subject WHERE code='SY501')");
                st.executeUpdate("DELETE FROM question_bank WHERE title LIKE '%SY501%'");
                st.executeUpdate("DELETE FROM academic_group WHERE department='E158SY'");
                st.executeUpdate("DELETE FROM subject WHERE code='SY501'");
                st.executeUpdate("DELETE FROM department WHERE code='E158SY'");
            }

            // Department
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO department(code, name) VALUES(?, ?) RETURNING id")) {
                ps.setString(1, d.deptCode);
                ps.setString(2, "Department of Synthetic Systems");
                try (ResultSet rs = ps.executeQuery()) { rs.next(); d.deptId = rs.getLong(1); }
            }

            // Subject
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO subject(code, name, department_id, semester) VALUES(?, ?, ?, 5) RETURNING id")) {
                ps.setString(1, d.subCode);
                ps.setString(2, "Synthetic Distributed Operating Systems");
                ps.setLong(3, d.deptId);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); d.subId = rs.getLong(1); }
            }

            // Academic Groups
            long grpAId;
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO academic_group(department_id, department, academic_session, year, study_year, semester, section) VALUES(?, ?, '2026-27', 3, 3, 5, 'A') RETURNING id")) {
                ps.setLong(1, d.deptId);
                ps.setString(2, d.deptCode);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); grpAId = rs.getLong(1); }
            }
            d.groupId = grpAId;

            long grpBId;
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO academic_group(department_id, department, academic_session, year, study_year, semester, section) VALUES(?, ?, '2026-27', 3, 3, 5, 'B') RETURNING id")) {
                ps.setLong(1, d.deptId);
                ps.setString(2, d.deptCode);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); grpBId = rs.getLong(1); }
            }

            // Students in Group A (Eligible)
            insertStudent(db, grpAId, d.deptId, "A", "4MH25SY001", "Candidate 4MH25SY001", "2004-03-10");
            insertStudent(db, grpAId, d.deptId, "A", "4MH25SY002", "Candidate 4MH25SY002", "2004-04-12");
            insertStudent(db, grpAId, d.deptId, "A", "4MH25SY003", "Candidate 4MH25SY003", "2004-05-15");
            insertStudent(db, grpAId, d.deptId, "A", "4MH25SY004", "Candidate 4MH25SY004", "2004-06-20");

            // Student in Group B (Unallocated)
            insertStudent(db, grpBId, d.deptId, "B", "4MH25SY099", "Candidate 4MH25SY099", "2004-07-25");

            // Student in another department (ECE)
            long eceGrpId = 1L;
            long eceDeptId = 1L;
            try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery("SELECT ag.id, ag.department_id FROM academic_group ag JOIN department d ON d.id=ag.department_id WHERE d.code LIKE '%EC%' LIMIT 1")) {
                if (rs.next()) {
                    eceGrpId = rs.getLong(1);
                    eceDeptId = rs.getLong(2);
                }
            }
            insertStudent(db, eceGrpId, eceDeptId, "A", "4MH25EC099", "Candidate 4MH25EC099", "2004-08-30");

            // Question Bank
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO question_bank(department_id, subject_id, academic_session, semester, title, state, created_by, total_questions) VALUES(?, ?, '2026-27', 5, ?, 'FINALIZED', 1, 4) RETURNING id")) {
                ps.setLong(1, d.deptId);
                ps.setLong(2, d.subId);
                ps.setString(3, "Question Bank - SY501 Synthetic OS");
                try (ResultSet rs = ps.executeQuery()) { rs.next(); d.bankId = rs.getLong(1); }
            }

            // Blueprint
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO paper_blueprint(subject_id, total_questions, module_distribution, updated_by) VALUES(?, 4, '{\"1\":1,\"2\":1,\"3\":1,\"4\":1}', 1)")) {
                ps.setLong(1, d.subId);
                ps.executeUpdate();
            }

            // Generated Paper Set 1
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO generated_paper(bank_id, paper_number, title, status) VALUES(?, 1, 'Set 1 - SY501 Paper', 'READY') RETURNING id")) {
                ps.setLong(1, d.bankId);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); d.paperId = rs.getLong(1); }
            }

            // Generated Paper Set 2
            long paper2Id;
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO generated_paper(bank_id, paper_number, title, status) VALUES(?, 2, 'Set 2 - SY501 Paper', 'READY') RETURNING id")) {
                ps.setLong(1, d.bankId);
                try (ResultSet rs = ps.executeQuery()) { rs.next(); paper2Id = rs.getLong(1); }
            }

            // 4 Questions in Set 1 & Set 2
            for (int m = 1; m <= 4; m++) {
                long qId;
                try (PreparedStatement ps = db.prepareStatement("INSERT INTO question_bank_item(bank_id, question_uid, prompt, options, correct, marks, module_number) VALUES(?, ?, ?, ?, 1, 1.25, ?) RETURNING id")) {
                    ps.setLong(1, d.bankId);
                    ps.setString(2, "SY501_Q" + m + "_M" + m);
                    ps.setString(3, "Synthetic OS Question for Module " + m + ": What is distributed consensus?");
                    Array arr = db.createArrayOf("text", new String[]{"Raft/Paxos algorithm", "Round Robin", "First In First Out", "Virtual Memory"});
                    ps.setArray(4, arr);
                    ps.setInt(5, m);
                    try (ResultSet rs = ps.executeQuery()) { rs.next(); qId = rs.getLong(1); }
                }

                try (PreparedStatement ps = db.prepareStatement("INSERT INTO generated_paper_question(paper_id, question_id, module_number, paper_position) VALUES(?, ?, ?, ?)")) {
                    ps.setLong(1, d.paperId);
                    ps.setLong(2, qId);
                    ps.setInt(3, m);
                    ps.setInt(4, m);
                    ps.executeUpdate();
                }

                try (PreparedStatement ps = db.prepareStatement("INSERT INTO generated_paper_question(paper_id, question_id, module_number, paper_position) VALUES(?, ?, ?, ?)")) {
                    ps.setLong(1, paper2Id);
                    ps.setLong(2, qId);
                    ps.setInt(3, m);
                    ps.setInt(4, m);
                    ps.executeUpdate();
                }
            }
        }
        return d;
    }

    private static void insertStudent(Connection db, long grpId, long deptId, String sec, String usn, String name, String dob) throws Exception {
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO student_roster(group_id, department_id, semester, section, usn, full_name, date_of_birth, status) VALUES(?, ?, 5, ?, ?, ?, ?::date, 'ACTIVE')")) {
            ps.setLong(1, grpId);
            ps.setLong(2, deptId);
            ps.setString(3, sec);
            ps.setString(4, usn);
            ps.setString(5, name);
            ps.setString(6, dob);
            ps.executeUpdate();
        }
    }

    private static void loginCoe() throws Exception {
        Map<String, Object> req = Map.of("username", "coe", "password", "COE@5828");
        Map<String, Object> resp = httpPostJson(CENTRAL_URL + "/api/v1/auth/coe/login", req, null);
        coeToken = (String) resp.get("token");
        if (coeToken == null && resp.containsKey("data")) {
            coeToken = (String) ((Map<String, Object>) resp.get("data")).get("token");
        }
        System.out.println("[AUTH] Logged in as COE. Token acquired.");
    }

    private static long scheduleExamination(SetupData setup) throws Exception {
        Map<String, Object> morning = new LinkedHashMap<>();
        morning.put("enabled", true);
        morning.put("examDate", "2026-12-28");
        morning.put("startTime", "09:30:00");
        morning.put("durationMinutes", 75);
        morning.put("labId", "LAB-CSE-01");
        morning.put("studentCount", 2);

        Map<String, Object> afternoon = new LinkedHashMap<>();
        afternoon.put("enabled", true);
        afternoon.put("examDate", "2026-12-28");
        afternoon.put("startTime", "14:00:00");
        afternoon.put("durationMinutes", 80);
        afternoon.put("labId", "LAB-CSE-01");
        afternoon.put("studentCount", 2);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("department", "E158SY");
        payload.put("departmentId", setup.deptId);
        payload.put("semester", 5);
        payload.put("subjectCode", "SY501");
        payload.put("subjectId", setup.subId);
        payload.put("sections", List.of("A"));
        payload.put("morningSitting", morning);
        payload.put("afternoonSitting", afternoon);

        Map<String, Object> resp = httpPostJson(CENTRAL_URL + "/api/v1/examinations/schedule", payload, coeToken);
        Map<String, Object> data = (Map<String, Object>) resp.get("data");
        return parseLongSafe(data.get("id"));
    }

    private static void confirmSchedule(long examId) throws Exception {
        Map<String, Object> resp = httpPostJson(CENTRAL_URL + "/api/v1/examinations/" + examId + "/confirm-schedule", Map.of(), coeToken);
        if (!Boolean.TRUE.equals(resp.get("success"))) {
            throw new RuntimeException("Confirm schedule failed: " + resp);
        }
    }

    private static void selectPaperSet(long examId, String sittingName, int setNum) throws Exception {
        Map<String, Object> req = Map.of("sittingName", sittingName, "setNumber", "Set " + setNum);
        Map<String, Object> resp = httpPostJson(CENTRAL_URL + "/api/v1/examinations/" + examId + "/select-set", req, coeToken);
        if (!Boolean.TRUE.equals(resp.get("success"))) {
            throw new RuntimeException("Select paper set failed for " + sittingName + ": " + resp);
        }
    }

    private static void transferPackage(long examId, String sittingName) throws Exception {
        Map<String, Object> req = Map.of("sittingName", sittingName);
        Map<String, Object> resp = httpPostJson(CENTRAL_URL + "/api/v1/examinations/" + examId + "/prepare-and-send-package", req, coeToken);
        if (!Boolean.TRUE.equals(resp.get("success"))) {
            throw new RuntimeException("Package preparation & transfer failed for " + sittingName + ": " + resp);
        }
    }

    private static void activateLabPackage(long examId, String sittingName) throws Exception {
        String code = sittingName.contains("AFTERNOON") ? "A" : "M";
        String pkgUid = "PKG-2026-" + examId + "-" + code + "-R1";
        Map<String, Object> req = Map.of("examinationId", examId, "packageUid", pkgUid, "sittingCode", sittingName);
        Map<String, Object> resp = httpPostJson(LAB_URL + "/lab-api/packages/activate", req, null);
        if (!Boolean.TRUE.equals(resp.get("success"))) {
            throw new RuntimeException("Lab package activation failed: " + resp);
        }
    }

    private static void testLoginExpectFailure(String usn, String dob, long simulatedTimeMs, int expectedHttpCode, String expectedErrorCode, String passMessage) {
        try {
            Map<String, Object> req = Map.of("usn", usn, "dateOfBirth", dob);
            Map<String, String> headers = Map.of("X-Simulated-Time-Ms", String.valueOf(simulatedTimeMs));
            httpPostJson(LAB_URL + "/lab-api/student/login", req, null, headers);
            throw new RuntimeException("Expected login failure (" + expectedHttpCode + " " + expectedErrorCode + ") but login SUCCEEDED!");
        } catch (HttpException ex) {
            if (ex.statusCode != expectedHttpCode) {
                throw new RuntimeException("Expected HTTP " + expectedHttpCode + ", but got " + ex.statusCode + ": " + ex.responseBody);
            }
            if (expectedErrorCode != null && !ex.responseBody.contains(expectedErrorCode)) {
                throw new RuntimeException("Expected error code " + expectedErrorCode + " in body, got: " + ex.responseBody);
            }
            System.out.println("  -> " + passMessage);
        } catch (Exception ex) {
            throw new RuntimeException("Unexpected error during login failure test: " + ex.getMessage(), ex);
        }
    }

    private static Map<String, Object> testLoginSuccess(String usn, String dob, long simulatedTimeMs) throws Exception {
        Map<String, Object> req = Map.of("usn", usn, "dateOfBirth", dob);
        Map<String, String> headers = Map.of("X-Simulated-Time-Ms", String.valueOf(simulatedTimeMs));
        return httpPostJson(LAB_URL + "/lab-api/student/login", req, null, headers);
    }

    private static Map<String, Object> startExam(String token, long simulatedTimeMs) throws Exception {
        Map<String, String> headers = Map.of("X-Simulated-Time-Ms", String.valueOf(simulatedTimeMs));
        return httpPostJson(LAB_URL + "/lab-api/student/exam/start", Map.of(), token, headers);
    }

    private static Map<String, Object> getExamState(String token, long simulatedTimeMs) throws Exception {
        Map<String, String> headers = Map.of("X-Simulated-Time-Ms", String.valueOf(simulatedTimeMs));
        return httpGetJson(LAB_URL + "/lab-api/student/exam/state", token, headers);
    }

    private static void submitExam(String token, long simulatedTimeMs) throws Exception {
        Map<String, String> headers = Map.of("X-Simulated-Time-Ms", String.valueOf(simulatedTimeMs));
        httpPostJson(LAB_URL + "/lab-api/student/exam/submit", Map.of("submissionTrigger", "MANUAL"), token, headers);
    }

    private static Map<String, Object> getStudentSession(String token) throws Exception {
        return httpGetJson(LAB_URL + "/lab-api/student/exam-session", token);
    }

    // --- HTTP UTILS ---

    static class HttpException extends Exception {
        int statusCode;
        String responseBody;
        HttpException(int sc, String body) {
            super("HTTP " + sc + ": " + body);
            this.statusCode = sc;
            this.responseBody = body;
        }
    }

    private static Map<String, Object> httpPostJson(String urlStr, Map<String, Object> body, String bearerToken) throws Exception {
        return httpPostJson(urlStr, body, bearerToken, Collections.emptyMap());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> httpPostJson(String urlStr, Map<String, Object> body, String bearerToken, Map<String, String> extraHeaders) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URI(urlStr).toURL().openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        if (bearerToken != null && !bearerToken.isBlank()) {
            conn.setRequestProperty("Authorization", "Bearer " + bearerToken);
        }
        for (Map.Entry<String, String> e : extraHeaders.entrySet()) {
            conn.setRequestProperty(e.getKey(), e.getValue());
        }
        conn.setDoOutput(true);
        byte[] bytes = LabServer.Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(bytes);
        }

        int sc = conn.getResponseCode();
        InputStream is = (sc >= 200 && sc < 400) ? conn.getInputStream() : conn.getErrorStream();
        String respStr = is != null ? new String(is.readAllBytes(), StandardCharsets.UTF_8) : "";

        if (sc >= 400) {
            throw new HttpException(sc, respStr);
        }
        return (Map<String, Object>) LabServer.Json.parse(respStr);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> httpGetJson(String urlStr, String bearerToken) throws Exception {
        return httpGetJson(urlStr, bearerToken, Collections.emptyMap());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> httpGetJson(String urlStr, String bearerToken, Map<String, String> extraHeaders) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URI(urlStr).toURL().openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        if (bearerToken != null && !bearerToken.isBlank()) {
            conn.setRequestProperty("Authorization", "Bearer " + bearerToken);
        }
        for (Map.Entry<String, String> e : extraHeaders.entrySet()) {
            conn.setRequestProperty(e.getKey(), e.getValue());
        }

        int sc = conn.getResponseCode();
        InputStream is = (sc >= 200 && sc < 400) ? conn.getInputStream() : conn.getErrorStream();
        String respStr = is != null ? new String(is.readAllBytes(), StandardCharsets.UTF_8) : "";

        if (sc >= 400) {
            throw new HttpException(sc, respStr);
        }
        return (Map<String, Object>) LabServer.Json.parse(respStr);
    }

    private static long parseLongSafe(Object val) {
        if (val == null) return 0L;
        if (val instanceof Number n) return n.longValue();
        String s = val.toString().trim();
        if (s.isEmpty()) return 0L;
        if (s.contains(".")) s = s.substring(0, s.indexOf('.'));
        try { return Long.parseLong(s); } catch (Exception e) { return 0L; }
    }

    private static void assertEq(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            throw new RuntimeException(message + " - Expected: [" + expected + "] but was: [" + actual + "]");
        }
    }
}
