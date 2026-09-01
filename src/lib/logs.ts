import moment from "moment-timezone";

import type { LogsApiResponse } from "@/types/log";

export const DEFAULT_LOG_LIMIT = 1000;
export const LOG_LIMIT_MIN = 50;
export const LOG_LIMIT_MAX = 10000;

/** Thrown when the logs API rejects the bearer token (401/403). */
export class LogsAuthError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "LogsAuthError";
  }
}

export type FetchLogsOptions = {
  /** API origin for the chosen environment, e.g. https://api.wishki.in */
  apiBase: string;
  /** Bearer token from admin login. */
  token: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export function clampLogLimit(raw: number | undefined): number {
  const d = DEFAULT_LOG_LIMIT;
  if (raw === undefined || Number.isNaN(raw) || !Number.isFinite(raw)) {
    return d;
  }
  return Math.min(
    LOG_LIMIT_MAX,
    Math.max(LOG_LIMIT_MIN, Math.floor(raw)),
  );
}

export function parseLimitFromSearch(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_LOG_LIMIT;
  return clampLogLimit(Number.parseInt(raw, 10));
}

/** Accepts decoded query param; returns canonical UTC ISO or null if unusable. */
export function parseApiDateParam(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return null;
  }
  const s = raw.trim();
  const strict = moment.utc(s, moment.ISO_8601, true);
  if (strict.isValid()) return strict.toISOString();
  const loose = moment(s);
  return loose.isValid() ? loose.toISOString() : null;
}

export async function fetchLogs(
  opts: FetchLogsOptions,
): Promise<LogsApiResponse> {
  const limit = clampLogLimit(opts.limit);
  const u = new URL("/api/logs", opts.apiBase);
  u.searchParams.set("limit", String(limit));

  const start =
    opts.startDate && opts.startDate.trim() !== ""
      ? parseApiDateParam(opts.startDate)
      : null;
  const end =
    opts.endDate && opts.endDate.trim() !== ""
      ? parseApiDateParam(opts.endDate)
      : null;

  if (start) u.searchParams.set("startDate", start);
  if (end) u.searchParams.set("endDate", end);

  const res = await fetch(u.toString(), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new LogsAuthError();
  }

  if (!res.ok) {
    throw new Error(`Logs API returned ${res.status}`);
  }

  return res.json() as Promise<LogsApiResponse>;
}

/** `datetime-local` value without timezone · treated as IST. */
export function istDatetimeLocalToUtcIso(display: string): string | null {
  const t = display.trim();
  if (!t) return null;

  const m = moment.tz(
    t,
    [
      "YYYY-MM-DDTHH:mm:ss.SSS",
      "YYYY-MM-DDTHH:mm:ss",
      "YYYY-MM-DDTHH:mm",
    ],
    true,
    "Asia/Kolkata",
  );
  return m.isValid() ? m.toISOString() : null;
}

export function utcIsoToIstDatetimeLocal(isoUtc: string): string {
  const m = moment.utc(isoUtc, moment.ISO_8601, true);
  if (!m.isValid()) return "";
  return m.tz("Asia/Kolkata").format("YYYY-MM-DDTHH:mm:ss");
}

export function formatUtcPointIst(isoUtc: string | null): string {
  if (!isoUtc) return "—";
  const m = moment.utc(isoUtc, moment.ISO_8601, true);
  if (!m.isValid()) return isoUtc;
  return m.tz("Asia/Kolkata").format("D MMM YYYY, HH:mm:ss z");
}

/** API timestamps shown in IST for consistent formatting. */
export function formatLogDateTime(iso: string): string {
  const m = moment(iso).tz("Asia/Kolkata");
  if (!m.isValid()) return iso;

  return m.format("dddd, D MMMM YYYY · h:mm:ss A z");
}
