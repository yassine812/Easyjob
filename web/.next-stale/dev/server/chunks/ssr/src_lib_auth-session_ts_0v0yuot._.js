module.exports = [
"[project]/src/lib/auth-session.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthIdentityError",
    ()=>AuthIdentityError,
    "clearSessionAtomic",
    ()=>clearSessionAtomic,
    "establishSession",
    ()=>establishSession
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/store/auth-store.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$company$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/store/company-store.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$query$2d$provider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/providers/query-provider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ws$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/ws.ts [app-ssr] (ecmascript)");
;
;
;
;
;
class AuthIdentityError extends Error {
    constructor(message){
        super(message);
        this.name = 'AuthIdentityError';
    }
}
async function establishSession(accessToken, expectedEmail) {
    // Step 1: Atomic cleanup of previous session & caches
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ws$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["disconnectSocket"])();
    // Keep protected routes waiting while /auth/me validates the new identity.
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().beginSessionTransition();
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$company$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCompanyStore"].getState().clearCompanyState();
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$query$2d$provider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["queryClient"].clear();
    const revision = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().sessionRevision;
    try {
        // Step 2: Install NEW access token immediately in memory
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().setAccessToken(accessToken);
        // Step 3: Fetch /auth/me with the NEW access token
        const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["authApi"].me();
        if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().sessionRevision !== revision) throw new AuthIdentityError('Session transition superseded');
        // Step 4: Identity validation safeguard
        if (!user || expectedEmail && user.email.toLowerCase() !== expectedEmail.toLowerCase()) {
            throw new AuthIdentityError(`Session identity mismatch: expected ${expectedEmail}, got ${user?.email}`);
        }
        // Step 5: Establish new session and active company
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().setSession(accessToken, user);
        const firstCompanyId = user.memberships[0]?.companyId ?? null;
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$company$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCompanyStore"].getState().setActiveCompanyId(firstCompanyId);
        // Step 6: Clear query cache again for clean state & reconnect socket
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$query$2d$provider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["queryClient"].clear();
        if (!user.mustChangePassword) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ws$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["connectSocket"])();
        return user;
    } catch (err) {
        if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().sessionRevision !== revision) throw err;
        // On failure, ensure total teardown
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ws$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["disconnectSocket"])();
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$company$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCompanyStore"].getState().clearCompanyState();
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().clearSession();
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$query$2d$provider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["queryClient"].clear();
        throw err;
    }
}
function clearSessionAtomic() {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ws$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["disconnectSocket"])();
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$company$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCompanyStore"].getState().clearCompanyState();
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$store$2f$auth$2d$store$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuthStore"].getState().clearSession();
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$providers$2f$query$2d$provider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["queryClient"].clear();
}
}),
];

//# sourceMappingURL=src_lib_auth-session_ts_0v0yuot._.js.map