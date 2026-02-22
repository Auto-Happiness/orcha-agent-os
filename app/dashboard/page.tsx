"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
    const { user, activeOrg, isLoading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        }
    }, [isLoading, user, router]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ background: "#07050f" }}>
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#9333ea" strokeWidth="4" />
                        <path className="opacity-75" fill="#9333ea" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center" style={{ background: "#07050f" }}>
            <div className="text-center space-y-4">
                <div className="text-4xl">🎉</div>
                <h1 className="text-2xl font-bold text-white">Welcome, {user?.name}!</h1>
                {activeOrg && (
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Workspace: <span style={{ color: "#a855f7" }}>{activeOrg.name}</span>
                    </p>
                )}
                <button
                    onClick={logout}
                    className="mt-4 px-6 py-2 rounded-lg text-sm font-medium text-white transition-all"
                    style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", boxShadow: "0 0 20px rgba(147,51,234,0.4)" }}
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}
