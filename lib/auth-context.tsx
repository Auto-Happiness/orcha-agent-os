"use client";

/**
 * auth-context.tsx
 *
 * Uses Convex's `makeFunctionReference` instead of importing from
 * `_generated/api` — so this compiles before running `convex dev`.
 * Once you run `convex dev` and the generated files exist, you can
 * swap these references for the type-safe generated `api` object.
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

const SESSION_KEY = "orcha_session_token";
const ACTIVE_ORG_KEY = "orcha_active_org";

// ─── Function references (no _generated needed) ───────────────────────────

const authLogin = makeFunctionReference<
    "mutation",
    { email: string; password: string },
    { token: string; userId: string }
>("auth:login");

const authRegister = makeFunctionReference<
    "mutation",
    { name: string; email: string; password: string; organizationName?: string },
    { token: string; userId: string; organizationId: string }
>("auth:register");

const authLogout = makeFunctionReference<
    "mutation",
    { token: string },
    { success: boolean }
>("auth:logout");

const authGetSession = makeFunctionReference<
    "query",
    { token: string },
    {
        user: {
            _id: string;
            name: string;
            email: string;
            avatarUrl?: string;
            emailVerified: boolean;
        };
        organizations: Array<{
            _id: string;
            name: string;
            slug: string;
            plan: "free" | "pro" | "enterprise";
            memberRole: "owner" | "admin" | "member";
        }>;
    } | null
>("auth:getSession");

// ─── Types ────────────────────────────────────────────────────────────────

export type OrchaUser = {
    _id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    emailVerified: boolean;
};

export type OrchaOrg = {
    _id: string;
    name: string;
    slug: string;
    plan: "free" | "pro" | "enterprise";
    memberRole: "owner" | "admin" | "member";
};

type AuthContextType = {
    user: OrchaUser | null;
    organizations: OrchaOrg[];
    activeOrg: OrchaOrg | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string, orgName?: string) => Promise<void>;
    logout: () => Promise<void>;
    switchOrg: (org: OrchaOrg) => void;
};

// ─── Context ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [activeOrg, setActiveOrg] = useState<OrchaOrg | null>(null);
    const [hydrated, setHydrated] = useState(false);

    // Convex mutations & queries
    const loginMutation = useMutation(authLogin);
    const registerMutation = useMutation(authRegister);
    const logoutMutation = useMutation(authLogout);

    // Restore token from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) setToken(stored);
        setHydrated(true);
    }, []);

    // Validate session reactively — skipped when token is null
    const sessionData = useQuery(
        authGetSession,
        token ? { token } : "skip"
    );

    // Sync active org whenever session data changes
    useEffect(() => {
        const orgs = sessionData?.organizations as OrchaOrg[] | undefined;
        if (orgs?.length) {
            const storedId = localStorage.getItem(ACTIVE_ORG_KEY);
            const found = (storedId ? orgs.find((o) => o._id === storedId) : null) ?? orgs[0];
            setActiveOrg(found);
        } else {
            setActiveOrg(null);
        }
    }, [sessionData]);

    // ─── Actions ──────────────────────────────────────────────────────────

    const login = useCallback(
        async (email: string, password: string) => {
            const result = await loginMutation({ email, password });
            localStorage.setItem(SESSION_KEY, result.token);
            setToken(result.token);
        },
        [loginMutation]
    );

    const register = useCallback(
        async (name: string, email: string, password: string, orgName?: string) => {
            const result = await registerMutation({
                name,
                email,
                password,
                organizationName: orgName,
            });
            localStorage.setItem(SESSION_KEY, result.token);
            setToken(result.token);
        },
        [registerMutation]
    );

    const logout = useCallback(async () => {
        if (token) {
            try { await logoutMutation({ token }); } catch { /* ignore */ }
        }
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(ACTIVE_ORG_KEY);
        setToken(null);
        setActiveOrg(null);
    }, [logoutMutation, token]);

    const switchOrg = useCallback((org: OrchaOrg) => {
        setActiveOrg(org);
        localStorage.setItem(ACTIVE_ORG_KEY, org._id);
    }, []);

    // isLoading: before hydration, OR token exists but session query still pending
    const isLoading = !hydrated || (!!token && sessionData === undefined);

    const value: AuthContextType = {
        user: (sessionData?.user as OrchaUser | null | undefined) ?? null,
        organizations: (sessionData?.organizations as OrchaOrg[] | undefined) ?? [],
        activeOrg,
        token,
        isLoading,
        login,
        register,
        logout,
        switchOrg,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
