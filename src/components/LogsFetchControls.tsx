"use client";

import {
  clampLogLimit,
  istDatetimeLocalToUtcIso,
  LOG_LIMIT_MAX,
  LOG_LIMIT_MIN,
  utcIsoToIstDatetimeLocal,
} from "@/lib/logs";
import moment from "moment-timezone";
import { usePathname, useRouter } from "next/navigation";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState, useTransition } from "react";

type LogsFetchControlsProps = {
  appliedLimit: number;
  appliedStartDate: string | null;
  appliedEndDate: string | null;
};

function hrefForQuery(
  pathname: string,
  limit: number,
  startIso: string | null,
  endIso: string | null,
): string {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (startIso) qs.set("startDate", startIso);
  if (endIso) qs.set("endDate", endIso);
  return `${pathname}?${qs.toString()}`;
}

export function LogsFetchControls({
  appliedLimit,
  appliedStartDate,
  appliedEndDate,
}: LogsFetchControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startNav] = useTransition();

  const [limitInput, setLimitInput] = useState(String(appliedLimit));
  const [startLocal, setStartLocal] = useState(
    appliedStartDate ? utcIsoToIstDatetimeLocal(appliedStartDate) : "",
  );
  const [endLocal, setEndLocal] = useState(
    appliedEndDate ? utcIsoToIstDatetimeLocal(appliedEndDate) : "",
  );

  useEffect(() => {
    setLimitInput(String(appliedLimit));
    setStartLocal(
      appliedStartDate ? utcIsoToIstDatetimeLocal(appliedStartDate) : "",
    );
    setEndLocal(appliedEndDate ? utcIsoToIstDatetimeLocal(appliedEndDate) : "");
  }, [appliedLimit, appliedStartDate, appliedEndDate]);

  const navigateFetch = useCallback(
    (lim: number, startUtc: string | null, endUtc: string | null) => {
      startNav(() => {
        router.push(hrefForQuery(pathname, lim, startUtc, endUtc), {
          scroll: false,
        });
      });
    },
    [pathname, router],
  );

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);

    let startUtc = istDatetimeLocalToUtcIso(startLocal);
    let endUtc = istDatetimeLocalToUtcIso(endLocal);
    if (startUtc && endUtc && moment(startUtc).isAfter(endUtc)) {
      const t = startUtc;
      startUtc = endUtc;
      endUtc = t;
    }

    navigateFetch(lim, startUtc, endUtc);
  }

  function presetTodayIst() {
    const tz = "Asia/Kolkata";
    const startUtc = moment.tz(tz).startOf("day").toISOString();
    const endUtc = moment.tz(tz).endOf("day").toISOString();
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);
    navigateFetch(lim, startUtc, endUtc);
  }

  function presetLastHour() {
    const endUtc = moment.utc().toISOString();
    const startUtc = moment.utc().subtract(1, "hour").toISOString();
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);
    navigateFetch(lim, startUtc, endUtc);
  }

  function presetLastMinutes(minutes: number) {
    const endUtc = moment.utc().toISOString();
    const startUtc = moment.utc().subtract(minutes, "minutes").toISOString();
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);
    navigateFetch(lim, startUtc, endUtc);
  }

  function presetLastHours(hours: number) {
    const endUtc = moment.utc().toISOString();
    const startUtc = moment.utc().subtract(hours, "hours").toISOString();
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);
    navigateFetch(lim, startUtc, endUtc);
  }

  function presetYesterdayIst() {
    const tz = "Asia/Kolkata";
    const startUtc = moment.tz(tz).subtract(1, "day").startOf("day").toISOString();
    const endUtc = moment.tz(tz).subtract(1, "day").endOf("day").toISOString();
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);
    navigateFetch(lim, startUtc, endUtc);
  }

  function clearRangeKeepLimit() {
    const parsed = Number.parseInt(limitInput, 10);
    const lim = clampLogLimit(Number.isFinite(parsed) ? parsed : appliedLimit);
    navigateFetch(lim, null, null);
  }

  return (
    <div className="rounded-2xl border border-zinc-200/95 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="flex flex-col gap-2 pb-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Fetch
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => presetLastMinutes(15)}
              disabled={pending}
              className="rounded-lg border border-zinc-300/90 bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              15m
            </button>
            <button
              type="button"
              onClick={() => presetLastHour()}
              disabled={pending}
              className="rounded-lg border border-zinc-300/90 bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              1h
            </button>
            <button
              type="button"
              onClick={() => presetLastHours(6)}
              disabled={pending}
              className="rounded-lg border border-zinc-300/90 bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              6h
            </button>
            <button
              type="button"
              onClick={() => presetLastHours(24)}
              disabled={pending}
              className="rounded-lg border border-zinc-300/90 bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              24h
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => presetTodayIst()}
              disabled={pending}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[12px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Today IST
            </button>
            <button
              type="button"
              onClick={() => presetYesterdayIst()}
              disabled={pending}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[12px] font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => clearRangeKeepLimit()}
              disabled={pending}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-[12px] text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex min-w-0 flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
      >
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Limit
          </span>
          <input
            inputMode="numeric"
            title={`${LOG_LIMIT_MIN}–${LOG_LIMIT_MAX}`}
            value={limitInput}
            onChange={(e) =>
              setLimitInput(e.target.value.replace(/\D/g, ""))
            }
            className="font-mono box-border min-h-10 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[13px] dark:border-zinc-700 dark:bg-black/52 dark:text-zinc-100"
            spellCheck={false}
          />
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Start (IST)
            </span>
            <input
              type="datetime-local"
              step={1}
              value={startLocal}
              title="Interpreted as Asia/Kolkata"
              onChange={(e) => setStartLocal(e.target.value)}
              className="font-mono box-border min-h-10 w-full min-w-0 max-w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-[12px] leading-normal tabular-nums dark:border-zinc-700 dark:bg-black/52 dark:text-zinc-100 dark:[color-scheme:dark]"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              End (IST)
            </span>
            <input
              type="datetime-local"
              step={1}
              value={endLocal}
              title="Interpreted as Asia/Kolkata"
              onChange={(e) => setEndLocal(e.target.value)}
              className="font-mono box-border min-h-10 w-full min-w-0 max-w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-[12px] leading-normal tabular-nums dark:border-zinc-700 dark:bg-black/52 dark:text-zinc-100 dark:[color-scheme:dark]"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="font-mono mt-1 box-border min-h-10 w-full rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "…" : "Apply"}
        </button>
      </form>
    </div>
  );
}
