"use client";

import React, { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDatePtBr } from "@/lib/date-utils";
import { groupMockExams, type GroupedMockExam } from "@/lib/mockGrouping";
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
  const uid = useId().replace(/:/g, "");
  const [filter, setFilter] = useState<ChartFilter>("geral");
  const [metricMode, setMetricMode] = useState<"scores" | "tri">("scores");

  // Agrupa automaticamente provas de 2 dias (ex: ENEM 2024 Dia 1 + Dia 2 -> 1 ponto consolidado)
  const groupedSorted: GroupedMockExam[] = useMemo(
    () =>
      groupMockExams(exams, questions).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    [exams, questions]
  );

  const chartData = useMemo(() => {
    return groupedSorted
      .map((group) => {
        const label = formatShortDatePtBr(group.date);
        const title = group.isGrouped
          ? `${group.displayTitle} (${group.parts.length} dias)`
          : group.displayTitle;

        if (filter === "redacao") {
          if (group.essay.essay_total === null) return null;
          return {
            label,
            title,
            redacao: group.essay.essay_total,
          };
        }

        if (metricMode === "tri") {
          let triVal: number | null = null;
          if (filter === "geral") {
            const vals = [
              group.triByArea.tri_lc,
              group.triByArea.tri_ch,
              group.triByArea.tri_cn,
              group.triByArea.tri_mt,
            ].filter((v): v is number => v !== null);
            if (vals.length > 0) {
              triVal =
                Math.round(
                  (vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10
                ) / 10;
            }
          } else if (filter === "linguagens") triVal = group.triByArea.tri_lc;
          else if (filter === "humanas") triVal = group.triByArea.tri_ch;
          else if (filter === "natureza") triVal = group.triByArea.tri_cn;
          else if (filter === "matematica") triVal = group.triByArea.tri_mt;

          if (triVal === null) return null;
          return {
            label,
            title,
            tri: Number(triVal),
          };
        }

        // Modo Acertos (Brutos vs Reais)
        let raw: number | null = null;
        let real: number | null = null;

        if (group.hasDetailedQuestions) {
          const areaQs =
            filter === "geral"
              ? group.allQuestions
              : group.allQuestions.filter(
                  (q) => q.area === (filter as EnemArea)
                );

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

        if (raw === null) {
          if (filter === "geral") {
            const vals = [
              group.scoresByArea.score_lc,
              group.scoresByArea.score_ch,
              group.scoresByArea.score_cn,
              group.scoresByArea.score_mt,
            ].filter((v): v is number => v !== null);
            if (vals.length > 0) {
              raw = vals.reduce((a, b) => a + b, 0);
            }
          } else if (filter === "linguagens") raw = group.scoresByArea.score_lc;
          else if (filter === "humanas") raw = group.scoresByArea.score_ch;
          else if (filter === "natureza") raw = group.scoresByArea.score_cn;
          else if (filter === "matematica") raw = group.scoresByArea.score_mt;
        }

        if (raw === null) return null;

        return {
          label,
          title,
          bruto: raw,
          real,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [groupedSorted, filter, metricMode]);

  // Média das 5 Competências da Redação (C1–C5) sobre os simulados consolidados
  const essayCompetenciesData = useMemo(() => {
    const withComps = groupedSorted.filter(
      (g) =>
        g.essay.essay_c1 !== null ||
        g.essay.essay_c2 !== null ||
        g.essay.essay_c3 !== null ||
        g.essay.essay_c4 !== null ||
        g.essay.essay_c5 !== null
    );
    if (withComps.length === 0) return null;

    const avgOf = (getter: (g: GroupedMockExam) => number | null) => {
      const vals = withComps
        .map(getter)
        .filter((v): v is number => v !== null);
      if (vals.length === 0) return 0;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    return [
      { comp: "C1", media: avgOf((g) => g.essay.essay_c1), desc: "Norma culta" },
      { comp: "C2", media: avgOf((g) => g.essay.essay_c2), desc: "Tema e repertório" },
      { comp: "C3", media: avgOf((g) => g.essay.essay_c3), desc: "Argumentação" },
      { comp: "C4", media: avgOf((g) => g.essay.essay_c4), desc: "Coesão" },
      { comp: "C5", media: avgOf((g) => g.essay.essay_c5), desc: "Intervenção" },
    ];
  }, [groupedSorted]);

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

      {/* Filtros de Área / Redação com pílula deslizante suave */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`relative px-3 py-1 rounded-full text-[12px] transition-colors cursor-pointer ${
                active
                  ? "text-[var(--bg-canvas)] font-medium"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="simuladosFilterPill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[var(--text-primary)]"
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
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
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
              >
                <defs>
                  <linearGradient id={`sim-slate-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-slate)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--accent-slate)" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id={`sim-sage-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-sage)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--accent-sage)" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id={`sim-terra-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-terracotta)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--accent-terracotta)" stopOpacity={0.01} />
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
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                  axisLine={{ stroke: "var(--border-hairline)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "var(--text-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
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
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-primary)",
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.title ?? ""
                  }
                />

                {filter === "redacao" ? (
                  <Area
                    type="monotone"
                    dataKey="redacao"
                    name="Redação"
                    stroke="var(--accent-sage)"
                    strokeWidth={2.2}
                    fill={`url(#sim-sage-${uid})`}
                    dot={{ r: 3.5, fill: "var(--bg-card)", strokeWidth: 2 }}
                    activeDot={{ r: 5.5 }}
                  />
                ) : metricMode === "tri" ? (
                  <Area
                    type="monotone"
                    dataKey="tri"
                    name="Nota TRI"
                    stroke="var(--accent-slate)"
                    strokeWidth={2.2}
                    fill={`url(#sim-slate-${uid})`}
                    dot={{ r: 3.5, fill: "var(--bg-card)", strokeWidth: 2 }}
                    activeDot={{ r: 5.5 }}
                  />
                ) : (
                  <>
                    <Area
                      type="monotone"
                      dataKey="bruto"
                      name="Acerto Bruto"
                      stroke="var(--accent-slate)"
                      strokeWidth={2.2}
                      fill={`url(#sim-slate-${uid})`}
                      dot={{ r: 3.5, fill: "var(--bg-card)", strokeWidth: 2 }}
                      activeDot={{ r: 5.5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="real"
                      name="Acerto Real (sem chutes)"
                      stroke="var(--accent-terracotta)"
                      strokeWidth={2.2}
                      fill={`url(#sim-terra-${uid})`}
                      connectNulls
                      dot={{ r: 3.5, fill: "var(--bg-card)", strokeWidth: 2 }}
                      activeDot={{ r: 5.5 }}
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {filter !== "redacao" && metricMode === "scores" && (
            <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-[var(--text-secondary)] pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-slate)] inline-block" />
                Acerto Bruto
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-terracotta)] inline-block" />
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
