"use client";

import React, { useMemo, useState } from "react";
import {
  addDays,
  formatFullDatePtBr,
  formatMinutesHuman,
  toLocalIsoDate,
} from "@/lib/date-utils";

export interface DailyActivityData {
  date: string; // YYYY-MM-DD
  minutes: number;
  questions: number;
}

interface ConsistencyHeatmapProps {
  dailyMap: Record<string, DailyActivityData>;
  weeksCount?: number; // 53 para anual, ~14 para mini-heatmap da Home
  compact?: boolean;
  defaultMetric?: "minutes" | "questions";
  showMetricToggle?: boolean;
}

const MONTH_ABBR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function computeIntensityLevel(
  value: number,
  metric: "minutes" | "questions"
): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (metric === "minutes") {
    if (value < 45) return 1;
    if (value < 120) return 2;
    if (value < 240) return 3;
    return 4;
  }
  // Questões feitas
  if (value < 10) return 1;
  if (value < 25) return 2;
  if (value < 50) return 3;
  return 4;
}

function levelCellClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return "bg-[var(--border-hairline)]/65";
    case 1:
      return "bg-[var(--accent-sage)]/28";
    case 2:
      return "bg-[var(--accent-sage)]/52";
    case 3:
      return "bg-[var(--accent-sage)]/78";
    case 4:
      return "bg-[var(--accent-sage)]";
  }
}

export function ConsistencyHeatmap({
  dailyMap,
  weeksCount = 52,
  compact = false,
  defaultMetric = "minutes",
  showMetricToggle = true,
}: ConsistencyHeatmapProps) {
  const [metric, setMetric] = useState<"minutes" | "questions">(defaultMetric);
  const [hovered, setHovered] = useState<DailyActivityData | null>(null);

  const { columns, monthLabels, totalActiveDays } = useMemo(() => {
    const today = new Date();
    const todayIso = toLocalIsoDate(today);

    // Alinha o fim da última coluna no Sábado da semana atual
    const daysUntilSaturday = 6 - today.getDay();
    const endDate = addDays(today, daysUntilSaturday);
    const totalDays = weeksCount * 7;
    const startDate = addDays(endDate, -(totalDays - 1));

    const cols: {
      iso: string;
      isFuture: boolean;
      isToday: boolean;
      data: DailyActivityData;
    }[][] = [];

    const labels: { colIndex: number; label: string }[] = [];
    let lastMonth = -1;
    let activeDays = 0;

    for (let w = 0; w < weeksCount; w++) {
      const col: {
        iso: string;
        isFuture: boolean;
        isToday: boolean;
        data: DailyActivityData;
      }[] = [];

      for (let d = 0; d < 7; d++) {
        const current = addDays(startDate, w * 7 + d);
        const iso = toLocalIsoDate(current);
        const isFuture = iso > todayIso;
        const entry = dailyMap[iso] ?? { date: iso, minutes: 0, questions: 0 };

        if (!isFuture && (entry.minutes > 0 || entry.questions > 0)) {
          activeDays += 1;
        }

        if (d === 0) {
          const m = current.getMonth();
          if (m !== lastMonth) {
            labels.push({ colIndex: w, label: MONTH_ABBR[m] });
            lastMonth = m;
          }
        }

        col.push({
          iso,
          isFuture,
          isToday: iso === todayIso,
          data: entry,
        });
      }
      cols.push(col);
    }

    return { columns: cols, monthLabels: labels, totalActiveDays: activeDays };
  }, [dailyMap, weeksCount]);

  return (
    <div className="space-y-3">
      {/* Controles e legenda */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showMetricToggle ? (
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setMetric("minutes")}
              className={`px-2.5 py-1 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                metric === "minutes"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Tempo Estudado
            </button>
            <button
              type="button"
              onClick={() => setMetric("questions")}
              className={`px-2.5 py-1 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                metric === "questions"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Questões Feitas
            </button>
          </div>
        ) : (
          <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
            {totalActiveDays} dias ativos no período
          </span>
        )}

        <div className="flex items-center gap-1 font-mono-tabular text-[10.5px] text-[var(--text-muted)]">
          <span>Menos</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <span
              key={lvl}
              className={`w-2.5 h-2.5 rounded-[2.5px] ${levelCellClass(lvl)}`}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>

      {/* Grade do Heatmap com scroll horizontal suave em telas pequenas */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-full">
          {/* Rótulos dos meses */}
          {!compact && (
            <div className="flex items-center gap-[3px] pl-7 h-4 relative">
              {columns.map((_, idx) => {
                const found = monthLabels.find((m) => m.colIndex === idx);
                return (
                  <span
                    key={idx}
                    className="w-[12px] shrink-0 font-mono-tabular text-[10px] text-[var(--text-muted)] leading-none"
                  >
                    {found ? found.label : ""}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-1.5">
            {/* Dias da semana à esquerda */}
            {!compact && (
              <div className="flex flex-col gap-[3px] w-5.5 pt-[1px] font-mono-tabular text-[9.5px] text-[var(--text-muted)] select-none shrink-0">
                <span className="h-[12px] leading-[12px]" />
                <span className="h-[12px] leading-[12px]">Seg</span>
                <span className="h-[12px] leading-[12px]" />
                <span className="h-[12px] leading-[12px]">Qua</span>
                <span className="h-[12px] leading-[12px]" />
                <span className="h-[12px] leading-[12px]">Sex</span>
                <span className="h-[12px] leading-[12px]" />
              </div>
            )}

            {/* Colunas de semanas */}
            <div
              className={`flex ${
                compact ? "gap-[4px] justify-between w-full" : "gap-[3px]"
              }`}
            >
              {columns.map((week, wIdx) => (
                <div
                  key={wIdx}
                  className={`flex flex-col ${compact ? "gap-[4px]" : "gap-[3px]"}`}
                >
                  {week.map((cell) => {
                    if (cell.isFuture) {
                      return (
                        <span
                          key={cell.iso}
                          className={`${
                            compact ? "w-3 h-3" : "w-[12px] h-[12px]"
                          } rounded-[2.5px] opacity-0`}
                        />
                      );
                    }

                    const val =
                      metric === "minutes"
                        ? cell.data.minutes
                        : cell.data.questions;
                    const lvl = computeIntensityLevel(val, metric);

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onMouseEnter={() => setHovered(cell.data)}
                        onFocus={() => setHovered(cell.data)}
                        onClick={() => setHovered(cell.data)}
                        aria-label={`${cell.iso}: ${cell.data.minutes} min, ${cell.data.questions} questões`}
                        className={`${
                          compact ? "w-3 h-3" : "w-[12px] h-[12px]"
                        } rounded-[2.5px] transition-transform hover:scale-125 cursor-pointer ${levelCellClass(
                          lvl
                        )} ${
                          cell.isToday
                            ? "ring-1 ring-[var(--text-primary)]"
                            : ""
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip / Barra de resumo do dia inspecionado */}
      <div className="min-h-[28px] px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        {hovered ? (
          <>
            <span className="font-medium text-[var(--text-primary)]">
              {formatFullDatePtBr(hovered.date)}
            </span>
            <span className="font-mono-tabular text-[var(--text-secondary)]">
              {formatMinutesHuman(hovered.minutes)} estudados ·{" "}
              {hovered.questions}{" "}
              {hovered.questions === 1 ? "questão" : "questões"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--text-muted)]">
              Passe o mouse ou toque em um quadrado para ver o resumo do dia
            </span>
            <span className="font-mono-tabular text-[var(--accent-sage)] font-medium">
              {totalActiveDays} dias com atividade
            </span>
          </>
        )}
      </div>
    </div>
  );
}
