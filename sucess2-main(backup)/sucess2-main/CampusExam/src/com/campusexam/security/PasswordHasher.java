package com.campusexam.security;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Standardized PBKDF2WithHmacSHA256 password hashing and constant-time verification.
 * Follows the existing institutional standard:
 * - 16-byte cryptographically secure salt
 * - 600,000 iterations
 * - 256-bit (32 bytes) derived key length
 * - Format: <saltHex>:<derivedHex>
 */
public final class PasswordHasher {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int SALT_BYTES = 16;
    private static final int ITERATIONS = 600_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";

    private PasswordHasher() {}

    /**
     * Validates that the password meets complexity constraints (8 to 128 characters).
     */
    public static void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 128) {
            throw new IllegalArgumentException("Password must have 8 to 128 characters");
        }
    }

    /**
     * Generates a new salt and computes the PBKDF2 hash.
     * Returns saltHex:hashHex.
     */
    public static String hash(String password) throws GeneralSecurityException {
        validatePassword(password);
        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);
        byte[] derived = derive(password, salt);
        return HexFormat.of().formatHex(salt) + ":" + HexFormat.of().formatHex(derived);
    }

    /**
     * Verifies a candidate password against an existing saltHex:hashHex string in constant time.
     */
    public static boolean verify(String candidatePassword, String storedHash) {
        if (candidatePassword == null || storedHash == null || !storedHash.contains(":")) {
            return false;
        }
        try {
            String[] parts = storedHash.split(":");
            if (parts.length != 2) return false;
            byte[] salt = HexFormat.of().parseHex(parts[0]);
            byte[] expectedHash = HexFormat.of().parseHex(parts[1]);
            byte[] computedHash = derive(candidatePassword, salt);
            return MessageDigest.isEqual(expectedHash, computedHash);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Derives the key bytes using PBKDF2WithHmacSHA256.
     */
    private static byte[] derive(String password, byte[] salt) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH_BITS);
        try {
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }
}
