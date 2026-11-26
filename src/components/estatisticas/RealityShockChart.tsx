"use client";

import React, { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDatePtBr } from "@/lib/date-utils";
import { groupMockExams } from "@/lib/mockGrouping";
import type {
  ExerciseLog,
  MockExam,
  MockQuestion,
  Topic,
} from "@/types/database";

interface RealityShockChartProps {
  exerciseLogs: ExerciseLog[];
  mockExams: MockExam[];
  mockQuestions: MockQuestion[];
  topics?: Topic[];
  overallRawPct: number;
  overallRealPct: number;
  guessIllusionPct: number;
  guessesTotal: number;
  height?: number;
}

interface ChronologicalRecordPoint {
  id: string;
  dateIso: string;
  sortKey: string;
  label: string;
  title: string;
  bruto: number;
  real: number;
  questions: number;
}

export function RealityShockChart({
  exerciseLogs,
  mockExams,
  mockQuestions,
  topics = [],
  overallRawPct,
  overallRealPct,
  guessIllusionPct,
  guessesTotal,
  height = 170,
}: RealityShockChartProps) {
  const uid = useId().replace(/:/g, "");
  const rawGradId = `rs-raw-${uid}`;
  const realGradId = `rs-real-${uid}`;

  const trendData: ChronologicalRecordPoint[] = useMemo(() => {
    const topicNameById = new Map(topics.map((t) => [t.id, t.name]));
    const points: ChronologicalRecordPoint[] = [];

    // 1. Cada bateria de exercícios entra como um evento cronológico
    for (const log of exerciseLogs) {
      const total = Math.max(0, log.total_questions);
      if (total <= 0) continue;
      const raw = Math.min(total, Math.max(0, log.raw_correct));
      const real = Math.max(0, raw - Math.max(0, log.guesses_count));
      const topicName = topicNameById.get(log.topic_id) ?? "Lista de exercícios";

      points.push({
        id: `ex-${log.id}`,
        dateIso: log.date,
        sortKey: `${log.date}T${log.created_at ?? "12:00:00"}`,
        label: formatShortDatePtBr(log.date),
        title: `${topicName} (${total}q)`,
        bruto: Math.round((raw / total) * 1000) / 10,
        real: Math.round((real / total) * 1000) / 10,
        questions: total,
      });
    }

    // 2. Cada simulado já AGRUPADO (com questões detalhadas) entra como 1 evento consolidado
    const groupedExams = groupMockExams(mockExams, mockQuestions);
    for (const exam of groupedExams) {
      if (!exam.hasDetailedQuestions || exam.totalQuestions <= 0) continue;
      points.push({
        id: `mock-${exam.id}`,
        dateIso: exam.date,
        sortKey: `${exam.date}T23:59:00-${exam.id}`,
        label: formatShortDatePtBr(exam.date),
        title: `${exam.displayTitle} (${exam.totalQuestions}q)`,
        bruto:
          Math.round((exam.rawCorrect / exam.totalQuestions) * 1000) / 10,
        real:
          Math.round((exam.realCorrect / exam.totalQuestions) * 1000) / 10,
        questions: exam.totalQuestions,
      });
    }

    return points
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-15);
  }, [exerciseLogs, mockExams, mockQuestions, topics]);

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-subtle)]/80 border border-[var(--border-hairline)]/70 space-y-3.5">
      {/* Cabeçalho compacto de métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-slate)] shrink-0" />
            <span>Acerto Bruto</span>
          </span>
          <span className="font-mono-tabular text-[14px] font-medium text-[var(--text-primary)]">
            {overallRawPct.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-terracotta)] shrink-0" />
            <span className="truncate">Acerto Real (Sem chutes)</span>
          </span>
          <span className="font-mono-tabular text-[14px] font-semibold text-[var(--accent-terracotta)]">
            {overallRealPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Gráfico Recharts de Curva Suave (aparece com >= 2 registros) */}
      {trendData.length >= 2 ? (
        <div style={{ height }} className="w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id={rawGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="#567189"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="100%"
                    stopColor="#567189"
                    stopOpacity={0.01}
                  />
                </linearGradient>
                <linearGradient id={realGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="#C46D53"
                    stopOpacity={0.26}
                  />
                  <stop
                    offset="100%"
                    stopColor="#C46D53"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="var(--border-strong)"
                strokeDasharray="3 3"
                strokeOpacity={0.22}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 10.5,
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "10px",
                  fontSize: "11.5px",
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-primary)",
                }}
                formatter={(value, name) => [`${value}%`, String(name)]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as
                    | ChronologicalRecordPoint
                    | undefined;
                  return row ? `${row.title} · ${row.label}` : "";
                }}
              />
              <Area
                type="monotone"
                dataKey="bruto"
                name="Acerto Bruto"
                stroke="#567189"
                strokeWidth={2}
                fill={`url(#${rawGradId})`}
                dot={{ r: 3.5, fill: "var(--bg-card)", stroke: "#567189", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="real"
                name="Acerto Real"
                stroke="#C46D53"
                strokeWidth={2}
                fill={`url(#${realGradId})`}
                dot={{ r: 3.5, fill: "var(--bg-card)", stroke: "#C46D53", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-5 px-3 rounded-xl bg-[var(--bg-card)]/65 border border-[var(--border-hairline)]/60 text-center">
          <p className="font-mono-tabular text-[12px] text-[var(--text-secondary)]">
            {trendData.length === 1
              ? `${trendData[0].title} · Bruto ${trendData[0].bruto}% vs. Real ${trendData[0].real}%`
              : "Sem registros suficientes para traçar a curva."}
          </p>
        </div>
      )}

      {/* Rodapé: Viés de Ilusão de Competência */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-hairline)]">
        <span className="text-[12px] text-[var(--text-secondary)]">
          Viés de Ilusão de Competência
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-terracotta-soft)] border border-[var(--accent-terracotta)]/25 font-mono-tabular text-[11.5px] font-medium text-[var(--accent-terracotta)]">
          -{guessIllusionPct.toFixed(1)}% em chutes ({guessesTotal})
        </span>
      </div>
    </div>
  );
}
