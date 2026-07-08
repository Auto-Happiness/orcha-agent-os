"use client";

import { useState, useEffect } from "react";
import { SignIn, SignUp, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMantineColorScheme } from "@mantine/core";
import { ThemeToggle } from "@/components/ThemeToggle";

/* ─── Orcha Logo ─────────────────────────────────────────────────────────── */

function OrchaLogo({ size = 36 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img 
        src="/graphics/orca ai 2.png" 
        alt="Orcha Logo" 
        style={{ width: "100%", height: "100%", objectFit: "contain" }} 
      />
    </div>
  );
}

/* ─── Hero pane ─────────────────────────────────────────────────────────── */

function HeroPane({ isDark }: { isDark: boolean }) {
  const bg = isDark
    ? "linear-gradient(135deg, #07040f 0%, #0f0720 60%, #150830 100%)"
    : "linear-gradient(135deg, #f7f5ff 0%, #eae6f8 60%, #e2daf5 100%)";
  const titleColor = isDark ? "text-white" : "text-slate-900";
  const descColor = isDark ? "rgba(255,255,255,0.48)" : "rgba(15,23,42,0.64)";
  const labelColor = isDark ? "#a855f7" : "#7c3aed";
  const patternStroke = isDark ? "#9333ea" : "#c084fc";
  const dotColorPrimary = isDark ? "#9333ea" : "#7c3aed";
  const dotColorSecondary = isDark ? "#c084fc" : "#a855f7";

  return (
    <div
      className="relative hidden lg:flex flex-col w-[52%] h-full overflow-hidden select-none"
      style={{ background: bg }}
    >
      <div className="absolute inset-0 overflow-hidden opacity-[0.14]">
        <svg className="absolute w-full" style={{ height: "200%", top: "-50%" }}>
          <defs>
            <pattern id="pg" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke={patternStroke} strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pg)" />
        </svg>
      </div>

      <div className="absolute top-[30%] left-[45%] -translate-x-1/2 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: isDark ? "radial-gradient(circle, rgba(147,51,234,0.28) 0%, transparent 68%)" : "radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 68%)" }} />
      <div className="absolute bottom-[25%] left-[30%] w-64 h-64 rounded-full pointer-events-none"
        style={{ background: isDark ? "radial-gradient(circle, rgba(192,132,252,0.18) 0%, transparent 70%)" : "radial-gradient(circle, rgba(192,132,252,0.1) 0%, transparent 70%)" }} />

      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="eg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={dotColorPrimary} />
            <stop offset="100%" stopColor={dotColorSecondary} />
          </linearGradient>
        </defs>
        <g stroke="url(#eg)" opacity={isDark ? "0.28" : "0.38"} strokeWidth="1">
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
            stroke={dotColorSecondary} strokeWidth="1.2" opacity="0.4" strokeDasharray="12 8" />
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
            {hub && <circle cx={cx} cy={cy} r={r * 2.2} fill="none" stroke={dotColorPrimary} strokeWidth="1" opacity="0.22" />}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={primary ? dotColorPrimary : dotColorSecondary} strokeWidth="1.5" opacity="0.75" />
            <circle cx={cx} cy={cy} r={r * 0.48} fill={primary ? dotColorPrimary : dotColorSecondary} opacity="0.95" />
          </g>
        ))}
      </svg>

      <div className="relative z-10 flex flex-col h-full p-10">
        <div className="flex items-center gap-3 shrink-0">
          <OrchaLogo size={38} />
          <div>
            <p className={`${titleColor} font-semibold text-base leading-none tracking-wide`}>Orcha</p>
            <p className="text-[10px] leading-none tracking-[0.15em] font-medium mt-0.5" style={{ color: dotColorSecondary }}>AGENT OS</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-4 max-w-[540px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: labelColor }}>
            Next-generation AI orchestration
          </span>
          <h1 className={`text-4xl xl:text-[2.75rem] font-bold leading-[1.12] ${titleColor}`}>
            The Agentic<br />
            <span style={{ background: "linear-gradient(90deg, #9333ea, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Operating System.
            </span>
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: descColor }}>
            A next-generation platform designed to bridge the gap between raw data warehouses and intelligent AI agents.
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: isDark ? "linear-gradient(to top, #07040f 0%, transparent 100%)" : "linear-gradient(to top, #f7f5ff 0%, transparent 100%)" }} />
    </div>
  );
}

/* ─── Clerk appearance builder ───────────────────────────────────────────── */

function getClerkAppearance(isDark: boolean) {
  return {
    variables: {
      colorPrimary: "#9333ea",
      colorBackground: "transparent",
      colorInputBackground: isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.03)",
      colorInputText: isDark ? "#ffffff" : "#1f2937",
      colorText: isDark ? "#ffffff" : "#1f2937",
      colorTextSecondary: isDark ? "rgba(255,255,255,0.5)" : "rgba(31,41,55,0.6)",
      colorNeutral: isDark ? "#ffffff" : "#1f2937",
      borderRadius: "0.6rem",
      fontFamily: "inherit",
    },
    elements: {
      card: "bg-transparent shadow-none border-none p-0 w-full",
      rootBox: "w-full",
      cardBox: "w-full",

      headerTitle: isDark ? "text-white text-2xl font-bold" : "text-slate-800 text-2xl font-bold",
      headerSubtitle: isDark ? "text-white/40 text-sm" : "text-slate-500 text-sm",

      socialButtonsBlockButton: isDark
        ? "bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors rounded-lg h-11"
        : "bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 transition-colors rounded-lg h-11",
      socialButtonsBlockButtonText: isDark ? "text-white/90 font-medium text-sm" : "text-slate-700 font-medium text-sm",
      socialButtonsBlockButtonArrow: "hidden",
      providerIcon__google: "w-5 h-5",

      dividerLine: isDark ? "bg-white/5" : "bg-slate-200",
      dividerText: isDark ? "text-white/20 text-[10px] uppercase tracking-[0.2em]" : "text-slate-400 text-[10px] uppercase tracking-[0.2em]",

      formFieldLabel: isDark ? "text-white/70 text-[13px] font-medium" : "text-slate-700 text-[13px] font-medium",
      formFieldInput: isDark
        ? "bg-white/5 border border-white/10 text-white rounded-lg h-11 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/60 placeholder:text-white/20"
        : "bg-slate-50 border border-slate-200 text-slate-800 rounded-lg h-11 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/60 placeholder:text-slate-400",
      formFieldInputShowPasswordButton: isDark ? "text-white/30 hover:text-white/60" : "text-slate-400 hover:text-slate-600",

      formButtonPrimary:
        "bg-gradient-to-r from-purple-600 to-violet-700 hover:opacity-90 h-11 font-semibold text-sm transition-all rounded-lg shadow-[0_0_28px_rgba(147,51,234,0.3)]",

      footerActionLink: isDark ? "text-purple-400 hover:text-purple-300" : "text-purple-600 hover:text-purple-500",
      footerActionText: isDark ? "text-white/30 text-xs" : "text-slate-500 text-xs",
      footer: "hidden",

      formFieldErrorText: "text-red-500 text-[12px] mt-1 font-medium",
      alert: "rounded-lg p-3 text-[12px] font-medium",
      alertText: "text-[12px] font-medium",
      alertTextDanger: "text-red-500",
      alertTextWarning: "text-amber-600",
      formFieldAction: isDark ? "text-purple-400 hover:text-purple-300 text-xs" : "text-purple-600 hover:text-purple-500 text-xs",
      identityPreviewEditButton: isDark ? "text-purple-400" : "text-purple-600",
    },
  };
}

/* ─── Auth pane ─────────────────────────────────────────────────────────── */

function AuthPane({ isDark }: { isDark: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // Safe client-side redirect to avoid Next.js hydration errors
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/redirect");
    }
  }, [isLoaded, isSignedIn, router]);

  const bg = isDark ? "#07050f" : "#fcfbfe";
  const textColor = isDark ? "text-white" : "text-slate-900";
  const logoSubText = isDark ? "#c084fc" : "#7c3aed";

  if (!isLoaded || isSignedIn) {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ background: bg }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#9333ea" strokeWidth="4" />
            <path className="opacity-75" fill="#9333ea" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.5)" }}>Loading secure environment…</p>
        </div>
      </div>
    );
  }

  const clerkAppearance = getClerkAppearance(isDark);

  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-8 lg:px-16 overflow-y-auto"
      style={{ background: bg }}
    >
      <div className="w-full max-w-[420px]">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <OrchaLogo size={34} />
          <div>
            <p className={`${textColor} font-semibold text-sm leading-none`}>Orcha</p>
            <p className="text-[9px] tracking-[0.15em] font-medium" style={{ color: logoSubText }}>AGENT OS</p>
          </div>
        </div>

        {/* Mode pill toggle */}
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={
          isDark 
            ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }
            : { background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)" }
        }>
          <button
            id="auth-tab-login"
            type="button"
            onClick={() => setMode("login")}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200"
            style={mode === "login"
              ? { background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", boxShadow: "0 0 16px rgba(147,51,234,0.4)" }
              : { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.5)" }}
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
              : { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.5)" }}
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
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              routing="hash"
              signInUrl="/#login"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page root ─────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const { colorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Force dark mode (isDark = true) during SSR / hydration to match defaultColorScheme="dark"
  const isDark = !mounted ? true : colorScheme === "dark";
  const bg = isDark ? "#07050f" : "#fcfbfe";

  return (
    <main className="flex h-screen w-full overflow-hidden relative" style={{ background: bg }}>
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <HeroPane isDark={isDark} />
      <AuthPane isDark={isDark} />
    </main>
  );
}
