import { redirect } from "next/navigation";

import { LogViewer, type LogViewerPagination } from "@/components/LogViewer";
import { TokenRefresher } from "@/components/TokenRefresher";
import { getSession } from "@/lib/auth";
import {
  fetchLogs,
  LogsAuthError,
  parseApiDateParam,
  parseLimitFromSearch,
} from "@/lib/logs";
import type { LogRecord } from "@/types/log";

export const dynamic = "force-dynamic";

type RawSearch = Record<string, string | string[] | undefined>;

function pick(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawSearch>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const sp = await searchParams;
  const alreadyReauthed = pick(sp.reauthed) === "1";

  const limit = parseLimitFromSearch(pick(sp.limit));

  const startRaw = pick(sp.startDate)?.trim() ?? "";
  const endRaw = pick(sp.endDate)?.trim() ?? "";

  const appliedStartDate = startRaw ? parseApiDateParam(startRaw) : null;
  const appliedEndDate = endRaw ? parseApiDateParam(endRaw) : null;

  let logs: LogRecord[] = [];
  let pagination: LogViewerPagination | null = null;
  let error: string | null = null;

  try {
    const json = await fetchLogs({
      apiBase: session.apiBase,
      token: session.token,
      limit,
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
      // Try a refresh once; if we've already been through it, hard logout.
      redirect(alreadyReauthed ? "/api/logout" : "/api/reauth");
    }
    error = e instanceof Error ? e.message : "Failed to load logs.";
  }

  return (
    <>
      <TokenRefresher />
      <LogViewer
        logs={logs}
        error={error}
        pagination={pagination}
        appliedLimit={limit}
        appliedStartDate={appliedStartDate}
        appliedEndDate={appliedEndDate}
        env={session.env}
        apiBase={session.apiBase}
      />
    </>
  );
}
