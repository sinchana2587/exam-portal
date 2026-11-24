package com.campusexam.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HexFormat;

/**
 * Session token management: generation, SHA-256 hashing, expiration, and database storage.
 */
public final class TokenService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32; // 256 bits -> 64 hex chars

    private TokenService() {}

    /**
     * Generates a new cryptographically secure random token (64 hex characters).
     */
    public static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /**
     * Computes the SHA-256 digest of a raw token for database lookup.
     */
    public static String digest(String token) {
        if (token == null || token.isBlank()) return "";
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm missing", e);
        }
    }

    /**
     * Stores a new session token in session_token table for the given account ID,
     * removing any expired tokens, with a 12-hour expiration window.
     */
    public static void persistSession(Connection db, long accountId, String rawToken) throws SQLException {
        String tokenHash = digest(rawToken);
        // Clean expired tokens for this account
        try (PreparedStatement del = db.prepareStatement("DELETE FROM session_token WHERE account_id = ? AND expires <= clock_timestamp()")) {
            del.setLong(1, accountId);
            del.executeUpdate();
        }
        // Insert new token with 12 hour expiry
        try (PreparedStatement ins = db.prepareStatement("INSERT INTO session_token (token_hash, account_id, expires) VALUES (?, ?, clock_timestamp() + interval '12 hours')")) {
            ins.setString(1, tokenHash);
            ins.setLong(2, accountId);
            ins.executeUpdate();
        }
    }

    /**
     * Invalidates a session token (logout).
     */
    public static void invalidateSession(Connection db, String rawToken) throws SQLException {
        String tokenHash = digest(rawToken);
        try (PreparedStatement del = db.prepareStatement("DELETE FROM session_token WHERE token_hash = ?")) {
            del.setString(1, tokenHash);
            del.executeUpdate();
        }
    }

    /**
     * Extracts token from either 'Authorization: Bearer <token>' or raw header string.
     */
    public static String extractBearerToken(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) return null;
        String trimmed = authHeader.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        if (trimmed.length() == 64 && trimmed.matches("^[a-fA-F0-9]{64}$")) {
            return trimmed;
        }
        return null;
    }
}
