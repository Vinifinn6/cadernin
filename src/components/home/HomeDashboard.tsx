"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartBar,
  Check,
  CloudSlash,
  Flame,
  Lightning,
  Play,
  Plus,
} from "@phosphor-icons/react";
import { ProfileHeroBanner } from "@/components/home/ProfileHeroBanner";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import {
  ConsistencyHeatmap,
  type DailyActivityData,
} from "@/components/estatisticas/ConsistencyHeatmap";
import { fetchCurriculumData } from "@/lib/curriculum-service";
import { fetchEnemSkills } from "@/lib/enem-service";
import { fetchExerciseLogs } from "@/lib/exercises-service";
import { fetchMockExamsAndQuestions } from "@/lib/mock-exams-service";
import {
  createWeeklyPlanItem,
  fetchStudySessions,
  fetchWeeklyPlanItems,
  updateWeeklyPlanItem,
} from "@/lib/planner-service";
import { calculatePriorities } from "@/lib/priorityEngine";
import {
  addDays,
  formatMinutesHuman,
  formatShortDatePtBr,
  getStartOfWeekMonday,
  getTodayIso,
  parseLocalIsoDate,
  toLocalIsoDate,
} from "@/lib/date-utils";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  EnemSkill,
  ExerciseLog,
  MockExam,
  MockQuestion,
  StudySession,
  Subject,
  Topic,
  WeeklyPlanItem,
} from "@/types/database";

const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function HomeDashboard() {
  const { profile, supabaseStatus } = useProfileTheme();

  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [mockQuestions, setMockQuestions] = useState<MockQuestion[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [planItems, setPlanItems] = useState<WeeklyPlanItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [enemSkills, setEnemSkills] = useState<EnemSkill[]>([]);

  const todayIso = getTodayIso();
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [addingQuickTask, setAddingQuickTask] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const [logs, sims, sessions, items, curriculum, skills] =
        await Promise.all([
          fetchExerciseLogs(),
          fetchMockExamsAndQuestions(),
          fetchStudySessions(),
          fetchWeeklyPlanItems(),
          fetchCurriculumData(),
          fetchEnemSkills(),
        ]);

      setExerciseLogs(logs);
      setMockExams(sims.exams);
      setMockQuestions(sims.questions);
      setStudySessions(sessions);
      setPlanItems(items);
      setSubjects(curriculum.subjects);
      setTopics(curriculum.topics);
      setEnemSkills(skills);
    } catch {
      // Mantém estado vazio suave caso offline
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const examMap = useMemo(
    () => new Map(mockExams.map((e) => [e.id, e])),
    [mockExams]
  );

  // 1. Motor de Prioridade — Top 4 assuntos (ou habilidades ENEM se não houver assuntos)
  const engine = useMemo(
    () =>
      calculatePriorities({
        exerciseLogs,
        mockExams,
        mockQuestions,
        weights: profile.priority_weights,
        halfLifeDays: profile.decay_half_life_days,
        smoothingC: profile.smoothing_c,
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
      subjects,
      topics,
      enemSkills,
    ]
  );

  const topUrgent = useMemo(() => {
    if (engine.topicPriorities.length > 0) {
      return engine.topicPriorities.slice(0, 4);
    }
    return engine.enemSkillPriorities.slice(0, 4);
  }, [engine]);

  // 2. Minicalendário Mensal + Tarefas do Dia Selecionado
  const planItemsByDate = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem[]>();
    for (const item of planItems) {
      const list = map.get(item.planned_date) ?? [];
      list.push(item);
      map.set(item.planned_date, list);
    }
    return map;
  }, [planItems]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: ({ iso: string; day: number; hasTasks: boolean } | null)[] =
      [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toLocalIsoDate(new Date(year, month, d));
      cells.push({
        iso,
        day: d,
        hasTasks: (planItemsByDate.get(iso)?.length ?? 0) > 0,
      });
    }
    return cells;
  }, [calendarMonth, planItemsByDate]);

  const selectedDayTasks = planItemsByDate.get(selectedDateIso) ?? [];
  const selectedDayDoneCount = selectedDayTasks.filter(
    (t) => t.is_completed
  ).length;

  const handleToggleHomeTask = async (task: WeeklyPlanItem) => {
    const next = !task.is_completed;
    setPlanItems((prev) =>
      prev.map((it) =>
        it.id === task.id ? { ...it, is_completed: next } : it
      )
    );
    try {
      await updateWeeklyPlanItem(task.id, { is_completed: next });
    } catch {
      void loadDashboardData();
    }
  };

  const handleAddQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTaskTitle.trim();
    if (!trimmed) return;
    setAddingQuickTask(true);
    try {
      const created = await createWeeklyPlanItem({
        planned_date: selectedDateIso,
        subject_id: null,
        topic_id: null,
        title: trimmed,
      });
      setPlanItems((prev) => [...prev, created]);
      setQuickTaskTitle("");
    } finally {
      setAddingQuickTask(false);
    }
  };

  // 3. Resumo de Ritmo: mapa diário, streak real, minutos hoje e na semana
  const dailyActivityMap = useMemo(() => {
    const map: Record<string, DailyActivityData> = {};
    const ensure = (iso: string) => {
      if (!map[iso]) map[iso] = { date: iso, minutes: 0, questions: 0 };
      return map[iso];
    };
    for (const s of studySessions) ensure(s.date).minutes += s.duration_minutes;
    for (const l of exerciseLogs) ensure(l.date).questions += l.total_questions;
    for (const q of mockQuestions) {
      const d = examMap.get(q.mock_exam_id)?.date;
      if (d) ensure(d).questions += 1;
    }
    return map;
  }, [studySessions, exerciseLogs, mockQuestions, examMap]);

  const rhythmStats = useMemo(() => {
    const todayMinutes = dailyActivityMap[todayIso]?.minutes ?? 0;

    const mondayIso = toLocalIsoDate(getStartOfWeekMonday(new Date()));
    const weekMinutes = studySessions
      .filter((s) => s.date >= mondayIso && s.date <= todayIso)
      .reduce((acc, s) => acc + s.duration_minutes, 0);

    // Calcula sequência de dias ativos (streak)
    let streak = 0;
    let cursor = new Date();
    // Se hoje ainda não teve atividade, começa a checar de ontem para não zerar o streak de manhã
    const hasToday =
      (dailyActivityMap[todayIso]?.minutes ?? 0) > 0 ||
      (dailyActivityMap[todayIso]?.questions ?? 0) > 0;
    if (!hasToday) {
      cursor = addDays(cursor, -1);
    }

    for (let i = 0; i < 365; i++) {
      const iso = toLocalIsoDate(cursor);
      const entry = dailyActivityMap[iso];
      if (entry && (entry.minutes > 0 || entry.questions > 0)) {
        streak += 1;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }

    return { todayMinutes, weekMinutes, streak };
  }, [dailyActivityMap, studySessions, todayIso]);

  // 4. Último Simulado / Choque de Realidade
  const latestExamSummary = useMemo(() => {
    if (mockExams.length === 0) return null;
    const latest = mockExams[0];
    const examQs = mockQuestions.filter((q) => q.mock_exam_id === latest.id);

    if (latest.mode === "xray" && examQs.length > 0) {
      const total = examQs.length;
      const real = examQs.filter((q) => q.outcome === "real_correct").length;
      const guesses = examQs.filter(
        (q) =>
          q.outcome === "guess_1" ||
          q.outcome === "guess_2" ||
          q.outcome === "guess_3"
      ).length;
      const raw = real + guesses;
      const rawPct = Math.round((raw / total) * 1000) / 10;
      const realPct = Math.round((real / total) * 1000) / 10;
      return {
        exam: latest,
        isXray: true,
        total,
        raw,
        real,
        guesses,
        rawPct,
        realPct,
        diffPct: Math.round((rawPct - realPct) * 10) / 10,
      };
    }

    const expressRaw =
      (latest.score_lc ?? 0) +
      (latest.score_ch ?? 0) +
      (latest.score_cn ?? 0) +
      (latest.score_mt ?? 0);

    return {
      exam: latest,
      isXray: false,
      total: 0,
      raw: expressRaw,
      real: 0,
      guesses: 0,
      rawPct: 0,
      realPct: 0,
      diffPct: 0,
    };
  }, [mockExams, mockQuestions]);

  const dailyGoalHours = (profile.daily_goal_minutes / 60).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Banner Editorial + Foto de Perfil + Saudação Personalizada */}
      <ProfileHeroBanner />

      {supabaseStatus === "unconfigured" && (
        <div className="rounded-2xl px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-[13px] text-[var(--text-secondary)]">
            <CloudSlash
              size={18}
              weight="duotone"
              className="text-[var(--accent-ochre)] shrink-0 mt-0.5 sm:mt-0"
            />
            <p>
              <span className="font-medium text-[var(--text-primary)]">
                Banco ainda em modo local.
              </span>{" "}
              Configure seu <code className="font-mono-tabular">.env.local</code>{" "}
              para sincronizar seus estudos.
            </p>
          </div>
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-sage)] hover:underline shrink-0"
          >
            <span>Configurações</span>
            <ArrowRight size={14} weight="light" />
          </Link>
        </div>
      )}

      {/* =====================================================================
          GRID BENTO EDITORIAL (4 MÓDULOS CONECTADOS AOS DADOS REAIS)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: Assuntos Mais Urgentes + Resumo de Ritmo */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. ASSUNTOS MAIS URGENTES (TOP 4 DO MOTOR) */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lightning
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-terracotta)]"
                />
                <h2 className="font-editorial text-[20px] leading-tight text-[var(--text-primary)]">
                  Assuntos Mais Urgentes
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                Top 4 · Prioridade
              </span>
            </div>

            {topUrgent.length === 0 ? (
              <div className="p-5 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/60 text-center space-y-2">
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Sua fila de prioridades ainda está vazia
                </p>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                  Registre listas em Exercícios ou corrija um simulado Raio-X
                  para o motor calcular automaticamente o que revisar primeiro.
                </p>
                <Link
                  href="/exercicios"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-sage)] hover:underline pt-1"
                >
                  <span>Registrar exercícios</span>
                  <ArrowRight size={13} weight="light" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topUrgent.map((item) => {
                  const subj = item.subjectId
                    ? subjectMap.get(item.subjectId)
                    : undefined;
                  const high = item.urgencyScore >= 65;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-[var(--bg-subtle)]/75 hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                subj?.color ?? "var(--accent-slate)",
                            }}
                          />
                          <Link
                            href="/cronograma"
                            className="text-[14px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-sage)] truncate"
                          >
                            {item.label}
                          </Link>
                          {item.kind === "topic" && item.secondaryLabel && (
                            <span className="text-[11.5px] text-[var(--text-secondary)] truncate">
                              • {item.secondaryLabel}
                            </span>
                          )}
                        </div>
                        <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                          {item.realAccuracyPct}% real · {item.totalQuestions}{" "}
                          questões
                          {item.errorGap > 0 ? ` · ${item.errorGap} lacunas` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono-tabular text-[11px] font-medium ${
                            high
                              ? "bg-[var(--accent-terracotta-soft)] text-[var(--accent-terracotta)]"
                              : "bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                          }`}
                        >
                          Urgência {item.urgencyScore}
                        </span>

                        {item.kind === "topic" && (
                          <Link
                            href={`/planejador?subjectId=${item.subjectId ?? ""}&topicId=${item.id}&focusTimer=1`}
                            title="Iniciar cronômetro neste assunto"
                            aria-label={`Iniciar cronômetro em ${item.label}`}
                            className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-sage-soft)] border border-[var(--border-hairline)] text-[var(--accent-sage)] flex items-center justify-center transition-colors"
                          >
                            <Play size={13} weight="duotone" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Link
              href="/estatisticas"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent-sage)] hover:underline underline-offset-4 pt-0.5"
            >
              <span>Ver diagnóstico completo</span>
              <ArrowRight size={15} weight="light" />
            </Link>
          </section>

          {/* 2. RESUMO DE RITMO + CRONÔMETRO RÁPIDO */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-sage)]"
                />
                <h2 className="font-editorial text-[20px] leading-tight text-[var(--text-primary)]">
                  Ritmo de Estudos
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-mono-tabular text-[11px] font-medium">
                {rhythmStats.streak}{" "}
                {rhythmStats.streak === 1 ? "dia seguido" : "dias seguidos"}
              </span>
            </div>

            <ConsistencyHeatmap
              dailyMap={dailyActivityMap}
              weeksCount={14}
              compact
              defaultMetric="minutes"
              showMetricToggle={false}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-hairline)]/60">
                <span className="text-[11.5px] font-medium text-[var(--text-secondary)] block">
                  Hoje registrado
                </span>
                <span className="font-mono-tabular text-[20px] font-medium text-[var(--text-primary)] block mt-1">
                  {formatMinutesHuman(rhythmStats.todayMinutes)}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                  Meta diária: {dailyGoalHours}h
                </span>
              </div>

              <div className="p-3.5 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-hairline)]/60">
                <span className="text-[11.5px] font-medium text-[var(--text-secondary)] block">
                  Esta semana
                </span>
                <span className="font-mono-tabular text-[20px] font-medium text-[var(--text-primary)] block mt-1">
                  {formatMinutesHuman(rhythmStats.weekMinutes)}
                </span>
                <span className="text-[11px] text-[var(--accent-sage)] block mt-0.5">
                  Desde segunda-feira
                </span>
              </div>
            </div>

            <Link
              href="/planejador?focusTimer=1"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors"
            >
              <Play size={16} weight="duotone" />
              <span>Iniciar Cronômetro / Pomodoro</span>
            </Link>
          </section>
        </div>

        {/* COLUNA DIREITA: Minicalendário + Tarefas + Último Simulado / Choque de Realidade */}
        <div className="lg:col-span-6 space-y-6">
          {/* 3. MINICALENDÁRIO MENSAL + TAREFAS DO DIA */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarBlank
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-sage)]"
                />
                <h2 className="font-editorial text-[20px] leading-tight text-[var(--text-primary)]">
                  Calendário &amp; Tarefas
                </h2>
              </div>
              <span className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                {selectedDayDoneCount} de {selectedDayTasks.length} feitas
              </span>
            </div>

            {/* Minicalendário Mensal Compacto */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  {MONTH_NAMES_PT[calendarMonth.getMonth()]}{" "}
                  <span className="font-mono-tabular text-[var(--text-muted)] font-normal">
                    {calendarMonth.getFullYear()}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) =>
                          new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                      )
                    }
                    aria-label="Mês anterior"
                    className="w-6 h-6 rounded-md hover:bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
                  >
                    <CaretLeft size={13} weight="light" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setCalendarMonth(
                        new Date(now.getFullYear(), now.getMonth(), 1)
                      );
                      setSelectedDateIso(todayIso);
                    }}
                    className="px-1.5 py-0.5 rounded text-[10.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) =>
                          new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                      )
                    }
                    aria-label="Próximo mês"
                    className="w-6 h-6 rounded-md hover:bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
                  >
                    <CaretRight size={13} weight="light" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_INITIALS.map((letter, idx) => (
                  <span
                    key={idx}
                    className="font-mono-tabular text-[10px] text-[var(--text-muted)] py-0.5"
                  >
                    {letter}
                  </span>
                ))}

                {calendarCells.map((cell, idx) => {
                  if (!cell) {
                    return <span key={`empty-${idx}`} className="h-8" />;
                  }
                  const isSelected = cell.iso === selectedDateIso;
                  const isToday = cell.iso === todayIso;

                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => setSelectedDateIso(cell.iso)}
                      className={`h-8 rounded-lg flex flex-col items-center justify-center relative transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[var(--accent-sage)] text-[#FAF8F5] font-medium"
                          : isToday
                          ? "bg-[var(--bg-card)] border border-[var(--accent-sage)] text-[var(--text-primary)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
                      }`}
                    >
                      <span className="font-mono-tabular text-[11.5px] leading-none">
                        {cell.day}
                      </span>
                      {cell.hasTasks && (
                        <span
                          className={`w-1 h-1 rounded-full mt-0.5 ${
                            isSelected
                              ? "bg-[#FAF8F5]"
                              : "bg-[var(--accent-sage)]"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de Tarefas do Dia Selecionado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[var(--text-primary)]">
                  {selectedDateIso === todayIso
                    ? "Tarefas de hoje"
                    : `Tarefas de ${formatShortDatePtBr(selectedDateIso)} (${parseLocalIsoDate(
                        selectedDateIso
                      ).toLocaleDateString("pt-BR", { weekday: "short" })})`}
                </span>
                <Link
                  href="/planejador"
                  className="text-[11.5px] text-[var(--accent-sage)] hover:underline"
                >
                  Abrir semana
                </Link>
              </div>

              {selectedDayTasks.length === 0 ? (
                <p className="text-[12.5px] text-[var(--text-muted)] py-3 text-center rounded-xl bg-[var(--bg-subtle)]/50 border border-[var(--border-hairline)]/60">
                  Nenhuma tarefa planejada para este dia.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map((task) => {
                    const subj = task.subject_id
                      ? subjectMap.get(task.subject_id)
                      : null;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => void handleToggleHomeTask(task)}
                        className="w-full text-left flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-subtle)]/75 hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 transition-colors cursor-pointer"
                      >
                        <span
                          className={`mt-0.5 w-4.5 h-4.5 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                            task.is_completed
                              ? "bg-[var(--accent-sage)] border-[var(--accent-sage)] text-[#FAF8F5]"
                              : "border-[var(--border-strong)] bg-[var(--bg-card)]"
                          }`}
                        >
                          {task.is_completed && (
                            <Check size={11} weight="bold" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[13.5px] leading-snug ${
                              task.is_completed
                                ? "line-through text-[var(--text-muted)]"
                                : "text-[var(--text-primary)] font-medium"
                            }`}
                          >
                            {task.title}
                          </p>
                          {subj && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] mt-0.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: subj.color }}
                              />
                              {subj.name}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Input de tarefa rápida direto na Home */}
              <form
                onSubmit={(e) => void handleAddQuickTask(e)}
                className="flex gap-2 pt-1"
              >
                <input
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder="Adicionar tarefa rápida neste dia..."
                  className="flex-1 px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13px] text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  disabled={addingQuickTask || !quickTaskTitle.trim()}
                  aria-label="Adicionar tarefa rápida"
                  className="px-3 py-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer disabled:opacity-45"
                >
                  <Plus size={15} weight="light" />
                </button>
              </form>
            </div>
          </section>

          {/* 4. ÚLTIMO SIMULADO / CHOQUE DE REALIDADE */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ChartBar
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-terracotta)]"
                />
                <h2 className="font-editorial text-[20px] leading-tight text-[var(--text-primary)]">
                  {latestExamSummary
                    ? "Último Simulado & Realidade"
                    : "Choque de Realidade"}
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                {latestExamSummary
                  ? formatShortDatePtBr(latestExamSummary.exam.date)
                  : "Geral"}
              </span>
            </div>

            {latestExamSummary && latestExamSummary.isXray ? (
              <div className="space-y-3">
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  {latestExamSummary.exam.title}
                </p>
                <div className="p-4 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-hairline)]/60 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12.5px]">
                      <span className="text-[var(--text-secondary)]">
                        Acerto Bruto
                      </span>
                      <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                        {latestExamSummary.raw}/{latestExamSummary.total} (
                        {latestExamSummary.rawPct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-slate)] rounded-full"
                        style={{ width: `${latestExamSummary.rawPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12.5px]">
                      <span className="text-[var(--text-secondary)]">
                        Acerto Real (Sem chutes)
                      </span>
                      <span className="font-mono-tabular font-semibold text-[var(--accent-terracotta)]">
                        {latestExamSummary.real}/{latestExamSummary.total} (
                        {latestExamSummary.realPct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-terracotta)] rounded-full"
                        style={{ width: `${latestExamSummary.realPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)] text-[11.5px]">
                    <span className="text-[var(--text-muted)]">
                      Diferença por chutes ({latestExamSummary.guesses} questões)
                    </span>
                    <span className="font-mono-tabular font-medium text-[var(--accent-terracotta)]">
                      -{latestExamSummary.diffPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : engine.overallSummary.totalQuestions > 0 ? (
              <div className="p-4 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-hairline)]/60 space-y-3">
                {latestExamSummary && (
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    Último simulado:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {latestExamSummary.exam.title}
                    </strong>{" "}
                    ({latestExamSummary.raw} acertos brutos)
                  </p>
                )}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-[var(--text-secondary)]">
                      Média Bruta (Geral)
                    </span>
                    <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                      {engine.overallSummary.rawAccuracyPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-slate)] rounded-full"
                      style={{
                        width: `${engine.overallSummary.rawAccuracyPct}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-[var(--text-secondary)]">
                      Média Real (Sem chutes)
                    </span>
                    <span className="font-mono-tabular font-semibold text-[var(--accent-terracotta)]">
                      {engine.overallSummary.realAccuracyPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-terracotta)] rounded-full"
                      style={{
                        width: `${engine.overallSummary.realAccuracyPct}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)] text-[11.5px]">
                  <span className="text-[var(--text-muted)]">
                    Viés de Ilusão de Competência
                  </span>
                  <span className="font-mono-tabular font-medium text-[var(--accent-terracotta)]">
                    -{engine.overallSummary.guessIllusionPct.toFixed(1)}% em
                    chutes
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/60 text-center space-y-2">
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Nenhum simulado ou bateria registrada ainda
                </p>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  Assim que registrar seu primeiro simulado Raio-X ou lista de
                  exercícios, verá aqui a diferença real entre o que você
                  acertou sabendo e o que foi no chute.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-0.5 text-[13px]">
              <Link
                href="/simulados"
                className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Abrir Simulados
              </Link>
              <Link
                href="/estatisticas"
                className="inline-flex items-center gap-1 font-medium text-[var(--accent-sage)] hover:underline underline-offset-4"
              >
                <span>Análise completa</span>
                <CaretRight size={14} weight="light" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
