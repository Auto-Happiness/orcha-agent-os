"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ─── Inline icons (no extra deps) ─────────────────────────────────────── */

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ─── Orcha Logo ─────────────────────────────────────────────────────────── */

function OrchaLogo({ size = 36 }: { size?: number }) {
  const id = `lg-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="17" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="18" cy="18" r="10" stroke={`url(#${id})`} strokeWidth="1.5" opacity="0.45" />
      <path d="M18 8 L22 14 L18 12 L14 14 Z" fill={`url(#${id})`} />
      <path d="M18 28 L14 22 L18 24 L22 22 Z" fill={`url(#${id})`} opacity="0.65" />
      <circle cx="18" cy="18" r="3" fill={`url(#${id})`} />
      <defs>
        <linearGradient id={id} x1="1" y1="1" x2="35" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9333ea" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Hero pane ─────────────────────────────────────────────────────────── */

function HeroPane() {
  return (
    <div
      className="relative hidden lg:flex flex-col w-[52%] h-full overflow-hidden select-none"
      style={{ background: "linear-gradient(135deg, #07040f 0%, #0f0720 60%, #150830 100%)" }}
    >
      {/* Scrolling grid */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.14]">
        <svg className="absolute w-full animate-grid" style={{ height: "200%", top: "-50%" }}>
          <defs>
            <pattern id="pg" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#9333ea" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pg)" />
        </svg>
      </div>

      {/* Ambient glows */}
      <div className="absolute top-[30%] left-[45%] -translate-x-1/2 w-[420px] h-[420px] rounded-full animate-glow pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(147,51,234,0.28) 0%, transparent 68%)" }} />
      <div className="absolute bottom-[25%] left-[30%] w-64 h-64 rounded-full animate-glow pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(192,132,252,0.18) 0%, transparent 70%)", animationDelay: "1.8s" }} />

      {/* Neural network SVG */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="eg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        {/* Edges */}
        <g stroke="url(#eg)" opacity="0.28" strokeWidth="1">
          <line x1="20%" y1="28%" x2="42%" y2="44%" />
          <line x1="42%" y1="44%" x2="66%" y2="34%" />
          <line x1="66%" y1="34%" x2="80%" y2="54%" />
          <line x1="42%" y1="44%" x2="54%" y2="64%" />
          <line x1="54%" y1="64%" x2="76%" y2="70%" />
          <line x1="28%" y1="60%" x2="54%" y2="64%" />
          <line x1="20%" y1="28%" x2="28%" y2="60%" />
          <line x1="66%" y1="34%" x2="54%" y2="64%" />
          <line x1="50%" y1="18%" x2="66%" y2="34%" />
          <line x1="50%" y1="18%" x2="42%" y2="44%" />
          <line x1="80%" y1="28%" x2="80%" y2="54%" />
          <line x1="66%" y1="34%" x2="80%" y2="28%" />
          <line x1="14%" y1="72%" x2="28%" y2="60%" />
          {/* Animated travel line */}
          <line x1="20%" y1="28%" x2="80%" y2="70%"
            stroke="#c084fc" strokeWidth="1.2" opacity="0.4"
            strokeDasharray="12 8" className="animate-dash" />
        </g>

        {/* Nodes */}
        {[
          { cx: "20%", cy: "28%", r: 6, cls: "animate-float-1", primary: true },
          { cx: "42%", cy: "44%", r: 8, cls: "animate-float-2", primary: false },
          { cx: "50%", cy: "50%", r: 12, cls: "animate-pulse-ring", primary: true, hub: true },
          { cx: "66%", cy: "34%", r: 7, cls: "animate-float-3", primary: false },
          { cx: "80%", cy: "54%", r: 5, cls: "animate-float-4", primary: true },
          { cx: "54%", cy: "64%", r: 7, cls: "animate-float-5", primary: false },
          { cx: "28%", cy: "60%", r: 5, cls: "animate-float-6", primary: false },
          { cx: "50%", cy: "18%", r: 5, cls: "animate-float-1", primary: true },
          { cx: "80%", cy: "28%", r: 5, cls: "animate-float-3", primary: false },
          { cx: "76%", cy: "70%", r: 5, cls: "animate-float-4", primary: false },
          { cx: "14%", cy: "72%", r: 4, cls: "animate-float-2", primary: true },
        ].map(({ cx, cy, r, cls, primary, hub }, i) => (
          <g key={i} className={cls}>
            {hub && <circle cx={cx} cy={cy} r={r * 2.2} fill="none" stroke="#9333ea" strokeWidth="1" opacity="0.22" />}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={primary ? "#9333ea" : "#c084fc"} strokeWidth="1.5" opacity="0.75" />
            <circle cx={cx} cy={cy} r={r * 0.48} fill={primary ? "#9333ea" : "#c084fc"} opacity="0.95" />
          </g>
        ))}
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-10">
        {/* Logo */}
        <div className="flex items-center gap-3 animate-fade-up">
          <OrchaLogo size={38} />
          <div>
            <p className="text-white font-semibold text-base leading-none tracking-wide">Orcha</p>
            <p className="text-[10px] leading-none tracking-[0.15em] font-medium mt-0.5" style={{ color: "#c084fc" }}>AGENT OS</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="flex flex-col gap-4">
          <span className="animate-fade-up-d1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#a855f7" }}>
            Next-generation AI orchestration
          </span>
          <h1 className="animate-fade-up-d2 text-4xl xl:text-[2.75rem] font-bold leading-[1.15] text-white">
            We Orcha-strate<br />
            <span style={{ background: "linear-gradient(90deg, #9333ea, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              your systems.
            </span>
          </h1>
          <p className="animate-fade-up-d3 text-sm leading-relaxed max-w-[300px]" style={{ color: "rgba(255,255,255,0.48)" }}>
            Build AI workflows visually with LangChain and LangGraph. No code required — deploy in one click.
          </p>
        </div>

        {/* Bottom stats */}
        <div className="flex gap-8 animate-fade-up-d3">
          {[
            { label: "AI Workflows", value: "10K+" },
            { label: "Organizations", value: "500+" },
            { label: "Uptime", value: "99.9%" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white font-bold text-xl">{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: "linear-gradient(to top, #07040f 0%, transparent 100%)" }} />
    </div>
  );
}

/* ─── Field wrapper ──────────────────────────────────────────────────────── */

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ─── Input styles ───────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "0.6rem",
  color: "#fff",
};

/* ─── Auth pane ─────────────────────────────────────────────────────────── */

type AuthMode = "login" | "register";

function AuthPane() {
  const router = useRouter();
  const { login: authLogin, register: authRegister } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (isRegister) {
      if (!name) { setError("Please enter your full name."); return; }
      if (password !== confirmPwd) { setError("Passwords do not match."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        await authRegister(name, email, password, orgName || undefined);
      } else {
        await authLogin(email, password);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-10 lg:px-16 overflow-y-auto"
      style={{ background: "#07050f" }}
    >
      <div className="w-full max-w-[420px] animate-fade-up">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <OrchaLogo size={34} />
          <div>
            <p className="text-white font-semibold text-sm leading-none">Orcha</p>
            <p className="text-[9px] tracking-[0.15em] font-medium" style={{ color: "#c084fc" }}>AGENT OS</p>
          </div>
        </div>

        {/* Header */}
        <div className="mb-7">
          <h2 className="text-[1.75rem] font-bold text-white leading-tight">
            {isRegister ? "Create your account" : "Sign In"}
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {isRegister
              ? "Start building AI workflows for free"
              : "Enter your details to continue"}
          </p>
        </div>

        {/* Mode toggle pills */}
        <div className="flex gap-1 p-1 rounded-xl mb-7" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["login", "register"] as AuthMode[]).map((m) => (
            <button
              key={m}
              id={`auth-tab-${m}`}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
              style={mode === m
                ? { background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", boxShadow: "0 0 16px rgba(147,51,234,0.4)" }
                : { color: "rgba(255,255,255,0.4)" }}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">

          {/* Register-only fields */}
          {isRegister && (
            <>
              <Field label="Full Name" htmlFor="input-name">
                <Input
                  id="input-name"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="h-11 placeholder:text-white/20 focus-visible:ring-purple-500/60 focus-visible:ring-2 focus-visible:ring-offset-0"
                  style={inputStyle}
                />
              </Field>
              <Field label="Organization Name (optional)" htmlFor="input-org">
                <Input
                  id="input-org"
                  type="text"
                  placeholder="Acme Corp Workspace"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="h-11 placeholder:text-white/20 focus-visible:ring-purple-500/60 focus-visible:ring-2 focus-visible:ring-offset-0"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {/* Email */}
          <Field label="Email" htmlFor="input-email">
            <Input
              id="input-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-11 placeholder:text-white/20 focus-visible:ring-purple-500/60 focus-visible:ring-2 focus-visible:ring-offset-0"
              style={inputStyle}
            />
          </Field>

          {/* Password */}
          <Field label="Password" htmlFor="input-password">
            <div className="relative">
              <Input
                id="input-password"
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="h-11 pr-11 placeholder:text-white/20 focus-visible:ring-purple-500/60 focus-visible:ring-2 focus-visible:ring-offset-0"
                style={inputStyle}
              />
              <button
                id="toggle-password"
                type="button"
                aria-label={showPwd ? "Hide password" : "Show password"}
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#a855f7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              >
                {showPwd ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {/* Confirm password (register) */}
          {isRegister && (
            <Field label="Confirm Password" htmlFor="input-confirm-password">
              <div className="relative">
                <Input
                  id="input-confirm-password"
                  type={showPwd2 ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 pr-11 placeholder:text-white/20 focus-visible:ring-purple-500/60 focus-visible:ring-2 focus-visible:ring-offset-0"
                  style={inputStyle}
                />
                <button
                  id="toggle-confirm-password"
                  type="button"
                  onClick={() => setShowPwd2((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#a855f7"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
                >
                  {showPwd2 ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          )}

          {/* Forgot password (login only) */}
          {!isRegister && (
            <div className="flex justify-end -mt-1">
              <Link href="/forgot-password" id="forgot-password-link"
                className="text-[13px] transition-colors"
                style={{ color: "#a855f7" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c084fc"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a855f7"; }}>
                Forgot Password?
              </Link>
            </div>
          )}

          {/* Error */}
          {error && (
            <p id="auth-error" className="text-[13px] px-3 py-2.5 rounded-lg"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-lg font-semibold text-white text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-1"
            style={
              isLoading
                ? { background: "rgba(147,51,234,0.5)", cursor: "not-allowed" }
                : {
                  background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)",
                  boxShadow: "0 0 28px rgba(147,51,234,0.45)",
                }
            }
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 36px rgba(147,51,234,0.65)";
                (e.currentTarget as HTMLElement).style.opacity = "0.93";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(147,51,234,0.45)";
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
          >
            {isLoading ? (
              <><SpinnerIcon /> {isRegister ? "Creating account…" : "Signing in…"}</>
            ) : (
              isRegister ? "Create Account →" : "Sign In →"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Switch mode */}
        <p className="text-center text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
          {isRegister ? "Already have an account? " : "Don\u2019t have an account? "}
          <button
            id="auth-mode-switch"
            type="button"
            onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}
            className="font-medium transition-colors"
            style={{ color: "#a855f7" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c084fc"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a855f7"; }}
          >
            {isRegister ? "Sign In" : "Sign Up"}
          </button>
        </p>

        {/* ToS note */}
        {isRegister && (
          <p className="text-center text-[11px] mt-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.22)" }}>
            By creating an account you agree to our{" "}
            <a href="https://www.orcha-solutions.com/terms-of-service" target="_blank" className="underline" style={{ color: "rgba(255,255,255,0.38)" }}>Terms of Service</a>{" "}
            and{" "}
            <a href="https://www.orcha-solutions.com/privacy-policy" target="_blank" className="underline" style={{ color: "rgba(255,255,255,0.38)" }}>Privacy Policy</a>.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Page root ─────────────────────────────────────────────────────────── */

export default function LoginPage() {
  return (
    <main className="flex h-screen w-full overflow-hidden" style={{ background: "#07050f" }}>
      <HeroPane />
      <AuthPane />
    </main>
  );
}
