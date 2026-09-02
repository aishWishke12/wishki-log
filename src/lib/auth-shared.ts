/**
 * Auth constants and pure helpers — safe to import from anywhere
 * (client components, proxy/middleware, route handlers).
 * Nothing here touches `next/headers`.
 */

export const API_ENVIRONMENTS = {
  staging: { label: "Staging", apiBase: "https://api.wishki.in" },
  prod: { label: "Production", apiBase: "https://api.wishki.com" },
} as const;

export type EnvKey = keyof typeof API_ENVIRONMENTS;

export const DEFAULT_ENV: EnvKey = "staging";

export const TOKEN_COOKIE = "wl_token";
export const REFRESH_COOKIE = "wl_refresh";
export const ENV_COOKIE = "wl_env";
/** Non-httpOnly: lets the client-side refresher know when to renew. */
export const EXPIRY_COOKIE = "wl_exp";

/** 7 days, in seconds — outer bound for the cookies themselves. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function isEnvKey(value: unknown): value is EnvKey {
  return typeof value === "string" && value in API_ENVIRONMENTS;
}

export function apiBaseForEnv(env: EnvKey): string {
  return API_ENVIRONMENTS[env].apiBase;
}

/** Full backend URL for a route path like `/staff/login` or `/logs`. */
export function apiUrl(env: EnvKey, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseForEnv(env)}/api${p}`;
}

type CookieWriter = {
  set: (name: string, value: string, opts?: Record<string, unknown>) => void;
  delete: (name: string) => void;
};

/** Writes the session cookies. Only valid inside a Route Handler / Server Action. */
export function writeSessionCookies(
  store: CookieWriter,
  input: {
    env: EnvKey;
    token: string;
    refreshToken?: string | null;
    /** seconds until the access token expires */
    expiresIn?: number | null;
  },
) {
  const secure = process.env.NODE_ENV === "production";
  const base = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
  store.set(TOKEN_COOKIE, input.token, base);
  store.set(ENV_COOKIE, input.env, base);
  if (input.refreshToken) {
    store.set(REFRESH_COOKIE, input.refreshToken, base);
  }
  const ttl = input.expiresIn && input.expiresIn > 0 ? input.expiresIn : 3600;
  store.set(EXPIRY_COOKIE, String(Date.now() + ttl * 10000), {
    ...base,
    httpOnly: false,
  });
}

export function clearSessionCookies(store: CookieWriter) {
  for (const name of [TOKEN_COOKIE, REFRESH_COOKIE, ENV_COOKIE, EXPIRY_COOKIE]) {
    store.delete(name);
  }
}

/**
 * The `/staff/login` response can be flat or wrapped in `data`, and may be
 * either an authenticated session or an MFA challenge.
 */
export type StaffLoginResponse = {
  success?: boolean;
  message?: string;
  mfa_required?: boolean;
  mfa_session_token?: string;
  token?: string;
  refresh_token?: string;
  expires_in?: number;
  data?: StaffLoginResponse;
};

export function unwrapLogin(
  raw: StaffLoginResponse | null | undefined,
): StaffLoginResponse {
  return (raw?.data ?? raw) || {};
}

export function readMfaChallenge(
  raw: StaffLoginResponse | null | undefined,
): { mfaSessionToken: string } | null {
  const d = unwrapLogin(raw);
  const required = Boolean(d.mfa_required ?? raw?.mfa_required);
  if (!required) return null;
  const mfaSessionToken = d.mfa_session_token || raw?.mfa_session_token;
  if (!mfaSessionToken) return null;
  return { mfaSessionToken };
}
