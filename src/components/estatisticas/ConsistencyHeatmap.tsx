"use client";

import React, { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  addDays,
  formatMinutesHuman,
  parseLocalIsoDate,
  toLocalIsoDate,
} from "@/lib/date-utils";
import type { DailyActivityData } from "@/lib/activityCalendar";

export type { DailyActivityData };

export type HeatmapMetricMode = "combined" | "minutes" | "questions";

interface ConsistencyHeatmapProps {
  dailyMap: Record<string, DailyActivityData>;
  annual?: boolean; // true = ano calendário completo Jan–Dez com seletor de ano
  weeksCount?: number; // usado quando annual=false (ex: 14 na Home)
  compact?: boolean;
  defaultMetric?: HeatmapMetricMode;
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

function formatTooltipDatePtBr(iso: string): string {
  const d = parseLocalIsoDate(iso);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function computeIntensityLevel(
  entry: DailyActivityData,
  metric: HeatmapMetricMode
): 0 | 1 | 2 | 3 | 4 {
  if (metric === "combined") {
    // Qualquer dia com tempo > 0 OU questões > 0 recebe no mínimo Nível 1
    if (entry.minutes <= 0 && entry.questions <= 0) return 0;
    const score = entry.minutes + entry.questions * 1.5;
    if (score < 45) return 1;
    if (score < 120) return 2;
    if (score < 240) return 3;
    return 4;
  }

  if (metric === "minutes") {
    if (entry.minutes <= 0) return 0;
    if (entry.minutes < 45) return 1;
    if (entry.minutes < 120) return 2;
    if (entry.minutes < 240) return 3;
    return 4;
  }

  // Questões feitas
  if (entry.questions <= 0) return 0;
  if (entry.questions < 10) return 1;
  if (entry.questions < 25) return 2;
  if (entry.questions < 50) return 3;
  return 4;
}

function levelCellClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return "bg-[var(--border-hairline)]/65";
    case 1:
      return "bg-[var(--accent-sage)]/32";
    case 2:
      return "bg-[var(--accent-sage)]/56";
    case 3:
      return "bg-[var(--accent-sage)]/80";
    case 4:
      return "bg-[var(--accent-sage)]";
  }
}

interface HeatmapCell {
  iso: string;
  outOfRange: boolean;
  isToday: boolean;
  data: DailyActivityData;
}

export function ConsistencyHeatmap({
  dailyMap,
  annual = false,
  weeksCount = 15,
  compact = false,
  defaultMetric = "combined",
  showMetricToggle = true,
}: ConsistencyHeatmapProps) {
  const [metric, setMetric] = useState<HeatmapMetricMode>(defaultMetric);
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [hovered, setHovered] = useState<DailyActivityData | null>(null);

  const { columns, monthMarkers, totalActiveDays } = useMemo(() => {
    const today = new Date();
    const todayIso = toLocalIsoDate(today);

    const cols: HeatmapCell[][] = [];
    const markers: { colIndex: number; label: string }[] = [];
    let activeDays = 0;

    if (annual) {
      // Ano calendário completo: 01/01/selectedYear até 31/12/selectedYear
      const jan1 = new Date(selectedYear, 0, 1);
      const dec31 = new Date(selectedYear, 11, 31);

      // Alinha o início no Domingo da semana de 1º de janeiro
      const gridStart = addDays(jan1, -jan1.getDay());
      // Alinha o fim no Sábado da semana de 31 de dezembro
      const gridEnd = addDays(dec31, 6 - dec31.getDay());

      const totalDays =
        Math.round(
          (Date.UTC(
            gridEnd.getFullYear(),
            gridEnd.getMonth(),
            gridEnd.getDate()
          ) -
            Date.UTC(
              gridStart.getFullYear(),
              gridStart.getMonth(),
              gridStart.getDate()
            )) /
            86_400_000
        ) + 1;
      const totalWeeks = Math.ceil(totalDays / 7);

      const seenMonths = new Set<number>();

      for (let w = 0; w < totalWeeks; w++) {
        const col: HeatmapCell[] = [];
        for (let d = 0; d < 7; d++) {
          const current = addDays(gridStart, w * 7 + d);
          const iso = toLocalIsoDate(current);
          const inSelectedYear = current.getFullYear() === selectedYear;
          const entry = dailyMap[iso] ?? {
            date: iso,
            minutes: 0,
            questions: 0,
          };

          if (inSelectedYear) {
            const m = current.getMonth();
            if (!seenMonths.has(m)) {
              seenMonths.add(m);
              // Garante espaçamento mínimo de 3 colunas entre rótulos para ZERO sobreposição
              const prevMarker = markers[markers.length - 1];
              if (!prevMarker || w - prevMarker.colIndex >= 3) {
                markers.push({ colIndex: w, label: MONTH_ABBR[m] });
              } else {
                markers.push({ colIndex: w + 1, label: MONTH_ABBR[m] });
              }
            }

            if (computeIntensityLevel(entry, metric) > 0) {
              activeDays += 1;
            }
          }

          col.push({
            iso,
            outOfRange: !inSelectedYear,
            isToday: iso === todayIso,
            data: entry,
          });
        }
        cols.push(col);
      }
    } else {
      // Modo compacto (Home): cobre as últimas `weeksCount` semanas até o fim da semana do último dia do mês atual
      // garantindo que nunca corte o fim do mês / Dezembro e sempre exiba o dia atual
      const endOfCurrentMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      );
      const gridEnd = addDays(
        endOfCurrentMonth,
        6 - endOfCurrentMonth.getDay()
      );
      const totalDays = weeksCount * 7;
      const gridStart = addDays(gridEnd, -(totalDays - 1));

      for (let w = 0; w < weeksCount; w++) {
        const col: HeatmapCell[] = [];
        for (let d = 0; d < 7; d++) {
          const current = addDays(gridStart, w * 7 + d);
          const iso = toLocalIsoDate(current);
          const entry = dailyMap[iso] ?? {
            date: iso,
            minutes: 0,
            questions: 0,
          };

          if (computeIntensityLevel(entry, metric) > 0) {
            activeDays += 1;
          }

          col.push({
            iso,
            outOfRange: false,
            isToday: iso === todayIso,
            data: entry,
          });
        }
        cols.push(col);
      }
    }

    return {
      columns: cols,
      monthMarkers: markers,
      totalActiveDays: activeDays,
    };
  }, [dailyMap, annual, selectedYear, weeksCount, metric]);

  const cellPx = 12;
  const gapPx = 3;
  const colStepPx = cellPx + gapPx;

  return (
    <div className="space-y-3">
      {/* Controles + Seletor de Ano (no anual) + Legenda */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {showMetricToggle ? (
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              {(
                [
                  { id: "combined", label: "Tudo (Combinado)" },
                  { id: "minutes", label: "Tempo Estudado" },
                  { id: "questions", label: "Questões Feitas" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMetric(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                    metric === opt.id
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
              {totalActiveDays}{" "}
              {totalActiveDays === 1
                ? "dia ativo no período"
                : "dias ativos no período"}
            </span>
          )}

          {annual && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                aria-label="Ano anterior"
                className="w-6 h-6 rounded hover:bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <CaretLeft size={12} weight="light" />
              </button>
              <span className="font-mono-tabular text-[11.5px] font-medium text-[var(--text-primary)] px-1">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                aria-label="Próximo ano"
                className="w-6 h-6 rounded hover:bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <CaretRight size={12} weight="light" />
              </button>
            </div>
          )}
        </div>

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

      {/* Grade do Heatmap */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1.5 min-w-full">
          {/* Rótulos dos 12 meses posicionados por coordenada exata (ZERO sobreposição) */}
          {annual && (
            <div
              className="relative h-4 ml-7 select-none"
              style={{ width: `${columns.length * colStepPx}px` }}
            >
              {monthMarkers.map((marker) => (
                <span
                  key={`${marker.label}-${marker.colIndex}`}
                  style={{ left: `${marker.colIndex * colStepPx}px` }}
                  className="absolute top-0 font-mono-tabular text-[10.5px] text-[var(--text-muted)] leading-none whitespace-nowrap"
                >
                  {marker.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-start gap-1.5">
            {annual && (
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

            <div
              className={`flex ${
                compact ? "gap-[4px] justify-between w-full" : "gap-[3px]"
              }`}
            >
              {columns.map((week, wIdx) => (
                <div
                  key={wIdx}
                  className={`flex flex-col ${
                    compact ? "gap-[4px]" : "gap-[3px]"
                  }`}
                >
                  {week.map((cell) => {
                    if (cell.outOfRange) {
                      return (
                        <span
                          key={cell.iso}
                          className={`${
                            compact ? "w-3 h-3" : "w-[12px] h-[12px]"
                          } rounded-[2.5px] opacity-0 pointer-events-none`}
                        />
                      );
                    }

                    const lvl = computeIntensityLevel(cell.data, metric);

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onMouseEnter={() => setHovered(cell.data)}
                        onFocus={() => setHovered(cell.data)}
                        onClick={() => setHovered(cell.data)}
                        aria-label={`${cell.iso}: ${formatMinutesHuman(
                          cell.data.minutes
                        )} estudados, ${cell.data.questions} questões`}
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

      {/* Barra de resumo do dia inspecionado */}
      <div className="min-h-[28px] px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        {hovered ? (
          <>
            <span className="font-medium text-[var(--text-primary)]">
              {formatTooltipDatePtBr(hovered.date)}
            </span>
            <span className="font-mono-tabular text-[var(--text-secondary)]">
              {formatMinutesHuman(hovered.minutes)} estudados •{" "}
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
              {totalActiveDays}{" "}
              {totalActiveDays === 1
                ? "dia com atividade"
                : "dias com atividade"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
