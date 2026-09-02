"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import moment from "moment-timezone";

import { LogsFetchControls } from "@/components/LogsFetchControls";
import { MetadataObjectView } from "@/components/MetadataObjectView";
import { ServiceTabs } from "@/components/ServiceTabs";
import { formatUtcPointIst } from "@/lib/logs";
import type { LogRecord } from "@/types/log";

export type LogViewerPagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type LogViewerProps = {
  logs: LogRecord[];
  error: string | null;
  pagination: LogViewerPagination | null;
  appliedLimit: number;
  appliedStartDate: string | null;
  appliedEndDate: string | null;
  env: string;
  apiBase: string;
  /** Full service roster, independent of the current fetch window. */
  allServices: string[];
  /** Log count per service within the current fetch window. */
  serviceCounts: Record<string, number>;
  /** Non-null when viewing a single service's page. */
  activeService: string | null;
};

async function logout() {
  try {
    await fetch("/api/logout", { method: "POST" });
  } finally {
    window.location.href = "/login";
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLogSearchHaystack(
  log: LogRecord,
  includeMetadataJson: boolean,
): string {
  const base = `${log.message}\n${log.service}\n${log.level}`;
  if (!includeMetadataJson) return base;
  const m = log.metadata;
  if (m && typeof m === "object" && Object.keys(m).length > 0) {
    try {
      return `${base}\n${JSON.stringify(m)}`;
    } catch {
      return base;
    }
  }
  return base;
}

function matchesClientQuery(
  haystack: string,
  rawQuery: string,
  matchCase: boolean,
  wholeWord: boolean,
): boolean {
  const q = rawQuery.trim();
  if (!q) return true;
  if (!wholeWord) {
    const h = matchCase ? haystack : haystack.toLowerCase();
    const n = matchCase ? q : q.toLowerCase();
    return h.includes(n);
  }
  try {
    const flags = matchCase ? "gu" : "giu";
    return new RegExp(`\\b${escapeRegExp(q)}\\b`, flags).test(haystack);
  } catch {
    return false;
  }
}

function normalizeLevel(level: string): string {
  return level.toLowerCase().trim();
}

function borderAccentClass(level: string): string {
  const l = normalizeLevel(level);
  if (l === "error") return "border-red-500";
  if (l === "warn" || l === "warning") return "border-amber-500";
  if (l === "info") return "border-sky-500";
  if (l === "debug") return "border-zinc-400";
  return "border-violet-500";
}

function LevelChip({
  active,
  count,
  label,
  onClick,
  tone,
  chipClassName = "",
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
  tone: "neutral" | "error" | "warn" | "info" | "debug";
  chipClassName?: string;
}) {
  const toneRing =
    tone === "error"
      ? "ring-red-500/25 data-[active=true]:bg-red-500/15 data-[active=true]:ring-red-500/40 data-[active=true]:text-red-900 dark:data-[active=true]:text-red-200"
      : tone === "warn"
        ? "ring-amber-500/25 data-[active=true]:bg-amber-500/15 data-[active=true]:ring-amber-500/35 data-[active=true]:text-amber-950 dark:data-[active=true]:text-amber-100"
        : tone === "info"
          ? "ring-sky-500/25 data-[active=true]:bg-sky-500/15 data-[active=true]:ring-sky-500/35 data-[active=true]:text-sky-950 dark:data-[active=true]:text-sky-100"
          : tone === "debug"
            ? "ring-zinc-400/30 data-[active=true]:bg-zinc-500/12 data-[active=true]:ring-zinc-500/30 data-[active=true]:text-zinc-900 dark:data-[active=true]:text-zinc-100"
            : "ring-zinc-400/25 data-[active=true]:bg-zinc-500/12 data-[active=true]:text-zinc-900 dark:data-[active=true]:text-zinc-50";

  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={`flex min-h-[68px] w-full min-w-0 flex-col items-start rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2.5 text-left shadow-sm backdrop-blur-sm ring-1 ring-inset ring-transparent transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800/90 dark:bg-zinc-950/65 dark:hover:border-zinc-700 dark:hover:bg-zinc-950 ${toneRing} ${chipClassName}`}
      aria-pressed={active}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500">
        {label}
      </span>
      <span className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 md:text-2xl">
        {count}
      </span>
    </button>
  );
}

function LogEntryCard({ log, index }: { log: LogRecord; index: number }) {
  const [metaOpen, setMetaOpen] = useState(false);
  const iso = log.timestamp || log.createdAt;
  const compactIst =
    iso && moment(iso).isValid()
      ? moment(iso).tz("Asia/Kolkata").format("D MMM, HH:mm:ss")
      : "—";
  const borderAccent = borderAccentClass(log.level);
  const idShort =
    log._id.length >= 14 ? `${log._id.slice(0, 8)}…${log._id.slice(-5)}` : log._id;
  const levelTone = normalizeLevel(log.level);
  const hasMeta =
    !!log.metadata &&
    typeof log.metadata === "object" &&
    Object.keys(log.metadata).length > 0;

  const levelBadgeClass =
    levelTone === "error"
      ? "bg-red-500/14 text-red-800 ring-red-500/30 dark:text-red-200"
      : levelTone === "warn" || levelTone === "warning"
        ? "bg-amber-500/14 text-amber-950 ring-amber-500/35 dark:text-amber-100"
        : levelTone === "info"
          ? "bg-sky-500/14 text-sky-950 ring-sky-500/35 dark:text-sky-100"
          : levelTone === "debug"
            ? "bg-zinc-500/14 text-zinc-800 ring-zinc-500/35 dark:text-zinc-300"
            : "bg-violet-500/14 text-violet-950 ring-violet-500/30 dark:text-violet-100";

  return (
    <article
      className="group overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xs ring-1 ring-transparent transition-all hover:border-zinc-300 hover:shadow-sm hover:ring-black/[0.04] dark:border-zinc-800/80 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:ring-white/[0.06]"
      aria-labelledby={`log-${log._id}-message`}
    >
      <div className={`border-l-[3px] px-3 py-2 ${borderAccent}`}>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] leading-tight">
          <span className="shrink-0 font-mono tabular-nums text-zinc-300 dark:text-zinc-600">
            #{index + 1}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${levelBadgeClass}`}
          >
            {log.level}
          </span>
          <span className="min-w-0 shrink font-mono font-medium tracking-tight text-zinc-800 dark:text-zinc-200">
            {log.service}
          </span>
          <span className="hidden shrink-0 text-zinc-300 sm:inline dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <time
            dateTime={iso}
            title={iso}
            className="shrink-0 font-mono text-[10px] tabular-nums tracking-tight text-zinc-500 dark:text-zinc-500"
          >
            {compactIst}
            &nbsp;IST
          </time>
          <span
            className="ml-auto min-w-0 max-w-[8rem] shrink-0 truncate font-mono text-[9px] text-zinc-400 dark:text-zinc-600 sm:max-w-[11rem]"
            title={`${iso}\n${log._id}`}
          >
            {idShort}
          </span>
        </div>

        <p
          id={`log-${log._id}-message`}
          className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-zinc-900 dark:text-zinc-100"
        >
          {log.message}
        </p>
      </div>

      {hasMeta && (
        <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800/80">
          <MetadataObjectView
            value={log.metadata}
            className="mt-0"
            open={metaOpen}
            onOpenChange={setMetaOpen}
          />
        </div>
      )}
    </article>
  );
}

export function LogViewer({
  logs: initialLogs,
  error,
  pagination,
  appliedLimit,
  appliedStartDate,
  appliedEndDate,
  env,
  apiBase,
  allServices,
  serviceCounts,
  activeService,
}: LogViewerProps) {
  const apiHost = apiBase.replace(/^https?:\/\//, "");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [excludedServices, setExcludedServices] = useState<string[]>([]);
  const [servicePickFilter, setServicePickFilter] = useState("");
  const [metadataOnly, setMetadataOnly] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [searchMetadata, setSearchMetadata] = useState(false);

  const counts = useMemo(() => {
    let errorN = 0;
    let warnN = 0;
    let infoN = 0;
    let debugN = 0;
    for (const log of initialLogs) {
      const L = normalizeLevel(log.level);
      if (L === "error") errorN += 1;
      else if (L === "warn" || L === "warning") warnN += 1;
      else if (L === "info") infoN += 1;
      else if (L === "debug") debugN += 1;
    }
    return {
      total: initialLogs.length,
      error: errorN,
      warn: warnN,
      info: infoN,
      debug: debugN,
    };
  }, [initialLogs]);

  const uniqueServices = useMemo(() => {
    const set = new Set<string>(allServices.filter(Boolean));
    for (const l of initialLogs) {
      if (l.service) set.add(l.service);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allServices, initialLogs]);

  useEffect(() => {
    setExcludedServices((prev) =>
      prev.filter((s) => uniqueServices.includes(s)),
    );
  }, [uniqueServices]);

  const servicesPickList = useMemo(() => {
    const q = servicePickFilter.trim().toLowerCase();
    if (!q) return uniqueServices;
    return uniqueServices.filter((s) => s.toLowerCase().includes(q));
  }, [uniqueServices, servicePickFilter]);

  const clientFiltersDefault =
    levelFilter === "all" &&
    deferredQuery.trim() === "" &&
    excludedServices.length === 0 &&
    !metadataOnly &&
    !matchCase &&
    !wholeWord &&
    !searchMetadata &&
    sortOrder === "desc";

  const filteredSorted = useMemo(() => {
    const rows = initialLogs.filter((log) => {
      if (excludedServices.includes(log.service)) return false;
      if (metadataOnly) {
        const m = log.metadata;
        if (
          !m ||
          typeof m !== "object" ||
          Object.keys(m as object).length === 0
        ) {
          return false;
        }
      }
      if (levelFilter !== "all") {
        const L = normalizeLevel(log.level);
        if (levelFilter === "warn" && L !== "warn" && L !== "warning") {
          return false;
        }
        if (levelFilter !== "warn" && L !== levelFilter) return false;
      }
      const hay = buildLogSearchHaystack(log, searchMetadata);
      return matchesClientQuery(hay, deferredQuery, matchCase, wholeWord);
    });

    return [...rows].sort((a, b) => {
      const ta = moment(a.timestamp || a.createdAt).valueOf();
      const tb = moment(b.timestamp || b.createdAt).valueOf();
      if (Number.isNaN(ta) || Number.isNaN(tb)) {
        const c = String(a._id).localeCompare(b._id);
        return sortOrder === "asc" ? c : -c;
      }
      return sortOrder === "asc" ? ta - tb : tb - ta;
    });
  }, [
    initialLogs,
    deferredQuery,
    levelFilter,
    excludedServices,
    metadataOnly,
    matchCase,
    wholeWord,
    searchMetadata,
    sortOrder,
  ]);

  function toggleServiceShown(svc: string) {
    setExcludedServices((prev) =>
      prev.includes(svc)
        ? prev.filter((x) => x !== svc)
        : [...prev, svc].sort((a, b) => a.localeCompare(b)),
    );
  }

  function exportVisibleJson() {
    const blob = new Blob([JSON.stringify(filteredSorted, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wishki-logs-visible-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAllClientFilters() {
    startTransition(() => {
      setLevelFilter("all");
      setQuery("");
      setExcludedServices([]);
      setMetadataOnly(false);
      setMatchCase(false);
      setWholeWord(false);
      setSearchMetadata(false);
      setSortOrder("desc");
      setServicePickFilter("");
    });
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 md:flex-row">
      {/* Left (top on narrow) · filters & API */}
      <aside
        className="flex max-h-[min(48vh,24rem)] min-h-0 w-full shrink-0 flex-col border-b border-zinc-200/80 bg-zinc-50/98 dark:border-zinc-800/80 dark:bg-zinc-950/90 md:max-h-none md:h-full md:w-[min(100vw,24rem)] md:border-r md:border-b-0 lg:w-[26rem] xl:w-[28.5rem]"
        aria-label="Filters"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 md:px-4 md:py-4">
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200/80 bg-white/90 px-3 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-950/70">
              <p className="flex items-center gap-1.5 truncate font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]"
                  aria-hidden
                />
                <span className="truncate">{apiHost}/api/logs</span>
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
                  limit {appliedLimit}
                </span>
                {pagination && (
                  <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
                    {pagination.total} total · {pagination.page}/{pagination.pages}
                  </span>
                )}
              </p>
              {(appliedStartDate || appliedEndDate) && (
                <p className="mt-2 space-y-0.5 border-t border-dashed border-zinc-200 pt-2 font-mono text-[10px] leading-tight text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  <span className="block truncate">{formatUtcPointIst(appliedStartDate)}</span>
                  <span className="block truncate">{formatUtcPointIst(appliedEndDate)}</span>
                </p>
              )}
            </div>

            <LogsFetchControls
              appliedLimit={appliedLimit}
              appliedStartDate={appliedStartDate}
              appliedEndDate={appliedEndDate}
            />
            
            <details
              open
              className="rounded-xl border border-zinc-200/90 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Sort · options
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex gap-1 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setSortOrder("desc")}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${
                      sortOrder === "desc"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    ↓ New
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder("asc")}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${
                      sortOrder === "asc"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    ↑ Old
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-1.5 dark:border-zinc-800 dark:bg-black/35">
                    <input
                      type="checkbox"
                      checked={metadataOnly}
                      onChange={(e) => setMetadataOnly(e.target.checked)}
                      className="size-3 rounded border-zinc-400"
                    />
                    <span className="text-[11px] text-zinc-800 dark:text-zinc-200">
                      Has meta
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-1.5 dark:border-zinc-800 dark:bg-black/35">
                    <input
                      type="checkbox"
                      checked={searchMetadata}
                      onChange={(e) => setSearchMetadata(e.target.checked)}
                      className="size-3 rounded border-zinc-400"
                    />
                    <span className="text-[11px] text-zinc-800 dark:text-zinc-200">
                      Search meta
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-1.5 dark:border-zinc-800 dark:bg-black/35">
                    <input
                      type="checkbox"
                      checked={matchCase}
                      onChange={(e) => setMatchCase(e.target.checked)}
                      className="size-3 rounded border-zinc-400"
                    />
                    <span className="text-[11px] text-zinc-800 dark:text-zinc-200">
                      Match case
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-1.5 dark:border-zinc-800 dark:bg-black/35">
                    <input
                      type="checkbox"
                      checked={wholeWord}
                      onChange={(e) => setWholeWord(e.target.checked)}
                      className="size-3 rounded border-zinc-400"
                    />
                    <span className="text-[11px] text-zinc-800 dark:text-zinc-200">
                      Whole word
                    </span>
                  </label>
                </div>
              </div>
            </details>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Level
                </span>
                <button
                  type="button"
                  onClick={() => exportVisibleJson()}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  title="JSON"
                >
                  JSON
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LevelChip
                  label="All"
                  count={filteredSorted.length}
                  active={clientFiltersDefault}
                  tone="neutral"
                  onClick={() => resetAllClientFilters()}
                />
                <LevelChip
                  label="Error"
                  count={counts.error}
                  active={levelFilter === "error"}
                  tone="error"
                  onClick={() => {
                    startTransition(() => {
                      setLevelFilter(
                        levelFilter === "error" ? "all" : "error",
                      );
                    });
                  }}
                />
                <LevelChip
                  label="Warn"
                  count={counts.warn}
                  active={levelFilter === "warn"}
                  tone="warn"
                  onClick={() => {
                    startTransition(() => {
                      setLevelFilter(levelFilter === "warn" ? "all" : "warn");
                    });
                  }}
                />
                <LevelChip
                  label="Info"
                  count={counts.info}
                  active={levelFilter === "info"}
                  tone="info"
                  onClick={() => {
                    startTransition(() => {
                      setLevelFilter(levelFilter === "info" ? "all" : "info");
                    });
                  }}
                />
                <LevelChip
                  label="Debug"
                  count={counts.debug}
                  tone="debug"
                  active={levelFilter === "debug"}
                  onClick={() => {
                    startTransition(() => {
                      setLevelFilter(
                        levelFilter === "debug" ? "all" : "debug",
                      );
                    });
                  }}
                  chipClassName="col-span-2"
                />
              </div>
            </div>

            <details
              open
              className="rounded-xl border border-zinc-200/90 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Search
              </summary>
              <label className="mt-2 flex flex-col gap-1">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="grep…"
                  className="font-mono w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[13px] outline-none placeholder:text-zinc-400 ring-zinc-300/75 focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-zinc-300/95 dark:border-zinc-700 dark:bg-black/42 dark:text-zinc-50 dark:focus-visible:ring-sky-500/40 dark:placeholder:text-zinc-600"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </details>

            {activeService === null && (
            <details
              open
              className="rounded-xl border border-zinc-200/90 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Services&nbsp;
                <span className="font-mono lowercase text-zinc-400">
                  {uniqueServices.length - excludedServices.length}/{uniqueServices.length}
                </span>
              </summary>
              <input
                type="search"
                value={servicePickFilter}
                onChange={(e) => setServicePickFilter(e.target.value)}
                placeholder="…"
                className="font-mono mb-2 mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-[12px] dark:border-zinc-700 dark:bg-black/42 dark:text-zinc-100"
                spellCheck={false}
              />
              <div className="mb-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setExcludedServices([])}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  All on
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExcludedServices([...uniqueServices].sort((a, b) => a.localeCompare(b)))
                  }
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  All off
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExcludedServices((prev) =>
                      uniqueServices
                        .filter((s) => !prev.includes(s))
                        .sort((a, b) => a.localeCompare(b)),
                    )
                  }
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Invert
                </button>
              </div>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-black/35">
                {servicesPickList.length === 0 ? (
                  <p className="py-3 text-center text-[10px] text-zinc-500">
                    ∅
                  </p>
                ) : (
                  servicesPickList.map((svc) => {
                    const checked = !excludedServices.includes(svc);
                    return (
                      <label
                        key={svc}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-white/90 dark:hover:bg-zinc-900"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleServiceShown(svc)}
                          className="size-3.5 shrink-0 rounded border-zinc-400"
                        />
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-800 dark:text-zinc-300">
                          {svc}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </details>
            )}
          </div>
        </div>
      </aside>

      {/* Right · log stream (below filters on narrow screens) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-zinc-200 dark:border-zinc-800">
        <header className="shrink-0 border-b border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {activeService && (
                <span
                  className="shrink-0 text-[13px] text-zinc-300 dark:text-zinc-600"
                  aria-hidden
                >
                  Logs /
                </span>
              )}
              <h1 className="min-w-0 truncate text-base font-semibold tracking-tight md:text-lg">
                {activeService ?? "Logs"}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                  env === "prod"
                    ? "bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-200"
                    : "bg-amber-500/12 text-amber-800 ring-amber-500/30 dark:text-amber-100"
                }`}
                title={apiHost}
              >
                {env === "prod" ? "prod" : "staging"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] tabular-nums text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                {error ? "—" : `${filteredSorted.length} / ${initialLogs.length}`}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <ServiceTabs
          services={allServices}
          counts={serviceCounts}
          activeService={activeService}
        />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 md:px-5 md:py-4">
          {error ? (
            <div
              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-800 dark:border-red-950/78 dark:bg-red-950/45 dark:text-red-100"
              role="alert"
            >
              {error}
            </div>
          ) : initialLogs.length === 0 ? (
            <div className="mx-auto mt-16 max-w-xs rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
              <p className="font-mono text-2xl text-zinc-300 dark:text-zinc-700">
                ( )
              </p>
              <p className="mt-2 text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
                No logs returned
              </p>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                Try a wider time range or a higher limit.
              </p>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="mx-auto mt-16 max-w-xs rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
              <p className="font-mono text-2xl text-zinc-300 dark:text-zinc-700">
                ∅
              </p>
              <p className="mt-2 text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
                No matches
              </p>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                Relax the filters in the left panel.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 pb-12">
              {filteredSorted.map((log, i) => (
                <li key={log._id}>
                  <LogEntryCard log={log} index={i} />
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
