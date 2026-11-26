"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowsClockwise,
  ArrowsInSimple,
  ArrowsOutSimple,
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
  Timer,
} from "@phosphor-icons/react";
import { ProfileHeroBanner } from "@/components/home/ProfileHeroBanner";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import { MemoryBattery } from "@/components/shared/MemoryBattery";
import { ConsistencyHeatmap } from "@/components/estatisticas/ConsistencyHeatmap";
import { RealityShockChart } from "@/components/estatisticas/RealityShockChart";
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
import { getSubjectColorStyles } from "@/lib/editorialPalette";
import { buildDailyActivityMap } from "@/lib/activityCalendar";
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

const WEEKDAY_SHORT_SUN_TO_SAT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

function getStartOfWeekSunday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function getSeverityBadgeClasses(score: number): string {
  if (score >= 65) {
    return "bg-[var(--accent-terracotta-soft)] text-[var(--accent-terracotta)] border border-[var(--accent-terracotta)]/30";
  }
  if (score >= 35) {
    return "bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)] border border-[var(--accent-ochre)]/30";
  }
  return "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] border border-[var(--accent-sage)]/30";
}

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
  // Calendário compacto (semana atual) por padrão tanto no desktop quanto no mobile
  const [calendarExpanded, setCalendarExpanded] = useState<boolean>(false);
  const [weekStartSunday, setWeekStartSunday] = useState<Date>(() =>
    getStartOfWeekSunday(new Date())
  );
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [addingQuickTask, setAddingQuickTask] = useState(false);
  const [attackTab, setAttackTab] = useState<"fires" | "reviews" | "auto">(
    "auto"
  );

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

  // 1. Motor de Prioridade + Revisões FSRS
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

  const firesList = useMemo(() => {
    if (engine.topicPriorities.length > 0) {
      return engine.topicPriorities.slice(0, 4);
    }
    return engine.enemSkillPriorities.slice(0, 4);
  }, [engine]);

  const reviewsList = useMemo(
    () => engine.dueReviews.slice(0, 5),
    [engine.dueReviews]
  );

  const autoList = useMemo(() => {
    if (engine.autoPriorities.length > 0) {
      return engine.autoPriorities.slice(0, 4);
    }
    return engine.enemSkillPriorities.slice(0, 4);
  }, [engine]);

  // 2. Calendário Compacto (Semana) + Expansível (Mês) + Tarefas do Dia
  const planItemsByDate = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem[]>();
    for (const item of planItems) {
      const list = map.get(item.planned_date) ?? [];
      list.push(item);
      map.set(item.planned_date, list);
    }
    return map;
  }, [planItems]);

  const compactWeekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStartSunday, i);
      const iso = toLocalIsoDate(d);
      return {
        abbr: WEEKDAY_SHORT_SUN_TO_SAT[i],
        day: d.getDate(),
        iso,
        hasTasks: (planItemsByDate.get(iso)?.length ?? 0) > 0,
      };
    });
  }, [weekStartSunday, planItemsByDate]);

  const monthCells = useMemo(() => {
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

  // Mês/ano exibido no topo do calendário conforme o modo ativo
  const visibleCalendarDate = calendarExpanded
    ? calendarMonth
    : addDays(weekStartSunday, 3); // Quarta-feira da semana visível

  const handleCalendarPrev = () => {
    if (calendarExpanded) {
      setCalendarMonth(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
      );
    } else {
      setWeekStartSunday((prev) => addDays(prev, -7));
    }
  };

  const handleCalendarNext = () => {
    if (calendarExpanded) {
      setCalendarMonth(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      );
    } else {
      setWeekStartSunday((prev) => addDays(prev, 7));
    }
  };

  const handleCalendarToday = () => {
    const now = new Date();
    setWeekStartSunday(getStartOfWeekSunday(now));
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateIso(todayIso);
  };

  const handleToggleCalendarExpand = () => {
    setCalendarExpanded((prev) => {
      const next = !prev;
      const anchor = parseLocalIsoDate(selectedDateIso);
      if (next) {
        setCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      } else {
        setWeekStartSunday(getStartOfWeekSunday(anchor));
      }
      return next;
    });
  };

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

  // 3. Atividade diária combinada (Tempo + Exercícios + Simulados, normalizada sem shift UTC)
  const dailyActivityMap = useMemo(
    () =>
      buildDailyActivityMap({
        studySessions,
        exerciseLogs,
        mockExams,
        mockQuestions,
      }),
    [studySessions, exerciseLogs, mockExams, mockQuestions]
  );

  const rhythmStats = useMemo(() => {
    const todayMinutes = dailyActivityMap[todayIso]?.minutes ?? 0;

    const mondayIso = toLocalIsoDate(getStartOfWeekMonday(new Date()));
    const weekMinutes = studySessions
      .filter((s) => s.date >= mondayIso && s.date <= todayIso)
      .reduce((acc, s) => acc + s.duration_minutes, 0);

    let streak = 0;
    let cursor = new Date();
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

  const dailyGoalHours = (profile.daily_goal_minutes / 60).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Banner Editorial + Avatar 96px/80px + Fade Suave + Saudação */}
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
              Configure seu{" "}
              <code className="font-mono-tabular">.env.local</code> para
              sincronizar seus estudos.
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
          GRID BENTO EDITORIAL
          Coluna Esquerda: 1º Ritmo de estudos -> 2º O que atacar hoje
          Coluna Direita:  1º Calendário & tarefas (compacto) -> 2º Choque de realidade
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. RITMO DE ESTUDOS (TOPO DA COLUNA ESQUERDA) */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-sage)]"
                />
                <h2 className="font-editorial text-[21px] leading-tight text-[var(--text-primary)]">
                  Ritmo de <em className="italic font-normal">estudos</em>
                </h2>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-mono-tabular text-[11px] font-medium shrink-0">
                {rhythmStats.streak}{" "}
                {rhythmStats.streak === 1 ? "dia seguido" : "dias seguidos"}
              </span>
            </div>

            <ConsistencyHeatmap
              dailyMap={dailyActivityMap}
              weeksCount={15}
              compact
              defaultMetric="combined"
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
              <Timer size={18} weight="regular" />
              <span>Iniciar Cronômetro / Pomodoro</span>
            </Link>
          </section>

          {/* 2. O QUE ATACAR HOJE (PARTE INFERIOR DA COLUNA ESQUERDA) */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lightning
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-terracotta)]"
                />
                <h2 className="font-editorial text-[21px] leading-tight text-[var(--text-primary)]">
                  O que atacar <em className="italic font-normal">hoje</em>
                </h2>
              </div>

              <div
                role="tablist"
                aria-label="Modo de priorização"
                className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start sm:self-auto"
              >
                {(
                  [
                    { id: "fires", label: "Incêndios" },
                    {
                      id: "reviews",
                      label:
                        engine.dueReviews.length > 0
                          ? `Revisões (${engine.dueReviews.length})`
                          : "Revisões",
                    },
                    { id: "auto", label: "Automático" },
                  ] as const
                ).map((tab) => {
                  const active = attackTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setAttackTab(tab.id)}
                      className={`relative px-2.5 py-1 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                        active
                          ? "text-[var(--text-primary)] font-medium"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="homeAttackTabPill"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 32,
                          }}
                          className="absolute inset-0 rounded-md bg-[var(--bg-card)] border border-[var(--border-hairline)]"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ABA 1: INCÊNDIOS */}
            {attackTab === "fires" &&
              (firesList.length === 0 ? (
                <div className="p-5 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/60 text-center space-y-2">
                  <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                    Nenhum foco crítico registrado ainda
                  </p>
                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                    Registre listas em Exercícios ou corrija um simulado Raio-X
                    para identificar suas maiores lacunas e chutes.
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
                  {firesList.map((item) => {
                    const subj = item.subjectId
                      ? subjectMap.get(item.subjectId)
                      : undefined;
                    const palette = getSubjectColorStyles(subj?.color);

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-[var(--bg-subtle)]/75 hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <Link
                              href="/cronograma"
                              className="text-[14px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-sage)] truncate"
                            >
                              {item.label}
                            </Link>
                            {item.kind === "topic" && item.secondaryLabel && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[140px]"
                                style={{
                                  backgroundColor: palette.pillBg,
                                  border: `1px solid ${palette.pillBorder}`,
                                  color: palette.textColor,
                                }}
                              >
                                {item.secondaryLabel}
                              </span>
                            )}
                          </div>
                          <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                            {item.realAccuracyPct}% real · {item.totalQuestions}{" "}
                            {item.totalQuestions === 1
                              ? "questão"
                              : "questões"}
                            {item.errorGap > 0
                              ? ` · ${item.errorGap} ${
                                  item.errorGap === 1 ? "lacuna" : "lacunas"
                                }`
                              : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-mono-tabular text-[11px] font-medium ${getSeverityBadgeClasses(
                              item.urgencyScore
                            )}`}
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
              ))}

            {/* ABA 2: REVISÕES */}
            {attackTab === "reviews" &&
              (reviewsList.length === 0 ? (
                <div className="p-5 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/60 text-center space-y-2">
                  <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                    Nenhuma revisão pendente agora
                  </p>
                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                    As revisões aparecem automaticamente aqui após praticar
                    exercícios ou simulados quando chegar o momento ideal de
                    reforçar a memória.
                  </p>
                  <Link
                    href="/exercicios"
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-sage)] hover:underline pt-1"
                  >
                    <span>Praticar exercícios</span>
                    <ArrowRight size={13} weight="light" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reviewsList.map((item) => {
                    const subj = item.subjectId
                      ? subjectMap.get(item.subjectId)
                      : undefined;
                    const palette = getSubjectColorStyles(subj?.color);
                    const isOverdue =
                      item.daysUntilDue !== null && item.daysUntilDue < 0;

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-[var(--bg-subtle)]/75 hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70 transition-colors flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                              {item.label}
                            </span>
                            {item.secondaryLabel && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[140px]"
                                style={{
                                  backgroundColor: palette.pillBg,
                                  border: `1px solid ${palette.pillBorder}`,
                                  color: palette.textColor,
                                }}
                              >
                                {item.secondaryLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5">
                            <MemoryBattery
                              retrievability={item.retrievability}
                              due={item.dueIso}
                              stability={item.stabilityDays}
                              showPercent
                            />
                            <span
                              className={`font-mono-tabular text-[11px] font-medium ${
                                isOverdue
                                  ? "text-[var(--accent-terracotta)]"
                                  : "text-[var(--accent-ochre)]"
                              }`}
                            >
                              {item.dueStatusLabel}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={`/exercicios?subjectId=${item.subjectId ?? ""}&topicId=${item.id}&review=1`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-sage-soft)] border border-[var(--border-hairline)] hover:border-[var(--accent-sage)]/40 text-[12px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-sage)] transition-colors shrink-0"
                        >
                          <ArrowsClockwise size={13} weight="light" />
                          <span>Revisar</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ))}

            {/* ABA 3: AUTOMÁTICO */}
            {attackTab === "auto" &&
              (autoList.length === 0 ? (
                <div className="p-5 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/60 text-center space-y-2">
                  <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                    Sua fila inteligente ainda está vazia
                  </p>
                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                    Registre listas em Exercícios ou corrija um simulado Raio-X
                    para combinar lacunas e revisões automaticamente.
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
                  {autoList.map((item) => {
                    const subj = item.subjectId
                      ? subjectMap.get(item.subjectId)
                      : undefined;
                    const palette = getSubjectColorStyles(subj?.color);

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-[var(--bg-subtle)]/75 hover:bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <Link
                              href="/cronograma"
                              className="text-[14px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-sage)] truncate"
                            >
                              {item.label}
                            </Link>
                            {item.kind === "topic" && item.secondaryLabel && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[140px]"
                                style={{
                                  backgroundColor: palette.pillBg,
                                  border: `1px solid ${palette.pillBorder}`,
                                  color: palette.textColor,
                                }}
                              >
                                {item.secondaryLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono-tabular text-[11px] text-[var(--text-muted)]">
                            {item.retrievability !== null && (
                              <MemoryBattery
                                retrievability={item.retrievability}
                                due={item.dueIso}
                                stability={item.stabilityDays}
                                showPercent
                              />
                            )}
                            <span>{item.realAccuracyPct}% real</span>
                            {item.isDueForReview && (
                              <span className="text-[var(--accent-ochre)] font-medium">
                                • {item.dueStatusLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-mono-tabular text-[11px] font-medium ${getSeverityBadgeClasses(
                              item.autoScore
                            )}`}
                          >
                            Score {item.autoScore}
                          </span>

                          {item.kind === "topic" &&
                            (item.isDueForReview ? (
                              <Link
                                href={`/exercicios?subjectId=${item.subjectId ?? ""}&topicId=${item.id}&review=1`}
                                title="Revisar com bateria de exercícios"
                                aria-label={`Revisar ${item.label}`}
                                className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-sage-soft)] border border-[var(--border-hairline)] text-[var(--accent-sage)] flex items-center justify-center transition-colors"
                              >
                                <ArrowsClockwise size={13} weight="light" />
                              </Link>
                            ) : (
                              <Link
                                href={`/planejador?subjectId=${item.subjectId ?? ""}&topicId=${item.id}&focusTimer=1`}
                                title="Iniciar cronômetro neste assunto"
                                aria-label={`Iniciar cronômetro em ${item.label}`}
                                className="w-7 h-7 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-sage-soft)] border border-[var(--border-hairline)] text-[var(--accent-sage)] flex items-center justify-center transition-colors"
                              >
                                <Play size={13} weight="duotone" />
                              </Link>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

            <Link
              href="/estatisticas"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent-sage)] hover:underline underline-offset-4 pt-0.5"
            >
              <span>Ver diagnóstico completo</span>
              <ArrowRight size={15} weight="light" />
            </Link>
          </section>
        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-6 space-y-6">
          {/* 3. CALENDÁRIO COMPACTO (SEMANA) + EXPANSÍVEL (MÊS) + TAREFAS */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarBlank
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-sage)]"
                />
                <h2 className="font-editorial text-[21px] leading-tight text-[var(--text-primary)]">
                  Calendário &amp;{" "}
                  <em className="italic font-normal">tarefas</em>
                </h2>
              </div>
              <span className="font-mono-tabular text-[11.5px] text-[var(--text-muted)] shrink-0">
                {selectedDayDoneCount} de {selectedDayTasks.length} feitas
              </span>
            </div>

            {/* Calendário com alternância suave Semanal <-> Mensal */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  {MONTH_NAMES_PT[visibleCalendarDate.getMonth()]}{" "}
                  <span className="font-mono-tabular text-[var(--text-muted)] font-normal">
                    {visibleCalendarDate.getFullYear()}
                  </span>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCalendarPrev}
                    aria-label={
                      calendarExpanded ? "Mês anterior" : "Semana anterior"
                    }
                    className="w-6 h-6 rounded-md hover:bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
                  >
                    <CaretLeft size={13} weight="light" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCalendarToday}
                    className="px-1.5 py-0.5 rounded text-[10.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={handleCalendarNext}
                    aria-label={
                      calendarExpanded ? "Próximo mês" : "Próxima semana"
                    }
                    className="w-6 h-6 rounded-md hover:bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
                  >
                    <CaretRight size={13} weight="light" />
                  </button>

                  <span className="w-px h-3.5 bg-[var(--border-hairline)] mx-0.5" />

                  <button
                    type="button"
                    onClick={handleToggleCalendarExpand}
                    title={
                      calendarExpanded
                        ? "Recolher para semana atual"
                        : "Expandir mês completo"
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {calendarExpanded ? (
                      <>
                        <ArrowsInSimple size={11} weight="light" />
                        <span>Recolher</span>
                      </>
                    ) : (
                      <>
                        <ArrowsOutSimple size={11} weight="light" />
                        <span>Expandir</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {!calendarExpanded ? (
                  <motion.div
                    key="week-view"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="grid grid-cols-7 gap-1.5 text-center"
                  >
                    {compactWeekDays.map((cell) => {
                      const isSelected = cell.iso === selectedDateIso;
                      const isToday = cell.iso === todayIso;

                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          onClick={() => setSelectedDateIso(cell.iso)}
                          className={`py-2 rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[var(--accent-sage)] text-[#FAF8F5] font-medium"
                              : isToday
                              ? "bg-[var(--bg-card)] border border-[var(--accent-sage)] text-[var(--text-primary)] font-medium"
                              : "hover:bg-[var(--bg-card)] text-[var(--text-secondary)]"
                          }`}
                        >
                          <span
                            className={`font-mono-tabular text-[9.5px] ${
                              isSelected
                                ? "text-[#FAF8F5]/85"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {cell.abbr}
                          </span>
                          <span className="font-mono-tabular text-[13px] mt-0.5 leading-none">
                            {cell.day}
                          </span>
                          <span
                            className={`w-1 h-1 rounded-full mt-1 ${
                              cell.hasTasks
                                ? isSelected
                                  ? "bg-[#FAF8F5]"
                                  : "bg-[var(--accent-sage)]"
                                : "opacity-0"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="month-view"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="grid grid-cols-7 gap-1 text-center"
                  >
                    {WEEKDAY_INITIALS.map((letter, idx) => (
                      <span
                        key={idx}
                        className="font-mono-tabular text-[10px] text-[var(--text-muted)] py-0.5"
                      >
                        {letter}
                      </span>
                    ))}

                    {monthCells.map((cell, idx) => {
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
                  </motion.div>
                )}
              </AnimatePresence>
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
                        <motion.span
                          whileTap={{ scale: 0.85 }}
                          animate={{
                            scale: task.is_completed ? [1, 1.12, 1] : 1,
                          }}
                          transition={{ duration: 0.18 }}
                          className={`mt-0.5 w-4.5 h-4.5 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                            task.is_completed
                              ? "bg-[var(--accent-sage)] border-[var(--accent-sage)] text-[#FAF8F5]"
                              : "border-[var(--border-strong)] bg-[var(--bg-card)]"
                          }`}
                        >
                          {task.is_completed && (
                            <Check size={11} weight="bold" />
                          )}
                        </motion.span>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[13.5px] leading-snug transition-colors ${
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

          {/* 4. CHOQUE DE REALIDADE COM GRÁFICO REAL DE CURVA RECHARTS */}
          <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ChartBar
                  size={19}
                  weight="duotone"
                  className="text-[var(--accent-terracotta)]"
                />
                <h2 className="font-editorial text-[21px] leading-tight text-[var(--text-primary)]">
                  Choque de <em className="italic font-normal">realidade</em>
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] font-mono-tabular text-[11px] text-[var(--text-secondary)] shrink-0">
                {engine.overallSummary.totalQuestions}{" "}
                {engine.overallSummary.totalQuestions === 1
                  ? "questão"
                  : "questões"}
              </span>
            </div>

            {engine.overallSummary.totalQuestions > 0 ? (
              <RealityShockChart
                exerciseLogs={exerciseLogs}
                mockExams={mockExams}
                mockQuestions={mockQuestions}
                topics={topics}
                overallRawPct={engine.overallSummary.rawAccuracyPct}
                overallRealPct={engine.overallSummary.realAccuracyPct}
                guessIllusionPct={engine.overallSummary.guessIllusionPct}
                guessesTotal={engine.overallSummary.guessesTotal}
                height={170}
              />
            ) : (
              <div className="p-5 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)]/60 text-center space-y-2">
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Nenhum simulado ou bateria registrada ainda
                </p>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                  Assim que registrar exercícios ou um simulado Raio-X, você
                  verá aqui a curva real comparando acertos brutos e acertos sem
                  chute.
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
