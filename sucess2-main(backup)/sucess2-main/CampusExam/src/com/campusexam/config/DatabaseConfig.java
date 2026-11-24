package com.campusexam.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Dedicated PostgreSQL database configuration and connection manager for the development backend.
 * Enforces strict database isolation: only allows connections to 'campusexam_test'.
 */
public class DatabaseConfig {

    private final String url;
    private final String user;
    private final String password;
    private static final String REQUIRED_DB_NAME = "campusexam_test";

    public DatabaseConfig(String url, String user, String password) {
        this.url = (url != null && !url.isBlank()) ? url : "jdbc:postgresql://localhost:5432/" + REQUIRED_DB_NAME;
        this.user = (user != null && !user.isBlank()) ? user : "campusexam";
        this.password = (password != null) ? password : "password";
    }

    /**
     * Executes the mandatory startup assertion check to guarantee that the application
     * connects ONLY to campusexam_test. Aborts process execution if the check fails.
     */
    public void verifyStartupIsolation() {
        System.out.println("[DatabaseConfig] Verifying startup database isolation against: " + url);
        try (Connection conn = getConnection()) {
            String currentDb = null;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT current_database(), current_user")) {
                if (rs.next()) {
                    currentDb = rs.getString(1);
                    String currentUser = rs.getString(2);
                    System.out.println("[DatabaseConfig] Connected as user: " + currentUser + " | Database: " + currentDb);
                }
            }
            if (!REQUIRED_DB_NAME.equals(currentDb)) {
                System.err.println("================================================================================");
                System.err.println("FATAL STARTUP CHECK FAILED: Connected to database '" + currentDb + "'!");
                System.err.println("The development instance MUST target '" + REQUIRED_DB_NAME + "' only.");
                System.err.println("Aborting process immediately to prevent any accidental production writes.");
                System.err.println("================================================================================");
                System.exit(1);
            }
            System.out.println("[DatabaseConfig] Database isolation check PASSED: " + REQUIRED_DB_NAME);
        } catch (SQLException e) {
            System.err.println("[DatabaseConfig] FATAL: Unable to connect to " + REQUIRED_DB_NAME + ": " + e.getMessage());
            System.exit(1);
        }
    }

    /**
     * Obtains a new database connection with auto-commit enabled by default.
     */
    public Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(url, user, password);
        // Double-check connection validity
        if (!conn.isValid(2)) {
            throw new SQLException("Database connection to " + REQUIRED_DB_NAME + " is invalid or timed out.");
        }
        return conn;
    }

    public String getUrl() {
        return url;
    }

    public String getUser() {
        return user;
    }
}
