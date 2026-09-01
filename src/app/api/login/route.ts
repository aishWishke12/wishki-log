import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  apiUrl,
  DEFAULT_ENV,
  isEnvKey,
  readMfaChallenge,
  unwrapLogin,
  writeSessionCookies,
  type StaffLoginResponse,
} from "@/lib/auth-shared";

/**
 * Mirrors the admin panel's two-step `/staff/login` flow:
 *  - step 1: { env, email, password, mfa? }  -> may return an MFA challenge
 *  - step 2: { env, mfaSessionToken, mfa }   -> completes the challenge
 */
export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { success: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const env = isEnvKey(payload.env) ? payload.env : DEFAULT_ENV;
  const mfa = typeof payload.mfa === "string" ? payload.mfa.trim() : "";
  const mfaSessionToken =
    typeof payload.mfaSessionToken === "string" ? payload.mfaSessionToken : "";

  let body: Record<string, unknown>;
  if (mfaSessionToken) {
    if (mfa.length !== 6) {
      return Response.json(
        { success: false, message: "Enter the 6-digit MFA code." },
        { status: 400 },
      );
    }
    body = { mfa_session_token: mfaSessionToken, mfa };
  } else {
    const email =
      typeof payload.email === "string" ? payload.email.trim() : "";
    const password =
      typeof payload.password === "string" ? payload.password : "";
    if (!email || !password) {
      return Response.json(
        { success: false, message: "Email and password are required." },
        { status: 400 },
      );
    }
    body = { provider: "password", email, password, ...(mfa ? { mfa } : {}) };
  }

  let upstream: Response;
  try {
    upstream = await fetch(apiUrl(env, "/staff/login"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json(
      { success: false, message: "Could not reach the auth server." },
      { status: 502 },
    );
  }

  const data = (await upstream
    .json()
    .catch(() => null)) as StaffLoginResponse | null;

  if (!upstream.ok) {
    return Response.json(
      {
        success: false,
        message:
          data?.message ??
          unwrapLogin(data).message ??
          `Login failed (${upstream.status}).`,
      },
      { status: upstream.status === 401 ? 401 : 502 },
    );
  }

  const challenge = readMfaChallenge(data);
  if (challenge) {
    return Response.json({
      success: false,
      mfaRequired: true,
      mfaSessionToken: challenge.mfaSessionToken,
    });
  }

  const session = unwrapLogin(data);
  if (!session.token) {
    return Response.json(
      { success: false, message: "Auth server did not return a token." },
      { status: 502 },
    );
  }

  writeSessionCookies(await cookies(), {
    env,
    token: session.token,
    refreshToken: session.refresh_token ?? null,
    expiresIn: session.expires_in ?? null,
  });

  return Response.json({ success: true, env });
}
