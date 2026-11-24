package com.campusexam.service;

import com.campusexam.security.PasswordHasher;
import com.campusexam.security.TokenService;
import com.campusexam.security.UserSession;
import com.campusexam.util.HttpResponses;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Modular authentication service implementing secure PBKDF2WithHmacSHA256 password verification,
 * session token management, logout, and password change.
 */
public class AuthService {

    public AuthService() {}

    /**
     * Authenticates an incoming session token from the Authorization header.
     * Throws SecurityException if token is missing, invalid, or expired.
     */
    public UserSession authenticate(Connection db, String rawToken) throws SQLException {
        if (rawToken == null || rawToken.isBlank()) {
            throw new SecurityException("Authentication required: Missing session token");
        }
        String digest = TokenService.digest(rawToken);
        String sql = """
                SELECT a.id, a.username, a.role, a.department_id, d.code, a.full_name, a.email, a.status
                FROM account a
                JOIN session_token s ON s.account_id = a.id
                LEFT JOIN department d ON d.id = a.department_id
                WHERE s.token_hash = ? AND s.expires > clock_timestamp()
                """;
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setString(1, digest);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SecurityException("Session expired or invalid: Please sign in again");
                }
                long id = rs.getLong(1);
                String username = rs.getString(2);
                String role = rs.getString(3);
                Long deptId = rs.getObject(4) == null ? null : rs.getLong(4);
                String deptCode = rs.getString(5);
                String fullName = rs.getString(6);
                String email = rs.getString(7);
                String status = rs.getString(8);

                if (!"ACTIVE".equalsIgnoreCase(status)) {
                    throw new SecurityException("Account has been deactivated or suspended");
                }
                return new UserSession(id, username, role, deptId, deptCode, fullName, email, status);
            }
        }
    }

    /**
     * Standard staff login for Principal, HOD, and Administrator.
     */
    public Map<String, Object> login(Connection db, String username, String password) throws Exception {
        PasswordHasher.validatePassword(password);
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        String uname = username.trim().toLowerCase(Locale.ROOT);

        String sql = """
                SELECT a.id, a.username, a.role, a.department_id, d.code, d.name, a.full_name, a.email, a.password_hash, a.status
                FROM account a
                LEFT JOIN department d ON d.id = a.department_id
                WHERE lower(a.username) = ? OR lower(a.email) = ? OR upper(a.employee_id) = upper(?)
                """;
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setString(1, uname);
            ps.setString(2, uname);
            ps.setString(3, uname);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SecurityException("Invalid credentials");
                }
                long accountId = rs.getLong(1);
                String dbUsername = rs.getString(2);
                String role = rs.getString(3);
                Long deptId = rs.getObject(4) == null ? null : rs.getLong(4);
                String deptCode = rs.getString(5);
                String deptName = rs.getString(6);
                String fullName = rs.getString(7);
                String email = rs.getString(8);
                String storedHash = rs.getString(9);
                String status = rs.getString(10);

                // Verify password strictly with PBKDF2WithHmacSHA256 (no plaintexts, no backdoors)
                if (!PasswordHasher.verify(password, storedHash)) {
                    throw new SecurityException("Invalid credentials");
                }

                if (!"ACTIVE".equalsIgnoreCase(status)) {
                    throw new SecurityException("Account has been disabled or suspended");
                }

                // Generate new token & persist in session_token table
                String token = TokenService.generateToken();
                TokenService.persistSession(db, accountId, token);

                // Update last login timestamp
                try (PreparedStatement up = db.prepareStatement("UPDATE account SET last_login_at = clock_timestamp() WHERE id = ?")) {
                    up.setLong(1, accountId);
                    up.executeUpdate();
                }

                // Build User details payload matching V1 contract
                Map<String, Object> userMap = new LinkedHashMap<>();
                userMap.put("id", accountId);
                userMap.put("username", dbUsername);
                userMap.put("role", role);
                userMap.put("fullName", fullName != null ? fullName : dbUsername);
                userMap.put("email", email);
                userMap.put("departmentId", deptId);
                userMap.put("departmentCode", deptCode);
                userMap.put("departmentName", deptName);
                userMap.put("status", status);

                Map<String, Object> data = new LinkedHashMap<>();
                data.put("token", token);
                data.put("user", userMap);

                return HttpResponses.success(data, "Authentication successful");
            }
        }
    }

    /**
     * COE dedicated login endpoint. Enforces role restriction to COE, PRINCIPAL, or ADMIN.
     */
    public Map<String, Object> coeLogin(Connection db, String username, String password) throws Exception {
        Map<String, Object> loginResponse = login(db, username, password);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) loginResponse.get("data");
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) data.get("user");
        String role = (String) user.get("role");

        if (!"COE".equalsIgnoreCase(role) && !"ADMIN".equalsIgnoreCase(role) && !"PRINCIPAL".equalsIgnoreCase(role)) {
            // Revoke the generated token immediately
            TokenService.invalidateSession(db, (String) data.get("token"));
            throw new SecurityException("Access denied: Account is not authorized for Controller of Examinations portal");
        }
        return loginResponse;
    }

    /**
     * Logs out the user by deleting the session token.
     */
    public Map<String, Object> logout(Connection db, String rawToken) throws SQLException {
        if (rawToken != null && !rawToken.isBlank()) {
            TokenService.invalidateSession(db, rawToken);
        }
        return HttpResponses.success(Map.of("loggedOut", true), "Logged out successfully");
    }

    /**
     * Secure password change: verifies current password, validates new password complexity,
     * updates PBKDF2 hash in account table.
     */
    public Map<String, Object> changePassword(Connection db, UserSession user, String currentPassword, String newPassword) throws Exception {
        PasswordHasher.validatePassword(currentPassword);
        PasswordHasher.validatePassword(newPassword);

        String sql = "SELECT password_hash FROM account WHERE id = ?";
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setLong(1, user.id());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SecurityException("Account not found");
                }
                String currentHash = rs.getString(1);
                if (!PasswordHasher.verify(currentPassword, currentHash)) {
                    throw new SecurityException("Current password does not match");
                }
            }
        }

        // Hash new password and update
        String newHash = PasswordHasher.hash(newPassword);
        try (PreparedStatement up = db.prepareStatement("UPDATE account SET password_hash = ? WHERE id = ?")) {
            up.setString(1, newHash);
            up.setLong(2, user.id());
            up.executeUpdate();
        }

        return HttpResponses.success(Map.of("changed", true), "Password changed successfully");
    }
}
