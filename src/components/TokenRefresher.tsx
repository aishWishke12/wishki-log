"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { EXPIRY_COOKIE } from "@/lib/auth-shared";

const CHECK_INTERVAL_MS = 60_000;
/** Renew when the access token has under this long to live. */
const RENEW_LEAD_MS = 5 * 60_000;

function readExpiry(): number | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${EXPIRY_COOKIE}=`));
  if (!match) return null;
  const n = Number(match.slice(EXPIRY_COOKIE.length + 1));
  return Number.isFinite(n) ? n : null;
}

/**
 * Mirrors the admin panel's useTokenRefresh: proactively swaps the access token
 * before it expires, and on refresh failure sends the user back to /login.
 */
export function TokenRefresher() {
  const router = useRouter();
  const busy = useRef(false);

  const tick = useCallback(async () => {
    if (busy.current) return;
    const expiry = readExpiry();
    if (expiry === null) return;
    if (expiry - Date.now() > RENEW_LEAD_MS) return;

    busy.current = true;
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else if (res.status === 401) {
        window.location.href = "/login";
      }
    } catch {
      // transient network issue — try again on the next tick
    } finally {
      busy.current = false;
    }
  }, [router]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);

  return null;
}
