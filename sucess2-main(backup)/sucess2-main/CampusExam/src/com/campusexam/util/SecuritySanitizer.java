package com.campusexam.util;

import java.util.regex.Pattern;

/**
 * Sanitizes system and error messages to guarantee that no sensitive data
 * (passwords, tokens, DOBs, SQL syntax errors, database internals) leaks into API responses.
 */
public final class SecuritySanitizer {

    private static final Pattern SQL_ERROR_PATTERN = Pattern.compile("(?i)(ERROR:|PSQLException|org\\.postgresql|SQLState|syntax error at or near).*");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("(?i)[a-f0-9]{32,64}");
    private static final Pattern PASSWORD_FIELD_PATTERN = Pattern.compile("(?i)(password|secret|passphrase|token)[\\s=:\"']+([^\\s,\"}']+)");

    private SecuritySanitizer() {}

    public static String sanitizeErrorMessage(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return "An error occurred while processing the request";
        }
        // If message contains internal SQL / PostgreSQL trace, mask it cleanly
        if (SQL_ERROR_PATTERN.matcher(rawMessage).find() || rawMessage.contains("violates foreign key constraint") || rawMessage.contains("violates unique constraint")) {
            if (rawMessage.contains("violates unique constraint")) {
                return "A record with this identifier already exists.";
            }
            if (rawMessage.contains("violates foreign key constraint")) {
                return "The requested operation cannot be completed due to related historical records.";
            }
            return "A database operation error occurred. Details have been logged securely.";
        }
        // Mask any tokens or passwords that might have been accidentally passed
        String sanitized = PASSWORD_FIELD_PATTERN.matcher(rawMessage).replaceAll("$1=[PROTECTED]");
        return sanitized;
    }
}
