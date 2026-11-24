package com.campusexam.security;

/**
 * Server-side Role-Based Access Control (RBAC) and Department Isolation Guard.
 */
public final class RbacGuard {

    private RbacGuard() {}

    public static void requireAuthenticated(UserSession user) {
        if (user == null) {
            throw new SecurityException("Sign in required: No active authenticated session");
        }
        if (!user.isActive()) {
            throw new SecurityException("Account is disabled or inactive");
        }
    }

    public static void requirePrincipal(UserSession user) {
        requireAuthenticated(user);
        if (!user.isPrincipal()) {
            throw new SecurityException("Access restricted: Requires Principal or System Administrator role");
        }
    }

    public static void requireCoe(UserSession user) {
        requireAuthenticated(user);
        if (!user.isCoe()) {
            throw new SecurityException("Access restricted: Requires Controller of Examinations role");
        }
    }

    public static void requireHod(UserSession user) {
        requireAuthenticated(user);
        if (!user.isHod() && !user.isAdmin()) {
            throw new SecurityException("Access restricted: Requires Head of Department role");
        }
    }

    public static void requireNonStudent(UserSession user) {
        requireAuthenticated(user);
        if (user.isStudent()) {
            throw new SecurityException("Students are strictly prohibited from accessing administrative portal APIs");
        }
    }

    /**
     * Enforces department isolation:
     * - HODs are strictly constrained to their own departmentId.
     * - Any browser-supplied department ID that conflicts with user.departmentId() is rejected.
     * - Returns the authoritative department ID for database queries.
     */
    public static long enforceDepartmentScope(UserSession user, Long requestedDeptId) {
        requireAuthenticated(user);
        if (user.isHod()) {
            if (user.departmentId() == null) {
                throw new SecurityException("Misconfigured HOD account: No department assigned");
            }
            if (requestedDeptId != null && !requestedDeptId.equals(user.departmentId())) {
                throw new SecurityException("Access denied: You are only authorized to manage your assigned department (" + user.departmentCode() + ")");
            }
            return user.departmentId();
        }
        if (user.isPrincipal() || user.isCoe()) {
            // Principal/COE can specify any department or view all
            if (requestedDeptId != null) {
                return requestedDeptId;
            }
            throw new IllegalArgumentException("Department ID must be specified for institution-wide roles");
        }
        throw new SecurityException("Unauthorized department access");
    }
}
