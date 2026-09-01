"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ClipboardEvent } from "react";

const ENV_OPTIONS = [
  { key: "staging", label: "Staging", host: "api.wishki.in" },
  { key: "prod", label: "Production", host: "api.wishki.com" },
] as const;

type EnvKey = (typeof ENV_OPTIONS)[number]["key"];
type Step = "credentials" | "mfa";

const EMPTY_MFA = ["", "", "", "", "", ""];

export default function LoginPage() {
  const router = useRouter();
  const [env, setEnv] = useState<EnvKey>("staging");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState<string[]>(EMPTY_MFA);
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mfaRefs = useRef<Array<HTMLInputElement | null>>([]);

  const host = ENV_OPTIONS.find((o) => o.key === env)?.host;

  async function callLogin(payload: Record<string, unknown>) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env, ...payload }),
    });
    return (await res.json().catch(() => null)) as
      | { success: boolean; message?: string; mfaRequired?: boolean; mfaSessionToken?: string }
      | null;
  }

  function goToApp() {
    router.replace("/");
    router.refresh();
  }

  async function onCredentialsSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const code = mfa.join("").trim();
      const data = await callLogin({
        email,
        password,
        ...(code.length === 6 ? { mfa: code } : {}),
      });
      if (!data) {
        setError("Login failed.");
        return;
      }
      if (data.mfaRequired && data.mfaSessionToken) {
        setMfaSessionToken(data.mfaSessionToken);
        setMfa(EMPTY_MFA);
        setStep("mfa");
        return;
      }
      if (!data.success) {
        setError(data.message ?? "Login failed.");
        return;
      }
      goToApp();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onMfaSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    const code = mfa.join("").trim();
    if (code.length !== 6) {
      setError("Enter the 6-digit MFA code.");
      return;
    }
    if (!mfaSessionToken) {
      setError("MFA session expired. Sign in again.");
      setStep("credentials");
      return;
    }
    setBusy(true);
    try {
      const data = await callLogin({ mfaSessionToken, mfa: code });
      if (!data?.success) {
        setError(data?.message ?? "MFA verification failed.");
        return;
      }
      goToApp();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function setMfaDigit(index: number, value: string) {
    if (value && !/^[0-9]$/.test(value)) return;
    setMfa((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < 5) mfaRefs.current[index + 1]?.focus();
  }

  function onMfaKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !mfa[index] && index > 0) {
      e.preventDefault();
      mfaRefs.current[index - 1]?.focus();
      setMfa((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    }
  }

  function onMfaPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(text)) return;
    e.preventDefault();
    setMfa(text.split(""));
    mfaRefs.current[5]?.focus();
  }

  const inputClass =
    "font-mono box-border min-h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[13px] outline-none focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-zinc-300/95 dark:border-zinc-700 dark:bg-black/52 dark:text-zinc-100 dark:focus-visible:ring-sky-500/40";
  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500";

  const mfaBoxes = (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>MFA code</span>
      <div className="flex gap-2">
        {mfa.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              mfaRefs.current[idx] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => setMfaDigit(idx, e.target.value)}
            onKeyDown={(e) => onMfaKeyDown(idx, e)}
            onPaste={onMfaPaste}
            disabled={busy}
            className="font-mono h-11 w-full rounded-xl border border-zinc-300 bg-white text-center text-[15px] tabular-nums outline-none focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-zinc-300/95 dark:border-zinc-700 dark:bg-black/52 dark:text-zinc-100 dark:focus-visible:ring-sky-500/40"
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-100 px-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200/95 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
        <p className="text-[16px] font-bold text-zinc-500 dark:text-zinc-400">
          {step === "credentials"
            ? "Admin sign in"
            : "Enter the code from your authenticator app"}
        </p>

        {step === "credentials" ? (
          <form onSubmit={onCredentialsSubmit} className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 p-0.5 dark:border-zinc-700">
                {ENV_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setEnv(opt.key)}
                    className={`rounded-lg px-2 py-1.5 text-[12px] font-semibold transition ${
                      env === opt.key
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </label>

            {mfaBoxes}
            <p className="text-[10px] leading-snug text-zinc-400">
              Optional here for single-step login — otherwise you&apos;ll be asked
              after the password check.
            </p>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-950/78 dark:bg-red-950/45 dark:text-red-100"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="font-mono mt-1 box-border min-h-10 w-full rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={onMfaSubmit} className="mt-5 flex flex-col gap-3">
            {mfaBoxes}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-950/78 dark:bg-red-950/45 dark:text-red-100"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="font-mono mt-1 box-border min-h-10 w-full rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("credentials");
                setMfaSessionToken(null);
                setMfa(EMPTY_MFA);
                setError(null);
              }}
              className="box-border min-h-10 w-full rounded-xl border border-zinc-300 px-4 py-2 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
