import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  apiUrl,
  clearSessionCookies,
  DEFAULT_ENV,
  ENV_COOKIE,
  isEnvKey,
  TOKEN_COOKIE,
} from "@/lib/auth-shared";

async function endSession() {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const rawEnv = store.get(ENV_COOKIE)?.value;
  const env = isEnvKey(rawEnv) ? rawEnv : DEFAULT_ENV;

  // Best-effort backend logout; never blocks clearing local cookies.
  if (token) {
    try {
      await fetch(apiUrl(env, "/staff/logout"), {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }

  clearSessionCookies(store);
}

export async function POST() {
  await endSession();
  return Response.json({ success: true });
}

/** GET is used for hard redirects (e.g. an expired token mid-render). */
export async function GET(request: NextRequest) {
  await endSession();
  return Response.redirect(new URL("/login", request.url));
}
