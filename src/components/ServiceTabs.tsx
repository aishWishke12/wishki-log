"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

type ServiceTabsProps = {
  /** Full service roster. */
  services: string[];
  /** Log count per service in the current fetch window. */
  counts: Record<string, number>;
  /** The service whose page is showing, or null on the "All" page. */
  activeService: string | null;
};

export function ServiceTabs({
  services,
  counts,
  activeService,
}: ServiceTabsProps) {
  const searchParams = useSearchParams();

  const suffix = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("reauthed");
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [searchParams]);

  const { withLogs, withoutLogs } = useMemo(() => {
    const all = new Set<string>(services);
    for (const k of Object.keys(counts)) all.add(k);
    const sorted = [...all].sort((a, b) => a.localeCompare(b));
    return {
      withLogs: sorted.filter((s) => (counts[s] ?? 0) > 0),
      withoutLogs: sorted.filter((s) => (counts[s] ?? 0) === 0),
    };
  }, [services, counts]);

  const totalShown = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <nav
      aria-label="Services"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-200/90 bg-zinc-50/85 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/85 md:px-5"
    >
      <TabLink
        href={`/${suffix}`}
        label="All"
        count={totalShown}
        active={activeService === null}
      />

      {withLogs.length > 0 && <Divider />}
      {withLogs.map((s) => (
        <TabLink
          key={s}
          href={`/s/${encodeURIComponent(s)}${suffix}`}
          label={s}
          count={counts[s] ?? 0}
          active={activeService === s}
        />
      ))}

      {withoutLogs.length > 0 && <Divider />}
      {withoutLogs.map((s) => (
        <TabLink
          key={s}
          href={`/s/${encodeURIComponent(s)}${suffix}`}
          label={s}
          count={0}
          muted
          active={activeService === s}
        />
      ))}
    </nav>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-1 h-4 w-px shrink-0 bg-zinc-300 dark:bg-zinc-700"
    />
  );
}

function TabLink({
  href,
  label,
  count,
  active,
  muted = false,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      data-active={active}
      title={label}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 font-mono text-[11px] transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : muted
            ? "border-transparent text-zinc-400 hover:bg-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-900"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="max-w-[11rem] truncate">{label}</span>
      {count > 0 && (
        <span
          className={`rounded px-1 text-[10px] tabular-nums ${
            active
              ? "bg-white/20 text-white dark:bg-black/15 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
