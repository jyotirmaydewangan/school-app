import { CorsMiddleware } from './CorsMiddleware.js';

/**
 * PERMISSION_REQUIREMENTS: action → required permission string.
 * Injected at deploy time from config.yaml → permissions.actionRequirements.
 * Falls back to a safe built-in default if the placeholder was not replaced.
 */
const PERMISSION_REQUIREMENTS = (function () {
    const injected = '{PERMISSION_REQUIREMENTS_JSON}';
    const placeholder = '{' + 'PERMISSION_REQUIREMENTS_JSON' + '}';
    if (
        injected === placeholder ||
        injected === '{}' ||
        injected === ''
    ) {
        return _getDefaultRequirements();
    }
    try {
        return JSON.parse(injected);
    } catch (e) {
        return _getDefaultRequirements();
    }
})();

/**
 * ROLES_CONFIG: role → { permissions: string[] }
 * Shared with auth.js — injected from config.yaml → roles.
 */
const ROLES_CONFIG = (function () {
    const injected = '{ROLES_JSON}';
    const placeholder = '{' + 'ROLES_JSON' + '}';
    if (injected === placeholder || injected === '{}' || injected === '') {
        return {};
    }
    try {
        return JSON.parse(injected);
    } catch (e) {
        return {};
    }
})();

function _getDefaultRequirements() {
    return {
        createNotice: 'write:noticeboard',
        updateNotice: 'write:noticeboard',
        deleteNotice: 'write:noticeboard',
        getNotices: 'read:noticeboard',
        // User Management
        getUsers: 'read:users',
        createUser: 'write:users',
        updateUser: 'write:users',
        deleteUser: 'write:users',
        approveUser: 'write:users',
        rejectUser: 'write:users',
        updateUserRole: 'write:users',
        createRole: 'write:users',
        updateRole: 'write:users',
        deleteRole: 'write:users'
    };
}

/**
 * Lightweight JWT role extraction — no signature verification.
 * The Worker does NOT need to verify the signature; that is Apps Script's job.
 * We only need the role claim to enforce coarse-grained permission checks at
 * the edge. Apps Script always re-validates the full token.
 *
 * @param {string} token
 * @returns {string|null} role claim, or null if unparseable
 */
function _extractRoleFromToken(token) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        // base64url → base64 → decode
        const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = atob(padded);
        const payload = JSON.parse(json);
        return payload.role || null;
    } catch (e) {
        return null;
    }
}

/**
 * Build a 403 JSON response.
 * @param {string} message
 * @returns {Response}
 */
function _forbidden(message) {
    return new Response(
        JSON.stringify({ success: false, error: message }),
        {
            status: 403,
            headers: {
                'Content-Type': 'application/json',
                ...CorsMiddleware.buildHeaders()
            }
        }
    );
}

/**
 * PermissionMiddleware — Worker-level RBAC enforcement.
 *
 * Called before proxying any request to Apps Script.
 * Returns a 403 Response if permission is denied, or null to allow through.
 *
 * @param {string} action   - The parsed action name (e.g. 'createNotice')
 * @param {string|null} token - JWT extracted from the request
 * @returns {Response|null}
 */
export const PermissionMiddleware = {
    /**
     * Check whether the token's role is allowed to perform the given action.
     *
     * @param {string}      action
     * @param {string|null} token
     * @param {object|null} rolesConfig - Optional override for role definitions (e.g. from KV)
     * @returns {Response|null} 403 Response if denied, null if allowed
     */
    check(action, token, rolesConfig = null) {
        const required = PERMISSION_REQUIREMENTS[action];

        // No requirement defined for this action → allow
        if (!required) return null;

        // Permission required but no token provided
        if (!token) {
            return _forbidden('Authentication required');
        }

        const role = _extractRoleFromToken(token);
        if (!role) {
            return _forbidden('Invalid or malformed token');
        }

        const config = rolesConfig || ROLES_CONFIG;
        const roleData = config[role] || {};
        const permissions = Array.isArray(roleData.permissions)
            ? roleData.permissions
            : [];

        // Wildcard → full access
        if (permissions.includes('*')) return null;

        // Check explicit permission
        if (permissions.includes(required)) return null;

        return _forbidden(
            `Permission '${required}' is required for action '${action}'`
        );
    },

    // ─── Exposed for unit testing ─────────────────────────────────────────────
    _extractRoleFromToken,
    _getDefaultRequirements,
    get PERMISSION_REQUIREMENTS() { return PERMISSION_REQUIREMENTS; },
    get ROLES_CONFIG() { return ROLES_CONFIG; }
};
