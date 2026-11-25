import React from "react";

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-5 space-y-4 animate-pulse"
        >
          <div className="w-11 h-11 rounded-xl bg-[var(--bg-subtle)]" />
          <div className="space-y-2">
            <div className="h-5 w-2/3 rounded-md bg-[var(--bg-subtle)]" />
            <div className="h-3.5 w-1/2 rounded-md bg-[var(--bg-subtle)]" />
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="h-3 w-full rounded bg-[var(--bg-subtle)]" />
            <div className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--border-hairline)]">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 sm:px-5 flex items-center justify-between gap-4 animate-pulse"
        >
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/2 rounded bg-[var(--bg-subtle)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--bg-subtle)]" />
          </div>
          <div className="h-6 w-20 rounded-lg bg-[var(--bg-subtle)] shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function StatsPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-3">
        <div className="h-6 w-56 rounded bg-[var(--bg-subtle)]" />
        <div className="h-16 w-full rounded-xl bg-[var(--bg-subtle)]" />
        <div className="h-16 w-full rounded-xl bg-[var(--bg-subtle)]" />
      </div>
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-3">
        <div className="h-6 w-48 rounded bg-[var(--bg-subtle)]" />
        <div className="h-56 w-full rounded-xl bg-[var(--bg-subtle)]" />
      </div>
    </div>
  );
}
