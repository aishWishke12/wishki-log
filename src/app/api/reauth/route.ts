import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  apiUrl,
  clearSessionCookies,
  DEFAULT_ENV,
  ENV_COOKIE,
  isEnvKey,
  REFRESH_COOKIE,
  unwrapLogin,
  writeSessionCookies,
  type StaffLoginResponse,
} from "@/lib/auth-shared";

/**
 * Hit via redirect when the access token is rejected mid-render.
 * Tries one refresh; on success returns to the app, otherwise to /login.
 */
export async function GET(request: NextRequest) {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const rawEnv = store.get(ENV_COOKIE)?.value;
  const env = isEnvKey(rawEnv) ? rawEnv : DEFAULT_ENV;

  const bail = () => {
    clearSessionCookies(store);
    return Response.redirect(new URL("/login", request.url));
  };

  if (!refreshToken) return bail();

  try {
    const upstream = await fetch(apiUrl(env, "/auth/refresh-token"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = (await upstream
      .json()
      .catch(() => null)) as StaffLoginResponse | null;
    const session = unwrapLogin(data);
    if (!upstream.ok || !session.token) return bail();

    writeSessionCookies(store, {
      env,
      token: session.token,
      refreshToken: session.refresh_token ?? refreshToken,
      expiresIn: session.expires_in ?? null,
    });
    return Response.redirect(new URL("/?reauthed=1", request.url));
  } catch {
    return bail();
  }
}
