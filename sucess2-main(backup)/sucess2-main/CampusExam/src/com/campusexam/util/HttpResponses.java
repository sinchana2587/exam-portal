package com.campusexam.util;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Standardized JSON HTTP Response Envelope builder matching frontend V1 contract.
 */
public final class HttpResponses {

    private HttpResponses() {}

    public static Map<String, Object> success(Object data, String message) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("success", true);
        envelope.put("data", data);
        if (message != null && !message.isBlank()) {
            envelope.put("message", message);
        }
        envelope.put("timestamp", Instant.now().toString());
        return envelope;
    }

    public static Map<String, Object> error(String code, String message) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("success", false);
        envelope.put("code", code != null ? code : "BAD_REQUEST");
        String sanitized = SecuritySanitizer.sanitizeErrorMessage(message);
        envelope.put("message", sanitized);
        envelope.put("error", sanitized);
        envelope.put("timestamp", Instant.now().toString());
        return envelope;
    }

    public static Map<String, Object> unauthorized(String message) {
        return error("UNAUTHORIZED", message != null ? message : "Authentication required");
    }

    public static Map<String, Object> forbidden(String message) {
        return error("FORBIDDEN", message != null ? message : "Access denied");
    }

    public static Map<String, Object> notFound(String message) {
        return error("NOT_FOUND", message != null ? message : "Requested resource not found");
    }

    public static Map<String, Object> validationError(String message) {
        return error("VALIDATION_ERROR", message != null ? message : "Invalid input parameters");
    }
}
