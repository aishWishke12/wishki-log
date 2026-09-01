import { cookies } from "next/headers";

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

/** Renews the access token from the stored refresh token (admin-panel: /auth/refresh-token). */
export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const rawEnv = store.get(ENV_COOKIE)?.value;
  const env = isEnvKey(rawEnv) ? rawEnv : DEFAULT_ENV;

  if (!refreshToken) {
    clearSessionCookies(store);
    return Response.json(
      { success: false, message: "No refresh token." },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(apiUrl(env, "/auth/refresh-token"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
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
  const session = unwrapLogin(data);

  if (!upstream.ok || !session.token) {
    clearSessionCookies(store);
    return Response.json(
      { success: false, message: "Session expired." },
      { status: 401 },
    );
  }

  writeSessionCookies(store, {
    env,
    token: session.token,
    refreshToken: session.refresh_token ?? refreshToken,
    expiresIn: session.expires_in ?? null,
  });

  return Response.json({ success: true });
}
