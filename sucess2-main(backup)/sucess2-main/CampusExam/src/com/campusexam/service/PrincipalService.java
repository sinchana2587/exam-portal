package com.campusexam.service;

import com.campusexam.security.PasswordHasher;
import com.campusexam.security.RbacGuard;
import com.campusexam.security.UserSession;
import com.campusexam.util.HttpResponses;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Service handling Principal and Administrator institution-wide operations:
 * - Department and HOD lifecycle management
 * - Department creation, editing, archival, and reactivation
 * - HOD replacement and assignment history tracking (preserving previous records)
 * - Safe status-based lifecycle transitions with ZERO physical deletion
 */
public class PrincipalService {

    private static final SecureRandom RANDOM = new SecureRandom();

    public PrincipalService() {}

    /**
     * Lists all departments in the institution along with their currently assigned active HOD.
     */
    public Map<String, Object> listDepartments(Connection db, UserSession user) throws SQLException {
        return listDepartments(db, user, null);
    }

    /**
     * Lists departments in the institution filtered optionally by status (ACTIVE / ARCHIVED / INACTIVE).
     */
    public Map<String, Object> listDepartments(Connection db, UserSession user, String statusFilter) throws SQLException {
        RbacGuard.requirePrincipal(user);
        List<Map<String, Object>> departments = new ArrayList<>();
        String sql = """
                SELECT d.id, d.code, d.name, d.status, d.created_at,
                       a.id AS hod_id, a.full_name AS hod_name, a.email AS hod_email,
                       a.contact_number AS hod_contact, a.employee_id AS hod_emp_id, a.status AS hod_status
                FROM department d
                LEFT JOIN account a ON a.department_id = d.id AND a.role = 'HOD' AND a.status = 'ACTIVE'
                """ + (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)
                        ? " WHERE UPPER(d.status) = '" + statusFilter.toUpperCase(Locale.ROOT).replace("'", "") + "' "
                        : "") + """
                ORDER BY d.code ASC
                """;
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                Map<String, Object> d = new LinkedHashMap<>();
                long deptId = rs.getLong("id");
                d.put("id", String.valueOf(deptId));
                d.put("code", rs.getString("code"));
                d.put("name", rs.getString("name"));
                String rawStatus = rs.getString("status");
                d.put("status", "ARCHIVED".equalsIgnoreCase(rawStatus) ? "Archived" : ("INACTIVE".equalsIgnoreCase(rawStatus) ? "Inactive" : "Active"));
                d.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant().toString() : "");
                d.put("identificationNumber", "DEPT-" + rs.getString("code"));

                if (rs.getObject("hod_id") != null) {
                    Map<String, Object> hod = new LinkedHashMap<>();
                    hod.put("id", String.valueOf(rs.getLong("hod_id")));
                    hod.put("fullName", rs.getString("hod_name"));
                    hod.put("email", rs.getString("hod_email"));
                    hod.put("contactNumber", rs.getString("hod_contact") != null ? rs.getString("hod_contact") : "");
                    hod.put("employeeId", rs.getString("hod_emp_id") != null ? rs.getString("hod_emp_id") : "");
                    hod.put("status", "Active");
                    d.put("currentHod", hod);
                    d.put("hodId", String.valueOf(rs.getLong("hod_id")));
                    d.put("hodName", rs.getString("hod_name"));
                    d.put("hodEmail", rs.getString("hod_email"));
                } else {
                    d.put("currentHod", null);
                    d.put("hodId", null);
                    d.put("hodName", "Not Assigned");
                    d.put("hodEmail", "");
                }
                departments.add(d);
            }
        }
        return HttpResponses.success(departments, "Departments retrieved successfully");
    }

    /**
     * Creates a new academic department.
     */
    public Map<String, Object> createDepartment(Connection db, UserSession user, String code, String name) throws SQLException {
        RbacGuard.requirePrincipal(user);
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Department code is required");
        }
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Department name is required");
        }

        String cleanCode = code.trim().toUpperCase(Locale.ROOT);
        String cleanName = name.trim();

        if (!cleanCode.matches("^[A-Z0-9_-]{2,20}$")) {
            throw new IllegalArgumentException("Department code must be 2-20 alphanumeric characters");
        }

        // Duplicate code validation
        String checkSql = "SELECT id FROM department WHERE UPPER(code) = ?";
        try (PreparedStatement ps = db.prepareStatement(checkSql)) {
            ps.setString(1, cleanCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    throw new IllegalStateException("Department code " + cleanCode + " already exists");
                }
            }
        }

        long deptId;
        String insertSql = "INSERT INTO department(code, name, status) VALUES (?, ?, 'ACTIVE')";
        try (PreparedStatement ps = db.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, cleanCode);
            ps.setString(2, cleanName);
            ps.executeUpdate();
            try (ResultSet gk = ps.getGeneratedKeys()) {
                if (gk.next()) {
                    deptId = gk.getLong(1);
                } else {
                    throw new SQLException("Failed to retrieve generated department ID");
                }
            }
        }

        // Audit log
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
            ps.setLong(1, user.id());
            ps.setString(2, "CREATE_DEPARTMENT");
            ps.setString(3, "department:" + deptId);
            ps.setString(4, "Created department " + cleanCode + " - " + cleanName);
            ps.executeUpdate();
        }

        Map<String, Object> d = new LinkedHashMap<>();
        d.put("id", String.valueOf(deptId));
        d.put("code", cleanCode);
        d.put("name", cleanName);
        d.put("status", "Active");
        d.put("identificationNumber", "DEPT-" + cleanCode);

        return HttpResponses.success(d, "Department created successfully");
    }

    /**
     * Updates an existing department's name and optional code.
     */
    public Map<String, Object> updateDepartment(Connection db, UserSession user, long deptId, String name, String code) throws SQLException {
        RbacGuard.requirePrincipal(user);
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Department name is required");
        }

        String existingSql = "SELECT id, code FROM department WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(existingSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Department with ID " + deptId + " not found");
                }
            }
        }

        String cleanName = name.trim();
        if (code != null && !code.trim().isEmpty()) {
            String cleanCode = code.trim().toUpperCase(Locale.ROOT);
            String dupSql = "SELECT id FROM department WHERE UPPER(code) = ? AND id != ?";
            try (PreparedStatement ps = db.prepareStatement(dupSql)) {
                ps.setString(1, cleanCode);
                ps.setLong(2, deptId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        throw new IllegalStateException("Department code " + cleanCode + " is already in use by another department");
                    }
                }
            }
            String updateSql = "UPDATE department SET name = ?, code = ? WHERE id = ?";
            try (PreparedStatement ps = db.prepareStatement(updateSql)) {
                ps.setString(1, cleanName);
                ps.setString(2, cleanCode);
                ps.setLong(3, deptId);
                ps.executeUpdate();
            }
        } else {
            String updateSql = "UPDATE department SET name = ? WHERE id = ?";
            try (PreparedStatement ps = db.prepareStatement(updateSql)) {
                ps.setString(1, cleanName);
                ps.setLong(2, deptId);
                ps.executeUpdate();
            }
        }

        // Audit log
        try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
            ps.setLong(1, user.id());
            ps.setString(2, "UPDATE_DEPARTMENT");
            ps.setString(3, "department:" + deptId);
            ps.setString(4, "Updated department " + deptId + " (" + cleanName + ")");
            ps.executeUpdate();
        }

        return HttpResponses.success(Map.of("id", String.valueOf(deptId), "name", cleanName), "Department updated successfully");
    }

    /**
     * Toggles or updates department status (ACTIVE, ARCHIVED, INACTIVE).
     * Soft lifecycle transition: When archived/deactivated, preserves all historical exam and student records,
     * deactivates active HOD assignment, and closes assignment history.
     */
    public Map<String, Object> toggleDepartmentStatus(Connection db, UserSession user, long deptId, String status) throws Exception {
        RbacGuard.requirePrincipal(user);
        if (status == null || (!status.equalsIgnoreCase("ACTIVE") && !status.equalsIgnoreCase("ARCHIVED") && !status.equalsIgnoreCase("INACTIVE"))) {
            throw new IllegalArgumentException("Status must be ACTIVE, ARCHIVED, or INACTIVE");
        }

        String cleanStatus = status.trim().toUpperCase(Locale.ROOT);
        String deptCode;
        String checkSql = "SELECT code FROM department WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(checkSql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Department with ID " + deptId + " not found");
                }
                deptCode = rs.getString("code");
            }
        }

        boolean origAutoCommit = db.getAutoCommit();
        try {
            db.setAutoCommit(false);

            // Update department status
            try (PreparedStatement ps = db.prepareStatement("UPDATE department SET status = ? WHERE id = ?")) {
                ps.setString(1, cleanStatus);
                ps.setLong(2, deptId);
                ps.executeUpdate();
            }

            if ("ARCHIVED".equalsIgnoreCase(cleanStatus) || "INACTIVE".equalsIgnoreCase(cleanStatus)) {
                // Relieve active HOD(s)
                try (PreparedStatement ps = db.prepareStatement("UPDATE account SET status = 'INACTIVE' WHERE department_id = ? AND role = 'HOD' AND status = 'ACTIVE'")) {
                    ps.setLong(1, deptId);
                    ps.executeUpdate();
                }
                // Close active assignment history entry
                try (PreparedStatement ps = db.prepareStatement("UPDATE hod_assignment_history SET relieved_at = clock_timestamp(), reason = 'Department Archived' WHERE department_id = ? AND relieved_at IS NULL")) {
                    ps.setLong(1, deptId);
                    ps.executeUpdate();
                }
            }

            // Audit log
            String action = "ACTIVE".equalsIgnoreCase(cleanStatus) ? "REACTIVATE_DEPARTMENT" : "ARCHIVE_DEPARTMENT";
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
                ps.setLong(1, user.id());
                ps.setString(2, action);
                ps.setString(3, "department:" + deptId);
                ps.setString(4, "Changed status of department " + deptCode + " to " + cleanStatus);
                ps.executeUpdate();
            }

            db.commit();
            return HttpResponses.success(Map.of("id", String.valueOf(deptId), "status", cleanStatus), "Department status updated to " + cleanStatus);
        } catch (Exception e) {
            db.rollback();
            throw e;
        } finally {
            db.setAutoCommit(origAutoCommit);
        }
    }

    /**
     * Atomically replaces an HOD for a department.
     * Preserves previous HOD account and assignment history without physical deletion.
     */
    public Map<String, Object> replaceDepartmentHod(Connection db, UserSession user, long deptId, String fullName,
                                                    String employeeId, String email, String contactNumber, String reason) throws Exception {
        RbacGuard.requirePrincipal(user);
        if (fullName == null || fullName.trim().isEmpty() ||
            employeeId == null || employeeId.trim().isEmpty() ||
            email == null || email.trim().isEmpty() ||
            contactNumber == null || contactNumber.trim().isEmpty()) {
            throw new IllegalArgumentException("Full name, employee ID, official email, and contact number are required");
        }

        String cleanName = fullName.trim();
        String cleanEmpId = employeeId.trim().toUpperCase(Locale.ROOT);
        String cleanEmail = email.trim().toLowerCase(Locale.ROOT);
        String cleanContact = contactNumber.trim();
        String cleanReason = (reason == null || reason.trim().isEmpty()) ? "Administrative HOD Transition" : reason.trim();

        String deptCode;
        String checkDept = "SELECT code FROM department WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(checkDept)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Department with ID " + deptId + " not found");
                }
                deptCode = rs.getString("code");
            }
        }

        boolean origAutoCommit = db.getAutoCommit();
        try {
            db.setAutoCommit(false);

            // 1. Relieve previous active HOD
            Long prevHodId = null;
            String findPrev = "SELECT id FROM account WHERE department_id = ? AND role = 'HOD' AND status = 'ACTIVE'";
            try (PreparedStatement ps = db.prepareStatement(findPrev)) {
                ps.setLong(1, deptId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        prevHodId = rs.getLong(1);
                    }
                }
            }

            if (prevHodId != null) {
                // Deactivate previous HOD account
                try (PreparedStatement ps = db.prepareStatement("UPDATE account SET status = 'INACTIVE' WHERE id = ?")) {
                    ps.setLong(1, prevHodId);
                    ps.executeUpdate();
                }
                // Close active assignment history entry
                try (PreparedStatement ps = db.prepareStatement("UPDATE hod_assignment_history SET relieved_at = clock_timestamp(), reason = ? WHERE department_id = ? AND relieved_at IS NULL")) {
                    ps.setString(1, cleanReason);
                    ps.setLong(2, deptId);
                    ps.executeUpdate();
                }
            }

            // 2. Provision new HOD account or activate existing provisioned account
            Long newHodId = null;
            String checkExisting = "SELECT id FROM account WHERE employee_id = ? OR email = ?";
            try (PreparedStatement ps = db.prepareStatement(checkExisting)) {
                ps.setString(1, cleanEmpId);
                ps.setString(2, cleanEmail);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        newHodId = rs.getLong(1);
                    }
                }
            }

            if (newHodId != null) {
                try (PreparedStatement ps = db.prepareStatement("UPDATE account SET department_id = ?, status = 'ACTIVE', full_name = ?, contact_number = ? WHERE id = ?")) {
                    ps.setLong(1, deptId);
                    ps.setString(2, cleanName);
                    ps.setString(3, cleanContact);
                    ps.setLong(4, newHodId);
                    ps.executeUpdate();
                }
            } else {
                String baseUsername = "hod_" + deptCode.toLowerCase(Locale.ROOT) + "_" + HexFormat.of().formatHex(RANDOM.generateSeed(2));
                String username = baseUsername;
                int suffix = 1;
                while (true) {
                    try (PreparedStatement ps = db.prepareStatement("SELECT id FROM account WHERE username = ?")) {
                        ps.setString(1, username);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (!rs.next()) break;
                        }
                    }
                    username = baseUsername + "_" + (++suffix);
                }

                // Generate secure PBKDF2 hash (separate provisioning)
                String tempSecret = "MitmHod@" + HexFormat.of().formatHex(RANDOM.generateSeed(4));
                String passHash = PasswordHasher.hash(tempSecret);

                String insertAcc = """
                        INSERT INTO account(username, password_hash, role, department_id, full_name, email, contact_number, employee_id, designation, status)
                        VALUES (?, ?, 'HOD', ?, ?, ?, ?, ?, 'Head of Department', 'ACTIVE')
                        """;
                try (PreparedStatement ps = db.prepareStatement(insertAcc, Statement.RETURN_GENERATED_KEYS)) {
                    ps.setString(1, username);
                    ps.setString(2, passHash);
                    ps.setLong(3, deptId);
                    ps.setString(4, cleanName);
                    ps.setString(5, cleanEmail);
                    ps.setString(6, cleanContact);
                    ps.setString(7, cleanEmpId);
                    ps.executeUpdate();
                    try (ResultSet gk = ps.getGeneratedKeys()) {
                        if (gk.next()) {
                            newHodId = gk.getLong(1);
                        } else {
                            throw new SQLException("Failed to retrieve generated HOD account ID");
                        }
                    }
                }
            }

            // 3. Record new assignment in history
            String insertHist = """
                    INSERT INTO hod_assignment_history(department_id, account_id, assigned_at, reason, assigned_by)
                    VALUES (?, ?, clock_timestamp(), ?, ?)
                    """;
            try (PreparedStatement ps = db.prepareStatement(insertHist)) {
                ps.setLong(1, deptId);
                ps.setLong(2, newHodId);
                ps.setString(3, cleanReason);
                ps.setLong(4, user.id());
                ps.executeUpdate();
            }

            // 4. Record Audit Log
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
                ps.setLong(1, user.id());
                ps.setString(2, "REPLACE_HOD");
                ps.setString(3, "department:" + deptId);
                ps.setString(4, "Replaced HOD with " + cleanName + " (" + cleanEmpId + "). Reason: " + cleanReason);
                ps.executeUpdate();
            }

            db.commit();

            Map<String, Object> hod = new LinkedHashMap<>();
            hod.put("id", String.valueOf(newHodId));
            hod.put("fullName", cleanName);
            hod.put("employeeId", cleanEmpId);
            hod.put("email", cleanEmail);
            hod.put("contactNumber", cleanContact);
            hod.put("designation", "Head of Department");
            hod.put("departmentId", String.valueOf(deptId));
            hod.put("departmentCode", deptCode);
            hod.put("status", "Active");

            return HttpResponses.success(hod, "HOD replacement completed successfully");
        } catch (Exception ex) {
            db.rollback();
            throw ex;
        } finally {
            db.setAutoCommit(origAutoCommit);
        }
    }

    /**
     * Retrieves the HOD assignment history for a department.
     */
    public Map<String, Object> getDepartmentHodHistory(Connection db, UserSession user, long deptId) throws SQLException {
        RbacGuard.requirePrincipal(user);
        List<Map<String, Object>> history = new ArrayList<>();
        String sql = """
                SELECT h.id, h.department_id, h.account_id, a.full_name, a.employee_id, a.email, a.contact_number,
                       h.assigned_at, h.relieved_at, h.reason, u.full_name AS assigned_by_name
                FROM hod_assignment_history h
                JOIN account a ON a.id = h.account_id
                LEFT JOIN account u ON u.id = h.assigned_by
                WHERE h.department_id = ?
                ORDER BY h.assigned_at DESC
                """;
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setLong(1, deptId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", rs.getLong("id"));
                    item.put("departmentId", rs.getLong("department_id"));
                    item.put("accountId", rs.getLong("account_id"));
                    item.put("fullName", rs.getString("full_name"));
                    item.put("employeeId", rs.getString("employee_id"));
                    item.put("email", rs.getString("email"));
                    item.put("contactNumber", rs.getString("contact_number"));
                    item.put("assignedAt", rs.getTimestamp("assigned_at") != null ? rs.getTimestamp("assigned_at").toInstant().toString() : "");
                    item.put("relievedAt", rs.getTimestamp("relieved_at") != null ? rs.getTimestamp("relieved_at").toInstant().toString() : null);
                    item.put("reason", rs.getString("reason"));
                    item.put("assignedByName", rs.getString("assigned_by_name"));
                    item.put("isCurrent", rs.getTimestamp("relieved_at") == null);
                    history.add(item);
                }
            }
        }
        return HttpResponses.success(history, "Department HOD assignment history loaded");
    }

    /**
     * Lists all HODs with their assigned departments.
     */
    public Map<String, Object> listHods(Connection db, UserSession user) throws SQLException {
        RbacGuard.requirePrincipal(user);
        List<Map<String, Object>> hods = new ArrayList<>();
        String sql = """
                SELECT a.id, a.username, a.full_name, a.email, a.contact_number, a.employee_id,
                       a.status, a.last_login_at, d.id AS dept_id, d.code AS dept_code, d.name AS dept_name
                FROM account a
                LEFT JOIN department d ON d.id = a.department_id
                WHERE a.role = 'HOD'
                ORDER BY d.code ASC NULLS LAST, a.username ASC
                """;
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                Map<String, Object> h = new LinkedHashMap<>();
                h.put("id", rs.getLong("id"));
                h.put("username", rs.getString("username"));
                h.put("fullName", rs.getString("full_name"));
                h.put("email", rs.getString("email"));
                h.put("contactNumber", rs.getString("contact_number"));
                h.put("employeeId", rs.getString("employee_id"));
                h.put("status", rs.getString("status"));
                h.put("lastLoginAt", rs.getString("last_login_at"));
                h.put("departmentId", rs.getObject("dept_id"));
                h.put("departmentCode", rs.getString("dept_code"));
                h.put("departmentName", rs.getString("dept_name"));
                hods.add(h);
            }
        }
        return HttpResponses.success(hods, "HODs retrieved successfully");
    }

    /**
     * Safe lifecycle transition: Deactivates HOD account. Zero physical deletion.
     * Preserves all examination records, student rosters, question banks, and audit history.
     */
    public Map<String, Object> deleteHod(Connection db, UserSession user, long hodId) throws Exception {
        RbacGuard.requirePrincipal(user);

        boolean originalAutoCommit = db.getAutoCommit();
        try {
            db.setAutoCommit(false);

            // 1. Check if HOD exists and has HOD role
            String checkSql = "SELECT id, username, role, department_id, full_name FROM account WHERE id = ?";
            Long deptId = null;
            String username = null;
            String fullName = null;
            try (PreparedStatement ps = db.prepareStatement(checkSql)) {
                ps.setLong(1, hodId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        throw new IllegalArgumentException("HOD account with ID " + hodId + " not found");
                    }
                    if (!"HOD".equalsIgnoreCase(rs.getString("role"))) {
                        throw new IllegalArgumentException("Cannot deactivate non-HOD account via this endpoint");
                    }
                    username = rs.getString("username");
                    fullName = rs.getString("full_name");
                    deptId = rs.getObject("department_id") == null ? null : rs.getLong("department_id");
                }
            }

            // 2. Safe status transition: INACTIVE. NO PHYSICAL DELETION.
            try (PreparedStatement ps = db.prepareStatement("UPDATE account SET status = 'INACTIVE' WHERE id = ?")) {
                ps.setLong(1, hodId);
                ps.executeUpdate();
            }

            // 3. Clean active session tokens
            try (PreparedStatement ps = db.prepareStatement("DELETE FROM session_token WHERE account_id = ?")) {
                ps.setLong(1, hodId);
                ps.executeUpdate();
            }

            // 4. Close out active assignment in history
            if (deptId != null) {
                try (PreparedStatement ps = db.prepareStatement("UPDATE hod_assignment_history SET relieved_at = clock_timestamp(), reason = 'Deactivated by Principal' WHERE account_id = ? AND relieved_at IS NULL")) {
                    ps.setLong(1, hodId);
                    ps.executeUpdate();
                }
            }

            // 5. Audit log
            try (PreparedStatement ps = db.prepareStatement("INSERT INTO audit(actor, action, entity, detail) VALUES (?, ?, ?, ?)")) {
                ps.setLong(1, user.id());
                ps.setString(2, "DEACTIVATE_HOD");
                ps.setString(3, "account:" + hodId);
                ps.setString(4, "Deactivated HOD " + fullName + " (" + username + "). Historical records preserved.");
                ps.executeUpdate();
            }

            db.commit();
            return HttpResponses.success(Map.of("deleted", false, "deactivated", true, "hodId", hodId, "username", username, "status", "INACTIVE"), "HOD account safely deactivated. Historical references preserved.");
        } catch (Exception e) {
            db.rollback();
            throw e;
        } finally {
            db.setAutoCommit(originalAutoCommit);
        }
    }

    /**
     * Toggles an HOD's status between ACTIVE and INACTIVE.
     */
    public Map<String, Object> toggleHodStatus(Connection db, UserSession user, long hodId, String newStatus) throws SQLException {
        RbacGuard.requirePrincipal(user);
        if (!"ACTIVE".equalsIgnoreCase(newStatus) && !"INACTIVE".equalsIgnoreCase(newStatus) && !"SUSPENDED".equalsIgnoreCase(newStatus)) {
            throw new IllegalArgumentException("Status must be ACTIVE, INACTIVE, or SUSPENDED");
        }
        String sql = "UPDATE account SET status = ? WHERE id = ? AND role = 'HOD'";
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setString(1, newStatus.toUpperCase());
            ps.setLong(2, hodId);
            int rows = ps.executeUpdate();
            if (rows == 0) {
                throw new IllegalArgumentException("HOD not found or account is not an HOD");
            }
        }
        return HttpResponses.success(Map.of("hodId", hodId, "status", newStatus.toUpperCase()), "HOD status updated");
    }

    /**
     * Principal overview metrics.
     */
    public Map<String, Object> getOverview(Connection db, UserSession user) throws SQLException {
        RbacGuard.requirePrincipal(user);
        Map<String, Object> metrics = new LinkedHashMap<>();

        try (Statement st = db.createStatement()) {
            try (ResultSet rs = st.executeQuery("SELECT count(*) FROM department WHERE status = 'ACTIVE'")) {
                if (rs.next()) metrics.put("activeDepartments", rs.getLong(1));
            }
            try (ResultSet rs = st.executeQuery("SELECT count(*) FROM account WHERE role = 'HOD' AND status = 'ACTIVE'")) {
                if (rs.next()) metrics.put("activeHods", rs.getLong(1));
            }
            try (ResultSet rs = st.executeQuery("SELECT count(*) FROM student_roster")) {
                if (rs.next()) metrics.put("enrolledStudents", rs.getLong(1));
            }
            try (ResultSet rs = st.executeQuery("SELECT count(*) FROM subject")) {
                if (rs.next()) metrics.put("totalSubjects", rs.getLong(1));
            }
        }
        return HttpResponses.success(metrics, "Principal overview metrics retrieved");
    }
}
