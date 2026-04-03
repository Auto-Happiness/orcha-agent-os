"use client";

import { useState } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";

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
      <div className="absolute inset-0 overflow-hidden opacity-[0.14]">
        <svg className="absolute w-full" style={{ height: "200%", top: "-50%" }}>
          <defs>
            <pattern id="pg" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#9333ea" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pg)" />
        </svg>
      </div>

      <div className="absolute top-[30%] left-[45%] -translate-x-1/2 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(147,51,234,0.28) 0%, transparent 68%)" }} />
      <div className="absolute bottom-[25%] left-[30%] w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(192,132,252,0.18) 0%, transparent 70%)" }} />

      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="eg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        <g stroke="url(#eg)" opacity="0.28" strokeWidth="1">
          <line x1="20%" y1="28%" x2="42%" y2="44%" />
          <line x1="42%" y1="44%" x2="66%" y2="34%" />
          <line x1="66%" y1="34%" x2="80%" y2="54%" />
          <line x1="42%" y1="44%" x2="54%" y2="64%" />
          <line x1="54%" y1="64%" x2="76%" y2="70%" />
          <line x1="28%" y1="60%" x2="54%" y2="64%" />
          <line x1="20%" y1="28%" x2="28%" y2="60%" />
          <line x1="50%" y1="18%" x2="66%" y2="34%" />
          <line x1="80%" y1="28%" x2="80%" y2="54%" />
          <line x1="20%" y1="28%" x2="80%" y2="70%"
            stroke="#c084fc" strokeWidth="1.2" opacity="0.4" strokeDasharray="12 8" />
        </g>
        {[
          { cx: "20%", cy: "28%", r: 6, primary: true },
          { cx: "42%", cy: "44%", r: 8, primary: false },
          { cx: "50%", cy: "50%", r: 12, primary: true, hub: true },
          { cx: "66%", cy: "34%", r: 7, primary: false },
          { cx: "80%", cy: "54%", r: 5, primary: true },
          { cx: "54%", cy: "64%", r: 7, primary: false },
          { cx: "28%", cy: "60%", r: 5, primary: false },
          { cx: "50%", cy: "18%", r: 5, primary: true },
          { cx: "80%", cy: "28%", r: 5, primary: false },
        ].map(({ cx, cy, r, primary, hub }, i) => (
          <g key={i}>
            {hub && <circle cx={cx} cy={cy} r={r * 2.2} fill="none" stroke="#9333ea" strokeWidth="1" opacity="0.22" />}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={primary ? "#9333ea" : "#c084fc"} strokeWidth="1.5" opacity="0.75" />
            <circle cx={cx} cy={cy} r={r * 0.48} fill={primary ? "#9333ea" : "#c084fc"} opacity="0.95" />
          </g>
        ))}
      </svg>

      <div className="relative z-10 flex flex-col justify-between h-full p-10">
        <div className="flex items-center gap-3">
          <OrchaLogo size={38} />
          <div>
            <p className="text-white font-semibold text-base leading-none tracking-wide">Orcha</p>
            <p className="text-[10px] leading-none tracking-[0.15em] font-medium mt-0.5" style={{ color: "#c084fc" }}>AGENT OS</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#a855f7" }}>
            Next-generation AI orchestration
          </span>
          <h1 className="text-4xl xl:text-[2.75rem] font-bold leading-[1.15] text-white">
            We Orcha-strate<br />
            <span style={{ background: "linear-gradient(90deg, #9333ea, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              your systems.
            </span>
          </h1>
          <p className="text-sm leading-relaxed max-w-[300px]" style={{ color: "rgba(255,255,255,0.48)" }}>
            Build AI workflows visually with LangChain and LangGraph. No code required — deploy in one click.
          </p>
        </div>

        <div className="flex gap-8">
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

      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: "linear-gradient(to top, #07040f 0%, transparent 100%)" }} />
    </div>
  );
}

/* ─── Clerk appearance ───────────────────────────────────────────────────── */

const clerkAppearance = {
  variables: {
    colorPrimary: "#9333ea",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.045)",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "rgba(255,255,255,0.5)",
    colorNeutral: "#ffffff",
    borderRadius: "0.6rem",
    fontFamily: "inherit",
  },
  elements: {
    // Card / root
    card: "bg-transparent shadow-none border-none p-0 w-full",
    rootBox: "w-full",
    cardBox: "w-full",

    // Header
    headerTitle: "text-white text-2xl font-bold",
    headerSubtitle: "text-white/40 text-sm",

    // Social buttons
    socialButtonsBlockButton:
      "bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors rounded-lg h-11",
    socialButtonsBlockButtonText: "text-white/90 font-medium text-sm",
    socialButtonsBlockButtonArrow: "hidden",
    providerIcon__google: "w-5 h-5",

    // Divider
    dividerLine: "bg-white/5",
    dividerText: "text-white/20 text-[10px] uppercase tracking-[0.2em]",

    // Form
    formFieldLabel: "text-white/70 text-[13px] font-medium",
    formFieldInput:
      "bg-white/5 border border-white/10 text-white rounded-lg h-11 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/60 placeholder:text-white/20",
    formFieldInputShowPasswordButton: "text-white/30 hover:text-white/60",

    // Submit button
    formButtonPrimary:
      "bg-gradient-to-r from-purple-600 to-violet-700 hover:opacity-90 h-11 font-semibold text-sm transition-all rounded-lg shadow-[0_0_28px_rgba(147,51,234,0.45)]",

    // Footer link
    footerActionLink: "text-purple-400 hover:text-purple-300",
    footerActionText: "text-white/30 text-xs",
    footer: "hidden",

    // Error / Alert
    formFieldErrorText: "text-red-400 text-[12px] mt-1 font-medium",
    alert: "rounded-lg p-3 text-[12px] font-medium",
    alertText: "text-[12px] font-medium",
    alertTextDanger: "text-red-400",
    alertTextWarning: "text-amber-400",
    // Internal links
    formFieldAction: "text-purple-400 hover:text-purple-300 text-xs",
    identityPreviewEditButton: "text-purple-400",
  },
};

/* ─── Auth pane ─────────────────────────────────────────────────────────── */

function AuthPane() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-8 lg:px-16 overflow-y-auto"
      style={{ background: "#07050f" }}
    >
      <div className="w-full max-w-[420px]">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <OrchaLogo size={34} />
          <div>
            <p className="text-white font-semibold text-sm leading-none">Orcha</p>
            <p className="text-[9px] tracking-[0.15em] font-medium" style={{ color: "#c084fc" }}>AGENT OS</p>
          </div>
        </div>

        {/* Mode pill toggle */}
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            id="auth-tab-login"
            type="button"
            onClick={() => setMode("login")}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
            style={mode === "login"
              ? { background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", boxShadow: "0 0 16px rgba(147,51,234,0.4)" }
              : { color: "rgba(255,255,255,0.4)" }}
          >
            Sign In
          </button>
          <button
            id="auth-tab-register"
            type="button"
            onClick={() => setMode("register")}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
            style={mode === "register"
              ? { background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", boxShadow: "0 0 16px rgba(147,51,234,0.4)" }
              : { color: "rgba(255,255,255,0.4)" }}
          >
            Register
          </button>
        </div>

        {/* Clerk component */}
        <div className="w-full">
          {mode === "login" ? (
            <SignIn
              appearance={clerkAppearance}
              routing="hash"
              signUpUrl="/#register"
              forceRedirectUrl="/redirect"
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              routing="hash"
              signInUrl="/#login"
              forceRedirectUrl="/home"
            />
          )}
        </div>
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
