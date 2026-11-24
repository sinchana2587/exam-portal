package com.campusexam.service;

import com.campusexam.security.RbacGuard;
import com.campusexam.security.UserSession;
import com.campusexam.util.HttpResponses;

import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Service handling HOD department-scoped operations:
 * - Department dashboard summary (enforcing full enrollment population & all 8 semesters)
 * - Subject academic master lifecycle (strictly bounded to HOD department scope)
 * - Zero physical deletion: subjects are soft-archived to protect historical examination integrity
 */
public class HodService {

    public HodService() {}

    /**
     * Retrieves the HOD department dashboard summary.
     * Enforces Final Business Rule #1: Total students reflects complete departmental enrolled population
     * from student_roster, not exam-specific rosters.
     */
    public Map<String, Object> getDashboard(Connection db, UserSession user, Long requestedDeptId) throws SQLException {
        RbacGuard.requireHod(user);
        // Authoritative department ID resolution
        long deptId = RbacGuard.enforceDepartmentScope(user, requestedDeptId);

        Map<String, Object> dashboard = new LinkedHashMap<>();

        // 1. Department metadata
        String deptSql = "SELECT id, code, name, status FROM department WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(deptSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    dashboard.put("departmentId", rs.getLong("id"));
                    dashboard.put("departmentCode", rs.getString("code"));
                    dashboard.put("departmentName", rs.getString("name"));
                    dashboard.put("departmentStatus", rs.getString("status"));
                }
            }
        }

        // 2. Complete enrolled student population for this department (Final Business Rule #1)
        long totalEnrolledStudents = 0;
        String studentSql = "SELECT count(*) FROM student_roster WHERE department_id = ?";
        try (PreparedStatement ps = db.prepareStatement(studentSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    totalEnrolledStudents = rs.getLong(1);
                }
            }
        }
        dashboard.put("totalStudents", totalEnrolledStudents);

        // 3. Semester-wise distribution across all 8 semesters (Final Business Rule #1)
        Map<Integer, Long> semesterBreakdown = new LinkedHashMap<>();
        for (int sem = 1; sem <= 8; sem++) {
            semesterBreakdown.put(sem, 0L);
        }
        String semSql = "SELECT semester, count(*) FROM student_roster WHERE department_id = ? GROUP BY semester";
        try (PreparedStatement ps = db.prepareStatement(semSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int sem = rs.getInt(1);
                    if (sem >= 1 && sem <= 8) {
                        semesterBreakdown.put(sem, rs.getLong(2));
                    }
                }
            }
        }
        dashboard.put("semesterDistribution", semesterBreakdown);

        // 4. Department Subjects Count
        long subjectCount = 0;
        String subjSql = "SELECT count(*) FROM subject WHERE department_id = ?";
        try (PreparedStatement ps = db.prepareStatement(subjSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) subjectCount = rs.getLong(1);
            }
        }
        dashboard.put("totalSubjects", subjectCount);

        // 5. Department Question Banks Count
        long qbCount = 0;
        String qbSql = "SELECT count(*) FROM question_bank WHERE department_id = ?";
        try (PreparedStatement ps = db.prepareStatement(qbSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) qbCount = rs.getLong(1);
            }
        }
        dashboard.put("totalQuestionBanks", qbCount);

        return HttpResponses.success(dashboard, "HOD departmental dashboard retrieved successfully");
    }

    /**
     * Lists subjects for the HOD's department, optionally filtered by semester (1..8).
     */
    public Map<String, Object> listSubjects(Connection db, UserSession user, Integer semesterNumber) throws SQLException {
        RbacGuard.requireHod(user);
        long deptId = user.departmentId();

        StringBuilder sql = new StringBuilder("""
                SELECT s.id, s.code, s.name, s.semester AS semester_number, s.department_id,
                       s.module_count, s.status, s.applicable_sections
                FROM subject s
                WHERE s.department_id = ?
                """);
        if (semesterNumber != null && semesterNumber >= 1 && semesterNumber <= 8) {
            sql.append(" AND s.semester = ?");
        }
        sql.append(" ORDER BY s.semester ASC, s.code ASC");

        List<Map<String, Object>> subjects = new ArrayList<>();
        try (PreparedStatement ps = db.prepareStatement(sql.toString())) {
            ps.setLong(1, deptId);
            if (semesterNumber != null && semesterNumber >= 1 && semesterNumber <= 8) {
                ps.setInt(2, semesterNumber);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> sub = new LinkedHashMap<>();
                    sub.put("id", String.valueOf(rs.getLong("id")));
                    sub.put("code", rs.getString("code"));
                    sub.put("name", rs.getString("name"));
                    sub.put("semesterNumber", rs.getInt("semester_number"));
                    sub.put("departmentId", String.valueOf(rs.getLong("department_id")));
                    sub.put("academicYearId", "2026-27");
                    sub.put("moduleCount", rs.getInt("module_count"));
                    String rawStatus = rs.getString("status");
                    sub.put("status", "ARCHIVED".equalsIgnoreCase(rawStatus) ? "Archived" : "Active");

                    List<String> secList = new ArrayList<>();
                    Array arr = rs.getArray("applicable_sections");
                    if (arr != null) {
                        Object obj = arr.getArray();
                        if (obj instanceof String[] sa) {
                            secList.addAll(Arrays.asList(sa));
                        } else if (obj instanceof Object[] oa) {
                            for (Object o : oa) if (o != null) secList.add(o.toString());
                        }
                    }
                    if (secList.isEmpty()) {
                        secList = List.of("All Sections");
                    }
                    sub.put("applicableSections", secList);
                    subjects.add(sub);
                }
            }
        }
        return HttpResponses.success(subjects, "Subjects retrieved successfully");
    }

    /**
     * Creates a subject in the HOD's department.
     */
    public Map<String, Object> createSubject(Connection db, UserSession user, String code, String name, int semester, int moduleCount) throws SQLException {
        RbacGuard.requireHod(user);
        long deptId = user.departmentId();

        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Subject code is required");
        }
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Subject name is required");
        }
        if (semester < 1 || semester > 8) {
            throw new IllegalArgumentException("Semester must be between 1 and 8");
        }
        if (moduleCount < 1 || moduleCount > 12) {
            throw new IllegalArgumentException("Module count must be between 1 and 12");
        }

        String cleanCode = code.trim().toUpperCase(Locale.ROOT);
        String cleanName = name.trim();

        // Check duplicate within department and semester
        String dupSql = "SELECT id FROM subject WHERE department_id = ? AND semester = ? AND UPPER(code) = ?";
        try (PreparedStatement ps = db.prepareStatement(dupSql)) {
            ps.setLong(1, deptId);
            ps.setInt(2, semester);
            ps.setString(3, cleanCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    throw new IllegalStateException("Subject code " + cleanCode + " already exists in this department for semester " + semester);
                }
            }
        }

        List<String> secList = List.of("All Sections");
        Array secArray = db.createArrayOf("text", secList.toArray());

        long subId;
        String insertSql = """
                INSERT INTO subject(code, name, department_id, semester, module_count, status, applicable_sections)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
                """;
        try (PreparedStatement ps = db.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, cleanCode);
            ps.setString(2, cleanName);
            ps.setLong(3, deptId);
            ps.setInt(4, semester);
            ps.setInt(5, moduleCount);
            ps.setArray(6, secArray);
            ps.executeUpdate();
            try (ResultSet gk = ps.getGeneratedKeys()) {
                if (gk.next()) {
                    subId = gk.getLong(1);
                } else {
                    throw new SQLException("Failed to retrieve generated subject ID");
                }
            }
        }

        // Audit log
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
            ps.setLong(1, user.id());
            ps.setString(2, "CREATE_SUBJECT");
            ps.setString(3, "subject:" + subId);
            ps.setString(4, "Created subject " + cleanCode + " - " + cleanName + " (Modules: " + moduleCount + ", Sem: " + semester + ")");
            ps.executeUpdate();
        }

        Map<String, Object> sub = new LinkedHashMap<>();
        sub.put("id", String.valueOf(subId));
        sub.put("code", cleanCode);
        sub.put("name", cleanName);
        sub.put("semesterNumber", semester);
        sub.put("departmentId", String.valueOf(deptId));
        sub.put("moduleCount", moduleCount);
        sub.put("applicableSections", secList);
        sub.put("status", "Active");

        return HttpResponses.success(sub, "Subject created successfully");
    }

    /**
     * Updates an existing subject in the HOD's department.
     */
    public Map<String, Object> updateSubject(Connection db, UserSession user, long subjectId, String code, String name, Integer moduleCount) throws SQLException {
        RbacGuard.requireHod(user);
        long deptId = user.departmentId();

        // Verify ownership and get current semester
        int semester;
        String checkSql = "SELECT department_id, semester FROM subject WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(checkSql)) {
            ps.setLong(1, subjectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Subject with ID " + subjectId + " not found");
                }
                long ownerDept = rs.getLong("department_id");
                if (ownerDept != deptId) {
                    throw new SecurityException("Access denied: You cannot modify subjects belonging to another department");
                }
                semester = rs.getInt("semester");
            }
        }

        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Subject code is required");
        }
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Subject name is required");
        }
        int effectiveModules = 5;
        if (moduleCount != null) {
            if (moduleCount < 1 || moduleCount > 12) {
                throw new IllegalArgumentException("Module count must be between 1 and 12");
            }
            effectiveModules = moduleCount;
        }

        String cleanCode = code.trim().toUpperCase(Locale.ROOT);
        String cleanName = name.trim();

        // Check duplicate
        String dupSql = "SELECT id FROM subject WHERE department_id = ? AND semester = ? AND UPPER(code) = ? AND id != ?";
        try (PreparedStatement ps = db.prepareStatement(dupSql)) {
            ps.setLong(1, deptId);
            ps.setInt(2, semester);
            ps.setString(3, cleanCode);
            ps.setLong(4, subjectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    throw new IllegalStateException("Subject code " + cleanCode + " already exists in this department for semester " + semester);
                }
            }
        }

        String updateSql = "UPDATE subject SET code = ?, name = ?, module_count = ? WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(updateSql)) {
            ps.setString(1, cleanCode);
            ps.setString(2, cleanName);
            ps.setInt(3, effectiveModules);
            ps.setLong(4, subjectId);
            ps.executeUpdate();
        }

        // Audit log
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
            ps.setLong(1, user.id());
            ps.setString(2, "UPDATE_SUBJECT");
            ps.setString(3, "subject:" + subjectId);
            ps.setString(4, "Updated subject " + cleanCode + " - " + cleanName + " (Modules: " + effectiveModules + ")");
            ps.executeUpdate();
        }

        Map<String, Object> sub = new LinkedHashMap<>();
        sub.put("id", String.valueOf(subjectId));
        sub.put("code", cleanCode);
        sub.put("name", cleanName);
        sub.put("semesterNumber", semester);
        sub.put("departmentId", String.valueOf(deptId));
        sub.put("moduleCount", effectiveModules);
        return HttpResponses.success(sub, "Subject updated successfully");
    }

    /**
     * Safe lifecycle transition: Archives subject. Zero physical deletion.
     */
    public Map<String, Object> archiveSubject(Connection db, UserSession user, long subjectId) throws SQLException {
        RbacGuard.requireHod(user);
        long deptId = user.departmentId();

        String code;
        String checkSql = "SELECT department_id, code FROM subject WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(checkSql)) {
            ps.setLong(1, subjectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Subject with ID " + subjectId + " not found");
                }
                long ownerDept = rs.getLong("department_id");
                if (ownerDept != deptId) {
                    throw new SecurityException("Access denied: You cannot archive subjects belonging to another department");
                }
                code = rs.getString("code");
            }
        }

        String sql = "UPDATE subject SET status = 'ARCHIVED' WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setLong(1, subjectId);
            ps.executeUpdate();
        }

        // Audit log
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
            ps.setLong(1, user.id());
            ps.setString(2, "ARCHIVE_SUBJECT");
            ps.setString(3, "subject:" + subjectId);
            ps.setString(4, "Archived subject " + code + ". Historical examination records preserved.");
            ps.executeUpdate();
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", String.valueOf(subjectId));
        res.put("code", code);
        res.put("status", "Archived");
        res.put("deleted", false);
        res.put("archived", true);

        return HttpResponses.success(res, "Subject safely archived. Historical examination records preserved.");
    }

    /**
     * Toggles subject status between ACTIVE and ARCHIVED.
     */
    public Map<String, Object> toggleSubjectStatus(Connection db, UserSession user, long subjectId, String newStatus) throws SQLException {
        RbacGuard.requireHod(user);
        long deptId = user.departmentId();

        String checkSql = "SELECT department_id, code FROM subject WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(checkSql)) {
            ps.setLong(1, subjectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Subject with ID " + subjectId + " not found");
                }
                long ownerDept = rs.getLong("department_id");
                if (ownerDept != deptId) {
                    throw new SecurityException("Access denied: You cannot modify subjects belonging to another department");
                }
            }
        }

        String nextStatus = "ARCHIVED".equalsIgnoreCase(newStatus) ? "ARCHIVED" : "ACTIVE";
        String sql = "UPDATE subject SET status = ? WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setString(1, nextStatus);
            ps.setLong(2, subjectId);
            ps.executeUpdate();
        }

        // Audit log
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
            ps.setLong(1, user.id());
            ps.setString(2, "TOGGLE_SUBJECT_STATUS");
            ps.setString(3, "subject:" + subjectId);
            ps.setString(4, "Changed status of subject " + subjectId + " to " + nextStatus);
            ps.executeUpdate();
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", String.valueOf(subjectId));
        res.put("status", nextStatus.equalsIgnoreCase("ARCHIVED") ? "Archived" : "Active");
        return HttpResponses.success(res, "Subject status updated to " + nextStatus);
    }
}
