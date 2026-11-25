"use client";

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDatePtBr } from "@/lib/date-utils";
import type { EnemArea, MockExam, MockQuestion } from "@/types/database";

type ChartFilter =
  | "geral"
  | "linguagens"
  | "humanas"
  | "natureza"
  | "matematica"
  | "redacao";

const FILTER_TABS: { id: ChartFilter; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "linguagens", label: "Linguagens" },
  { id: "humanas", label: "Humanas" },
  { id: "natureza", label: "Natureza" },
  { id: "matematica", label: "Matemática" },
  { id: "redacao", label: "Redação" },
];

interface SimuladosEvolutionChartProps {
  exams: MockExam[];
  questions: MockQuestion[];
}

export function SimuladosEvolutionChart({
  exams,
  questions,
}: SimuladosEvolutionChartProps) {
  const [filter, setFilter] = useState<ChartFilter>("geral");
  const [metricMode, setMetricMode] = useState<"scores" | "tri">("scores");

  const questionsByExam = useMemo(() => {
    const map = new Map<string, MockQuestion[]>();
    for (const q of questions) {
      const list = map.get(q.mock_exam_id) ?? [];
      list.push(q);
      map.set(q.mock_exam_id, list);
    }
    return map;
  }, [questions]);

  const sortedExams = useMemo(
    () => [...exams].sort((a, b) => a.date.localeCompare(b.date)),
    [exams]
  );

  const chartData = useMemo(() => {
    return sortedExams
      .map((exam) => {
        const examQs = questionsByExam.get(exam.id) ?? [];
        const label = formatShortDatePtBr(exam.date);

        if (filter === "redacao") {
          if (exam.essay_total === null) return null;
          return {
            label,
            title: exam.title,
            redacao: exam.essay_total,
          };
        }

        if (metricMode === "tri") {
          let triVal: number | null = null;
          if (filter === "geral") {
            const vals = [
              exam.tri_lc,
              exam.tri_ch,
              exam.tri_cn,
              exam.tri_mt,
            ].filter((v): v is number => v !== null);
            if (vals.length > 0) {
              triVal =
                Math.round(
                  (vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10
                ) / 10;
            }
          } else if (filter === "linguagens") triVal = exam.tri_lc;
          else if (filter === "humanas") triVal = exam.tri_ch;
          else if (filter === "natureza") triVal = exam.tri_cn;
          else if (filter === "matematica") triVal = exam.tri_mt;

          if (triVal === null) return null;
          return {
            label,
            title: exam.title,
            tri: Number(triVal),
          };
        }

        // Modo Acertos (Brutos vs Reais)
        let raw: number | null = null;
        let real: number | null = null;

        if (exam.mode === "xray" && examQs.length > 0) {
          const areaQs =
            filter === "geral"
              ? examQs
              : examQs.filter((q) => q.area === (filter as EnemArea));

          if (areaQs.length > 0) {
            real = areaQs.filter((q) => q.outcome === "real_correct").length;
            const guesses = areaQs.filter(
              (q) =>
                q.outcome === "guess_1" ||
                q.outcome === "guess_2" ||
                q.outcome === "guess_3"
            ).length;
            raw = real + guesses;
          }
        }

        // Fallback para campos score_* (Express ou Raio-X sem questões filtradas)
        if (raw === null) {
          if (filter === "geral") {
            const vals = [
              exam.score_lc,
              exam.score_ch,
              exam.score_cn,
              exam.score_mt,
            ].filter((v): v is number => v !== null);
            if (vals.length > 0) {
              raw = vals.reduce((a, b) => a + b, 0);
            }
          } else if (filter === "linguagens") raw = exam.score_lc;
          else if (filter === "humanas") raw = exam.score_ch;
          else if (filter === "natureza") raw = exam.score_cn;
          else if (filter === "matematica") raw = exam.score_mt;
        }

        if (raw === null) return null;

        return {
          label,
          title: exam.title,
          bruto: raw,
          real: real,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [sortedExams, questionsByExam, filter, metricMode]);

  // Média das 5 Competências da Redação (C1–C5)
  const essayCompetenciesData = useMemo(() => {
    const withComps = sortedExams.filter(
      (e) =>
        e.essay_c1 !== null ||
        e.essay_c2 !== null ||
        e.essay_c3 !== null ||
        e.essay_c4 !== null ||
        e.essay_c5 !== null
    );
    if (withComps.length === 0) return null;

    const avgOf = (getter: (e: MockExam) => number | null) => {
      const vals = withComps
        .map(getter)
        .filter((v): v is number => v !== null);
      if (vals.length === 0) return 0;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    return [
      { comp: "C1", media: avgOf((e) => e.essay_c1), desc: "Norma culta" },
      { comp: "C2", media: avgOf((e) => e.essay_c2), desc: "Tema e repertório" },
      { comp: "C3", media: avgOf((e) => e.essay_c3), desc: "Argumentação" },
      { comp: "C4", media: avgOf((e) => e.essay_c4), desc: "Coesão" },
      { comp: "C5", media: avgOf((e) => e.essay_c5), desc: "Intervenção" },
    ];
  }, [sortedExams]);

  return (
    <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
            Evolução nos Simulados
          </h2>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-0.5">
            Acompanhe sua trajetória ao longo do ano por área, TRI e redação.
          </p>
        </div>

        {filter !== "redacao" && (
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
            <button
              type="button"
              onClick={() => setMetricMode("scores")}
              className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-colors ${
                metricMode === "scores"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Acertos (Bruto vs. Real)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("tri")}
              className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-colors ${
                metricMode === "tri"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Nota TRI
            </button>
          </div>
        )}
      </div>

      {/* Filtros de Área / Redação */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1 rounded-full text-[12px] transition-colors cursor-pointer ${
              filter === tab.id
                ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gráfico Principal de Linhas */}
      {chartData.length === 0 ? (
        <div className="h-[240px] rounded-xl bg-[var(--bg-subtle)]/55 border border-[var(--border-hairline)] flex flex-col items-center justify-center p-6 text-center space-y-1">
          <p className="font-editorial text-[18px] text-[var(--text-primary)]">
            Sem dados suficientes neste filtro
          </p>
          <p className="text-[12.5px] text-[var(--text-secondary)] max-w-[380px]">
            {filter === "redacao"
              ? "Preencha a nota de redação em algum simulado para visualizar a curva."
              : metricMode === "tri"
              ? "Preencha as notas TRI nos seus simulados para acompanhar a evolução."
              : "Cadastre simulados em Modo Express ou Raio-X para ver sua linha de evolução."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 min-w-0">
          <div className="h-[240px] sm:h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="var(--border-hairline)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  interval="preserveStartEnd"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={filter === "redacao" ? [0, 1000] : ["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.title ?? ""
                }
              />

              {filter === "redacao" ? (
                <Line
                  type="monotone"
                  dataKey="redacao"
                  name="Redação"
                  stroke="var(--accent-sage)"
                  strokeWidth={2.2}
                  dot={{ r: 4, fill: "var(--accent-sage)" }}
                  activeDot={{ r: 6 }}
                />
              ) : metricMode === "tri" ? (
                <Line
                  type="monotone"
                  dataKey="tri"
                  name="Nota TRI"
                  stroke="var(--accent-slate)"
                  strokeWidth={2.2}
                  dot={{ r: 4, fill: "var(--accent-slate)" }}
                  activeDot={{ r: 6 }}
                />
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="bruto"
                    name="Acerto Bruto"
                    stroke="var(--accent-slate)"
                    strokeWidth={2.2}
                    dot={{ r: 4, fill: "var(--accent-slate)" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="real"
                    name="Acerto Real (sem chutes)"
                    stroke="var(--accent-sage)"
                    strokeWidth={2.2}
                    strokeDasharray="4 3"
                    connectNulls
                    dot={{ r: 4, fill: "var(--accent-sage)" }}
                    activeDot={{ r: 6 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
          </div>
          {filter !== "redacao" && metricMode === "scores" && (
            <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-[var(--text-secondary)] pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--accent-slate)] inline-block" />
                Acerto Bruto
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--accent-sage)] inline-block border-t border-dashed border-[var(--accent-sage)]" />
                Acerto Real (sem chutes)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mini Gráfico de Barras das 5 Competências da Redação (C1–C5) */}
      {essayCompetenciesData && (
        <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-medium text-[var(--text-primary)]">
              Média por Competência da Redação (C1–C5)
            </h3>
            <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
              Escala 0–200
            </span>
          </div>

          <div className="h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={essayCompetenciesData}
                margin={{ top: 6, right: 12, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--border-hairline)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="comp"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11.5 }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 200]}
                  ticks={[0, 80, 120, 160, 200]}
                  tick={{ fill: "var(--text-muted)", fontSize: 10.5 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-hairline)",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${value} pts`, "Média"]}
                  labelFormatter={(label, payload) => {
                    const desc = payload?.[0]?.payload?.desc;
                    return desc ? `${label} · ${desc}` : String(label);
                  }}
                />
                <Bar
                  dataKey="media"
                  fill="var(--accent-sage)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
