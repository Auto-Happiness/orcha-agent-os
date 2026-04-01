import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#07050f" }}>
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#9333ea" strokeWidth="4" />
          <path className="opacity-75" fill="#9333ea" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Finalizing login…</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
