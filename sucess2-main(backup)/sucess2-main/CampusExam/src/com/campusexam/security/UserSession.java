package com.campusexam.security;

import java.util.Objects;

/**
 * Immutable authenticated user session model.
 */
public record UserSession(
        long id,
        String username,
        String role,
        Long departmentId,
        String departmentCode,
        String fullName,
        String email,
        String status
) {
    public UserSession {
        Objects.requireNonNull(username, "username must not be null");
        Objects.requireNonNull(role, "role must not be null");
    }

    public boolean isAdmin() {
        return "ADMIN".equalsIgnoreCase(role);
    }

    public boolean isPrincipal() {
        return "PRINCIPAL".equalsIgnoreCase(role) || isAdmin();
    }

    public boolean isCoe() {
        return "COE".equalsIgnoreCase(role) || isAdmin();
    }

    public boolean isHod() {
        return "HOD".equalsIgnoreCase(role);
    }

    public boolean isStudent() {
        return "STUDENT".equalsIgnoreCase(role);
    }

    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status);
    }
}
