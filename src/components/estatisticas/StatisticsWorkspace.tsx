"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChartBar,
  Eye,
  Flame,
  Lightning,
  Play,
  SlidersHorizontal,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import {
  ConsistencyHeatmap,
  type DailyActivityData,
} from "@/components/estatisticas/ConsistencyHeatmap";
import { SimuladosEvolutionChart } from "@/components/estatisticas/SimuladosEvolutionChart";
import { StatsPageSkeleton } from "@/components/shared/EditorialSkeleton";
import { fetchCurriculumData } from "@/lib/curriculum-service";
import { fetchEnemSkills } from "@/lib/enem-service";
import { fetchExerciseLogs } from "@/lib/exercises-service";
import { fetchMockExamsAndQuestions } from "@/lib/mock-exams-service";
import { fetchStudySessions } from "@/lib/planner-service";
import { calculatePriorities } from "@/lib/priorityEngine";
import { ENEM_AREA_META } from "@/lib/enem-matrix-seed";
import type {
  EnemArea,
  EnemSkill,
  ExerciseLog,
  MockExam,
  MockQuestion,
  StudySession,
  Subject,
  Topic,
} from "@/types/database";

export function StatisticsWorkspace() {
  const { profile } = useProfileTheme();

  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [mockQuestions, setMockQuestions] = useState<MockQuestion[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [enemSkills, setEnemSkills] = useState<EnemSkill[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros do Ranking de Prioridade
  const [rankingMode, setRankingMode] = useState<"topic" | "enem_skill">(
    "topic"
  );
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<"all" | EnemArea>("all");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logs, sims, sessions, curriculum, skills] = await Promise.all([
        fetchExerciseLogs(),
        fetchMockExamsAndQuestions(),
        fetchStudySessions(),
        fetchCurriculumData(),
        fetchEnemSkills(),
      ]);
      setExerciseLogs(logs);
      setMockExams(sims.exams);
      setMockQuestions(sims.questions);
      setStudySessions(sessions);
      setSubjects(curriculum.subjects);
      setTopics(curriculum.topics);
      setEnemSkills(skills);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar suas estatísticas."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const examMap = useMemo(
    () => new Map(mockExams.map((e) => [e.id, e])),
    [mockExams]
  );

  // Executa o motor matemático com os pesos personalizados do usuário
  const engine = useMemo(
    () =>
      calculatePriorities({
        exerciseLogs,
        mockExams,
        mockQuestions,
        weights: profile.priority_weights,
        halfLifeDays: profile.decay_half_life_days,
        smoothingC: profile.smoothing_c,
        targetRetention: profile.fsrs_target_retention,
        autoModeUrgencyWeight: profile.auto_mode_urgency_weight,
        subjects,
        topics,
        enemSkills,
      }),
    [
      exerciseLogs,
      mockExams,
      mockQuestions,
      profile.priority_weights,
      profile.decay_half_life_days,
      profile.smoothing_c,
      profile.fsrs_target_retention,
      profile.auto_mode_urgency_weight,
      subjects,
      topics,
      enemSkills,
    ]
  );

  const visibleRanking = useMemo(() => {
    if (rankingMode === "topic") {
      return engine.topicPriorities.filter((item) =>
        subjectFilter === "all" ? true : item.subjectId === subjectFilter
      );
    }
    return engine.enemSkillPriorities.filter((item) =>
      areaFilter === "all" ? true : item.area === areaFilter
    );
  }, [engine, rankingMode, subjectFilter, areaFilter]);

  // Radar de Atenção: % de erros por falta de atenção + pílulas de erro recentes
  const attentionRadar = useMemo(() => {
    const s = engine.overallSummary;
    const totalErrors = s.errorGap + s.errorAttention + s.errorOther;
    const pctOfErrors =
      totalErrors > 0
        ? Math.round((s.errorAttention / totalErrors) * 1000) / 10
        : 0;

    const pills = mockQuestions
      .filter(
        (q) => q.outcome === "error_attention" && Boolean(q.error_note?.trim())
      )
      .map((q) => {
        const exam = examMap.get(q.mock_exam_id);
        return {
          id: q.id,
          examTitle: exam?.title ?? "Simulado",
          examDate: exam?.date ?? "",
          questionNumber: q.question_number,
          note: q.error_note?.trim() ?? "",
        };
      })
      .sort((a, b) => b.examDate.localeCompare(a.examDate))
      .slice(0, 6);

    return {
      attentionCount: s.errorAttention,
      totalErrors,
      pctOfErrors,
      pills,
    };
  }, [engine.overallSummary, mockQuestions, examMap]);

  // Mapa diário de consistência (Tempo Estudado + Questões Feitas)
  const dailyActivityMap = useMemo(() => {
    const map: Record<string, DailyActivityData> = {};
    const ensure = (iso: string) => {
      if (!map[iso]) map[iso] = { date: iso, minutes: 0, questions: 0 };
      return map[iso];
    };

    for (const session of studySessions) {
      ensure(session.date).minutes += session.duration_minutes;
    }
    for (const log of exerciseLogs) {
      ensure(log.date).questions += log.total_questions;
    }
    for (const q of mockQuestions) {
      const examDate = examMap.get(q.mock_exam_id)?.date;
      if (examDate) ensure(examDate).questions += 1;
    }

    return map;
  }, [studySessions, exerciseLogs, mockQuestions, examMap]);

  const summary = engine.overallSummary;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div className="space-y-1">
          <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
            Diagnóstico &amp; Desempenho
          </p>
          <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            Estatísticas
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Prioridade algorítmica, evolução em simulados, choque de realidade e
            consistência anual.
          </p>
        </div>

        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors self-start sm:self-auto"
        >
          <SlidersHorizontal size={15} weight="light" />
          <span>Ajustar pesos da fórmula</span>
        </Link>
      </header>

      {error && (
        <div className="rounded-xl px-4 py-3 bg-[var(--accent-terracotta-soft)] border border-[var(--accent-terracotta)]/30 text-[13px] text-[var(--accent-terracotta)] flex items-center gap-2">
          <WarningCircle size={17} weight="duotone" className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <StatsPageSkeleton />
      ) : (
        <>
          {/* =================================================================
              1. RANKING DE PRIORIDADE DE ESTUDO
             ================================================================= */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lightning
                  size={20}
                  weight="duotone"
                  className="text-[var(--accent-terracotta)]"
                />
                <div>
                  <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
                    Ranking de Prioridade de Estudo
                  </h2>
                  <p className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                    Meia-vida {profile.decay_half_life_days}d · Amortecimento C=
                    {profile.smoothing_c}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
                <button
                  type="button"
                  onClick={() => setRankingMode("topic")}
                  className={`px-3 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors ${
                    rankingMode === "topic"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  Por Matéria / Assunto ({engine.topicPriorities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRankingMode("enem_skill")}
                  className={`px-3 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors ${
                    rankingMode === "enem_skill"
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  Por Habilidade ENEM ({engine.enemSkillPriorities.length})
                </button>
              </div>
            </div>

            {/* Sub-filtros por Matéria ou Área */}
            {rankingMode === "topic" && subjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubjectFilter("all")}
                  className={`px-3 py-1 rounded-full text-[12px] cursor-pointer ${
                    subjectFilter === "all"
                      ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Todas as matérias
                </button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubjectFilter(s.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] cursor-pointer ${
                      subjectFilter === s.id
                        ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            )}

            {rankingMode === "enem_skill" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAreaFilter("all")}
                  className={`px-3 py-1 rounded-full text-[12px] cursor-pointer ${
                    areaFilter === "all"
                      ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  Todas as áreas
                </button>
                {(
                  ["linguagens", "humanas", "natureza", "matematica"] as const
                ).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFilter(area)}
                    className={`px-3 py-1 rounded-full text-[12px] cursor-pointer ${
                      areaFilter === area
                        ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {ENEM_AREA_META[area].shortLabel}
                  </button>
                ))}
              </div>
            )}

            {/* Lista ranqueada */}
            {visibleRanking.length === 0 ? (
              <div className="p-8 rounded-xl bg-[var(--bg-subtle)]/55 border border-[var(--border-hairline)] text-center space-y-3">
                <p className="font-editorial text-[19px] text-[var(--text-primary)]">
                  {rankingMode === "topic"
                    ? "Nenhum assunto avaliado ainda"
                    : "Nenhuma habilidade ENEM avaliada ainda"}
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] max-w-[460px] mx-auto">
                  {rankingMode === "topic"
                    ? "Registre baterias em Exercícios ou corrija um simulado no Modo Raio-X para gerar sua fila de prioridade."
                    : "Corrija um simulado em Modo Raio-X vinculando questões às habilidades H1–H30 para ver o ranking da Matriz ENEM."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Link
                    href={rankingMode === "topic" ? "/exercicios" : "/simulados"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[12.5px] font-medium"
                  >
                    <span>
                      {rankingMode === "topic"
                        ? "Registrar primeira bateria"
                        : "Criar simulado Raio-X"}
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleRanking.slice(0, 20).map((item, idx) => {
                  const subj = item.subjectId
                    ? subjectMap.get(item.subjectId)
                    : undefined;
                  const isHigh = item.urgencyScore >= 65;
                  const isMedium =
                    item.urgencyScore >= 35 && item.urgencyScore < 65;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/80 flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="font-mono-tabular text-[12px] text-[var(--text-muted)] w-6 pt-0.5 shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {subj && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: subj.color }}
                              />
                            )}
                            <span className="text-[14.5px] font-medium text-[var(--text-primary)]">
                              {item.label}
                            </span>
                            {item.kind === "topic" && item.secondaryLabel && (
                              <span className="text-[12px] text-[var(--text-secondary)]">
                                • {item.secondaryLabel}
                              </span>
                            )}
                            {item.kind === "enem_skill" && item.area && (
                              <span className="font-mono-tabular text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--text-secondary)]">
                                {ENEM_AREA_META[item.area as EnemArea]?.shortLabel ??
                                  item.area}
                              </span>
                            )}
                          </div>

                          {item.kind === "enem_skill" && item.secondaryLabel && (
                            <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 leading-snug">
                              {item.secondaryLabel}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                            <span>{item.totalQuestions} questões</span>
                            <span>Bruto {item.rawAccuracyPct}%</span>
                            <span className="text-[var(--accent-sage)]">
                              Real {item.realAccuracyPct}%
                            </span>
                            {item.guessesTotal > 0 && (
                              <span className="text-[var(--accent-ochre)]">
                                {item.guessesTotal} chutes
                              </span>
                            )}
                            {item.errorGap > 0 && (
                              <span className="text-[var(--accent-terracotta)]">
                                {item.errorGap} lacunas
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pl-9 md:pl-0 shrink-0">
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                            <span className="text-[var(--text-muted)]">
                              Urgência
                            </span>
                            <span
                              className={`font-semibold ${
                                isHigh
                                  ? "text-[var(--accent-terracotta)]"
                                  : isMedium
                                  ? "text-[var(--accent-ochre)]"
                                  : "text-[var(--accent-sage)]"
                              }`}
                            >
                              {item.urgencyScore}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${item.urgencyScore}%`,
                                backgroundColor: isHigh
                                  ? "var(--accent-terracotta)"
                                  : isMedium
                                  ? "var(--accent-ochre)"
                                  : "var(--accent-sage)",
                              }}
                            />
                          </div>
                        </div>

                        {item.kind === "topic" && (
                          <Link
                            href={`/planejador?subjectId=${item.subjectId ?? ""}&topicId=${item.id}&focusTimer=1`}
                            title="Estudar este assunto no cronômetro"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[11.5px] font-medium text-[var(--text-primary)]"
                          >
                            <Play size={12} weight="duotone" className="text-[var(--accent-sage)]" />
                            <span>Estudar</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* =================================================================
              2. EVOLUÇÃO NOS SIMULADOS (RECHARTS)
             ================================================================= */}
          <SimuladosEvolutionChart exams={mockExams} questions={mockQuestions} />

          {/* =================================================================
              3. CHOQUE DE REALIDADE + RADAR DE ATENÇÃO (2 COLUNAS)
             ================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Choque de Realidade */}
            <section className="lg:col-span-6 bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChartBar
                    size={19}
                    weight="duotone"
                    className="text-[var(--accent-terracotta)]"
                  />
                  <h2 className="font-editorial text-[21px] text-[var(--text-primary)] leading-tight">
                    Choque de Realidade
                  </h2>
                </div>
                <span className="font-mono-tabular text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                  {summary.totalQuestions} questões
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-secondary)]">
                      Acerto Bruto (Gabarito)
                    </span>
                    <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                      {summary.rawAccuracyPct.toFixed(1)}% ({summary.rawCorrect})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-slate)] rounded-full"
                      style={{ width: `${summary.rawAccuracyPct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-secondary)]">
                      Acerto Real (Sem chutes)
                    </span>
                    <span className="font-mono-tabular font-semibold text-[var(--accent-sage)]">
                      {summary.realAccuracyPct.toFixed(1)}% (
                      {summary.realCorrect})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-sage)] rounded-full"
                      style={{ width: `${summary.realAccuracyPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-hairline)] text-[12px]">
                  <span className="text-[var(--text-muted)]">
                    Viés de Ilusão de Competência
                  </span>
                  <span className="font-mono-tabular font-medium text-[var(--accent-terracotta)]">
                    -{summary.guessIllusionPct.toFixed(1)}% em chutes
                  </span>
                </div>
              </div>

              {/* Breakdown dos 3 Níveis de Chute */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Distribuição dos chutes ({summary.guessesTotal} no total)
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    {
                      label: "Nível 1",
                      sub: "Dúvida leve",
                      count: summary.guessesLevel1,
                    },
                    {
                      label: "Nível 2",
                      sub: "Entre 2 opções",
                      count: summary.guessesLevel2,
                    },
                    {
                      label: "Nível 3",
                      sub: "Chute total",
                      count: summary.guessesLevel3,
                    },
                  ].map((g) => (
                    <div
                      key={g.label}
                      className="p-3 rounded-xl bg-[var(--bg-subtle)]/75 border border-[var(--border-hairline)]/60"
                    >
                      <span className="font-mono-tabular text-[11px] text-[var(--accent-ochre)] font-medium block">
                        {g.label}
                      </span>
                      <span className="font-mono-tabular text-[20px] font-semibold text-[var(--text-primary)] block mt-0.5">
                        {g.count}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] block">
                        {g.sub}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Radar de Atenção */}
            <section className="lg:col-span-6 bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye
                    size={19}
                    weight="duotone"
                    className="text-[var(--accent-ochre)]"
                  />
                  <h2 className="font-editorial text-[21px] text-[var(--text-primary)] leading-tight">
                    Radar de Atenção
                  </h2>
                </div>
                <span className="font-mono-tabular text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)]">
                  Separado da teoria
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[12px] text-[var(--text-secondary)] block">
                    Erros por Falta de Atenção
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-mono-tabular text-[26px] font-semibold text-[var(--text-primary)] leading-none">
                      {attentionRadar.attentionCount}
                    </span>
                    <span className="font-mono-tabular text-[13px] text-[var(--accent-ochre)] font-medium">
                      ({attentionRadar.pctOfErrors.toFixed(1)}% dos seus erros)
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                  <span>{attentionRadar.totalErrors} erros totais</span>
                </div>
              </div>

              {/* Últimas pílulas de erro por descuido */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Últimas pílulas de erro por descuido
                </p>

                {attentionRadar.pills.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[var(--bg-subtle)]/55 border border-[var(--border-hairline)] text-[12.5px] text-[var(--text-muted)] leading-relaxed">
                    Quando você marcar uma questão como{" "}
                    <strong className="text-[var(--text-secondary)]">
                      Erro: Falta de Atenção
                    </strong>{" "}
                    no Modo Raio-X e escrever a pílula de erro, ela aparecerá
                    aqui para ajudar você a eliminar descuidos repetitivos.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                    {attentionRadar.pills.map((pill) => (
                      <div
                        key={pill.id}
                        className="p-3 rounded-xl bg-[var(--bg-subtle)]/75 border border-[var(--border-hairline)]/60 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 font-mono-tabular text-[11px] text-[var(--text-muted)]">
                          <span className="truncate">{pill.examTitle}</span>
                          <span className="shrink-0">
                            Q{String(pill.questionNumber).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-[var(--text-primary)] leading-snug">
                          {pill.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* =================================================================
              4. HEATMAP ANUAL DE CONSISTÊNCIA (ÚLTIMOS 12 MESES)
             ================================================================= */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center gap-2">
              <Flame
                size={19}
                weight="duotone"
                className="text-[var(--accent-sage)]"
              />
              <div>
                <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
                  Heatmap Anual de Consistência
                </h2>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  Seus últimos 12 meses de dedicação contínua.
                </p>
              </div>
            </div>

            <ConsistencyHeatmap
              dailyMap={dailyActivityMap}
              weeksCount={52}
              defaultMetric="minutes"
              showMetricToggle
            />
          </section>
        </>
      )}
    </div>
  );
}
