import { LogViewer, type LogViewerPagination } from "@/components/LogViewer";
import {
  fetchLogs,
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
  const sp = await searchParams;

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
    error = e instanceof Error ? e.message : "Failed to load logs.";
  }

  return (
    <LogViewer
      logs={logs}
      error={error}
      pagination={pagination}
      appliedLimit={limit}
      appliedStartDate={appliedStartDate}
      appliedEndDate={appliedEndDate}
    />
  );
}
