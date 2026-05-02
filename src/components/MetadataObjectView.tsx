"use client";

import type { ReactNode } from "react";
import { useCallback, useId, useMemo, useState } from "react";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizePreview(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isPlainObject(value))
    return `Object(${Object.keys(value).length})`;
  if (typeof value === "string") {
    const s = value;
    const one = s.split("\n")[0];
    if (one.length > 56 || s.includes("\n")) return `"${one.slice(0, 56)}…"`;
    return JSON.stringify(s);
  }
  if (value === null) return "null";
  return String(value);
}

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null)
    return <span className="text-violet-600 dark:text-violet-400">null</span>;
  if (typeof value === "undefined")
    return <span className="text-zinc-400 italic">undefined</span>;
  if (typeof value === "boolean")
    return <span className="text-sky-600 dark:text-sky-400">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-amber-700 dark:text-amber-400">{value}</span>;
  if (typeof value === "string") {
    return (
      <span className="text-emerald-800 dark:text-emerald-400">
        <span className="text-zinc-500" aria-hidden>
          {'"'}
        </span>
        <span className="break-words whitespace-pre-wrap">{value}</span>
        <span className="text-zinc-500" aria-hidden>
          {'"'}
        </span>
      </span>
    );
  }
  return (
    <span className="text-zinc-600 dark:text-zinc-400">{summarizePreview(value)}</span>
  );
}

type DisclosureProps = {
  preview: React.ReactNode;
  defaultOpen: boolean;
  depthPadding: number;
} & React.PropsWithChildren;

function Disclosure({
  preview,
  defaultOpen,
  depthPadding,
  children,
}: DisclosureProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  return (
    <div className="" style={{ paddingLeft: depthPadding }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="inline-flex max-w-full items-start gap-1 rounded px-1 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900/70"
      >
        <span
          className="mt-0.5 shrink-0 text-[10px] text-zinc-500 transition-transform select-none"
          style={{ transform: open ? "rotate(90deg)" : undefined }}
          aria-hidden
        >
          ▶
        </span>
        <span className="min-w-0 text-zinc-500">{preview}</span>
      </button>
      {open && (
        <div id={panelId} className="mt-1 border-l border-zinc-200 pl-3 dark:border-zinc-700">
          {children}
        </div>
      )}
    </div>
  );
}

function ArrayTree({
  arr,
  depth,
}: {
  arr: unknown[];
  depth: number;
}) {
  if (arr.length === 0) return <span className="text-zinc-500">[]</span>;

  const pad = Math.max(0, depth - 1) * 14;

  return (
    <ul className="list-none space-y-1 py-0.5">
      {arr.map((item, index) => (
        <li key={index} style={{ paddingLeft: pad }}>
          <span className="text-zinc-400">{index}</span>
          <span className="text-zinc-500"> · </span>
          <NestedValue value={item} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function ObjectTree({
  data,
  depth,
}: {
  data: Record<string, unknown>;
  depth: number;
}) {
  const keys = Object.keys(data);
  if (keys.length === 0)
    return <span className="text-zinc-500">{`{ }`}</span>;

  const pad = depth === 0 ? 0 : Math.max(0, depth - 1) * 14;

  return (
    <ul className="list-none space-y-1.5" style={{ paddingLeft: pad }}>
      {keys.map((key) => (
        <li key={key} className="min-w-0">
          <span className="text-orange-700 dark:text-orange-400">{key}</span>
          <span className="text-zinc-500">: </span>
          <NestedValue value={data[key]} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

/** Renders nested object/array like an expandable console object. */
function NestedValue({ value, depth }: { value: unknown; depth: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-500">[]</span>;
    const preview = (
      <>
        {"Array"}
        <span className="text-zinc-400">({value.length})</span>
      </>
    );
    return (
      <Disclosure
        depthPadding={0}
        defaultOpen={depth <= 2}
        preview={preview}
      >
        <ArrayTree arr={value} depth={depth} />
      </Disclosure>
    );
  }

  if (isPlainObject(value)) {
    const k = Object.keys(value);
    if (k.length === 0) return <span className="text-zinc-500">{`{ }`}</span>;

    const preview = (
      <>
        {"{"}
        <span className="text-zinc-400">
          {k.slice(0, 4).join(", ")}
          {k.length > 4 ? ", …" : ""}
        </span>
        {"}"}
      </>
    );

    return (
      <Disclosure
        depthPadding={0}
        defaultOpen={depth <= 2}
        preview={<span>{preview}</span>}
      >
        <ObjectTree data={value} depth={depth} />
      </Disclosure>
    );
  }

  return <PrimitiveValue value={value} />;
}

const metadataRootBase =
  "rounded-lg border border-zinc-200 bg-zinc-950/[0.02] dark:border-zinc-800 dark:bg-black/40";

function metadataHeadline(meta: Record<string, unknown> | undefined | null): string {
  if (meta === undefined || meta === null) return "∅";
  const keys = Object.keys(meta);
  if (keys.length === 0) return "{ }";
  return `${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "…" : ""}`;
}

export function MetadataObjectView({
  value,
  className,
  open,
  onOpenChange,
}: {
  value: Record<string, unknown> | undefined;
  className?: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const panelId = useId();
  const summary = useMemo(() => metadataHeadline(value ?? null), [value]);

  const toggleHeader = useCallback(() => {
    onOpenChange(!open);
  }, [open, onOpenChange]);

  const body: ReactNode = (() => {
    if (value === undefined || value === null) {
      return (
        <div className="p-2.5 font-mono text-xs italic text-zinc-500 md:p-3">
          null
        </div>
      );
    }
    if (Object.keys(value).length === 0) {
      return (
        <div className="p-2.5 font-mono text-xs text-zinc-500 md:p-3">{`{ }`}</div>
      );
    }
    return (
      <div className="max-h-80 overflow-auto p-2.5 md:max-h-96 md:p-3">
        <div className="font-mono text-xs leading-snug text-zinc-800 dark:text-zinc-200">
          <ObjectTree data={value} depth={0} />
        </div>
      </div>
    );
  })();

  return (
    <div
      role="presentation"
      className={`${metadataRootBase} ${className ?? "mt-4"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Collapse metadata" : "Expand metadata"}
        onClick={(e) => {
          e.stopPropagation();
          toggleHeader();
        }}
        className="flex w-full min-w-0 items-center gap-2 border-b border-zinc-200 px-3 py-2 text-left transition hover:bg-zinc-50/95 dark:border-zinc-800 dark:hover:bg-black/52"
      >
        <span
          className="shrink-0 text-[10px] text-zinc-500 transition-transform duration-150 select-none"
          aria-hidden
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
          Meta
        </span>
        <span className="ml-auto min-w-0 shrink truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
          <span title={summary} className="block truncate">{summary}</span>
        </span>
      </button>
      <div id={panelId} className="min-h-0">
        {open ? body : null}
      </div>
    </div>
  );
}
