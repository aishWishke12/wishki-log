import { cookies } from "next/headers";

import {
  apiBaseForEnv,
  DEFAULT_ENV,
  ENV_COOKIE,
  isEnvKey,
  REFRESH_COOKIE,
  TOKEN_COOKIE,
  type EnvKey,
} from "@/lib/auth-shared";

export * from "@/lib/auth-shared";

export type Session = {
  token: string;
  refreshToken: string | null;
  env: EnvKey;
  apiBase: string;
};

/** Reads the signed-in session from cookies. Returns null when not logged in. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  const rawEnv = store.get(ENV_COOKIE)?.value;
  const env: EnvKey = isEnvKey(rawEnv) ? rawEnv : DEFAULT_ENV;
  return {
    token,
    refreshToken: store.get(REFRESH_COOKIE)?.value ?? null,
    env,
    apiBase: apiBaseForEnv(env),
  };
}
