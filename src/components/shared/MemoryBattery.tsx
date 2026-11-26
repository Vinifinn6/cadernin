"use client";

import React from "react";
import { parseSafeDate } from "@/lib/fsrsEngine";

interface MemoryBatteryProps {
  retrievability: number | null; // 0..1 ou null se nunca praticado
  due?: string | null;
  stability?: number | null;
  showPercent?: boolean;
}

function formatDueText(due?: string | null): string {
  if (!due) return "sem agenda";
  const dueDate = parseSafeDate(due);
  const now = new Date();
  const dueDay = Math.floor(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()) /
      86_400_000
  );
  const todayDay = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000
  );
  const diff = dueDay - todayDay;
  if (diff < 0) return `atrasada há ${Math.abs(diff)}d`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "em 1 dia";
  return `em ${diff} dias`;
}

export function MemoryBattery({
  retrievability,
  due = null,
  stability = 0,
  showPercent = false,
}: MemoryBatteryProps) {
  const hasPractice =
    retrievability !== null && Number.isFinite(retrievability);
  const pct = hasPractice ? Math.round((retrievability as number) * 100) : null;
  const stabilityDays = Math.max(0, Math.round(Number(stability ?? 0)));

  let activeBars = 0;
  let barColors: string[] = [
    "var(--border-hairline)",
    "var(--border-hairline)",
    "var(--border-hairline)",
    "var(--border-hairline)",
  ];

  if (pct !== null) {
    if (pct >= 90) {
      activeBars = 4;
      barColors = [
        "var(--accent-sage)",
        "var(--accent-sage)",
        "var(--accent-sage)",
        "var(--accent-sage)",
      ];
    } else if (pct >= 80) {
      activeBars = 3;
      barColors = [
        "var(--accent-sage)",
        "var(--accent-sage)",
        "var(--accent-ochre)",
        "var(--border-hairline)",
      ];
    } else if (pct >= 65) {
      activeBars = 2;
      barColors = [
        "var(--accent-ochre)",
        "var(--accent-ochre)",
        "var(--border-hairline)",
        "var(--border-hairline)",
      ];
    } else {
      activeBars = 1;
      barColors = [
        "var(--accent-terracotta)",
        "var(--border-hairline)",
        "var(--border-hairline)",
        "var(--border-hairline)",
      ];
    }
  }

  const tooltipText =
    pct !== null
      ? `Memória estimada: ${pct}% • Próxima revisão: ${formatDueText(
          due
        )} • Estabilidade: ${stabilityDays}d`
      : "Ainda sem prática registrada com questões";

  const barHeights = ["h-2", "h-2.5", "h-3", "h-3.5"];

  return (
    <span
      title={tooltipText}
      aria-label={tooltipText}
      className="group/battery relative inline-flex items-center gap-1.5 select-none shrink-0"
    >
      <span className="inline-flex items-end gap-[2.5px] px-1 py-0.5">
        {barHeights.map((heightClass, idx) => (
          <span
            key={idx}
            className={`w-[3.5px] ${heightClass} rounded-[1.5px] transition-colors`}
            style={{
              backgroundColor:
                idx < activeBars ? barColors[idx] : "var(--border-hairline)",
              opacity: hasPractice ? 1 : 0.6,
            }}
          />
        ))}
      </span>

      {showPercent && pct !== null && (
        <span
          className="font-mono-tabular text-[11px] font-medium"
          style={{
            color:
              pct >= 90
                ? "var(--accent-sage)"
                : pct >= 65
                ? "var(--accent-ochre)"
                : "var(--accent-terracotta)",
          }}
        >
          {pct}%
        </span>
      )}

      {/* Tooltip editorial flutuante no desktop */}
      <span
        role="tooltip"
        className="pointer-events-none hidden sm:block opacity-0 group-hover/battery:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-[var(--text-primary)] text-[var(--bg-canvas)] font-mono-tabular text-[10.5px]"
      >
        {tooltipText}
      </span>
    </span>
  );
}
