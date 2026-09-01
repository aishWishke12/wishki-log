import { redirect } from "next/navigation";

import type { LogViewerPagination } from "@/components/LogViewer";
import { getSession, type Session } from "@/lib/auth";
import {
  fetchLogs,
  getServiceNames,
  LogsAuthError,
  parseApiDateParam,
  parseLimitFromSearch,
} from "@/lib/logs";
import type { LogRecord } from "@/types/log";

export type RawSearch = Record<string, string | string[] | undefined>;

export function pick(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export type LogsPageData = {
  session: Session;
  /** Every log in the current fetch window — not filtered by service. */
  logs: LogRecord[];
  pagination: LogViewerPagination | null;
  error: string | null;
  /** Full service roster, independent of the current fetch window. */
  allServices: string[];
  /** Log count per service within the current fetch window. */
  serviceCounts: Record<string, number>;
  appliedLimit: number;
  appliedStartDate: string | null;
  appliedEndDate: string | null;
};

/**
 * Shared loader for the "all logs" page and the per-service pages. Both read the
 * same fetch window (limit + date range from the query string); the per-service
 * pages just narrow the resulting list themselves.
 */
export async function loadLogsPage(sp: RawSearch): Promise<LogsPageData> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const alreadyReauthed = pick(sp.reauthed) === "1";

  const appliedLimit = parseLimitFromSearch(pick(sp.limit));

  const startRaw = pick(sp.startDate)?.trim() ?? "";
  const endRaw = pick(sp.endDate)?.trim() ?? "";

  const appliedStartDate = startRaw ? parseApiDateParam(startRaw) : null;
  const appliedEndDate = endRaw ? parseApiDateParam(endRaw) : null;

  let logs: LogRecord[] = [];
  let pagination: LogViewerPagination | null = null;
  let error: string | null = null;
  let allServices: string[] = [];

  try {
    const json = await fetchLogs({
      apiBase: session.apiBase,
      token: session.token,
      limit: appliedLimit,
      startDate: appliedStartDate ?? undefined,
      endDate: appliedEndDate ?? undefined,
    });
    if (json.success && Array.isArray(json.data)) {
      logs = json.data;
      if (json.pagination) {
        pagination = json.pagination as LogViewerPagination;
      }
    } else {
      error = "Unexpected API response.";
    }
  } catch (e) {
    if (e instanceof LogsAuthError) {
      redirect(alreadyReauthed ? "/api/logout" : "/api/reauth");
    }
    error = e instanceof Error ? e.message : "Failed to load logs.";
  }

  try {
    allServices = await getServiceNames({
      apiBase: session.apiBase,
      token: session.token,
    });
  } catch {
    // Roster is optional — pages fall back to the current window's services.
  }

  const serviceCounts: Record<string, number> = {};
  for (const l of logs) {
    if (l.service) {
      serviceCounts[l.service] = (serviceCounts[l.service] ?? 0) + 1;
    }
  }

  return {
    session,
    logs,
    pagination,
    error,
    allServices,
    serviceCounts,
    appliedLimit,
    appliedStartDate,
    appliedEndDate,
  };
}
