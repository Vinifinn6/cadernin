"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowsLeftRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  Plus,
  SpinnerGap,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { StudyTimerWidget } from "@/components/planejador/StudyTimerWidget";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "@/components/shared/SearchableCombobox";
import { fetchCurriculumData } from "@/lib/curriculum-service";
import {
  addDays,
  formatShortDatePtBr,
  getStartOfWeekMonday,
  getTodayIso,
  toLocalIsoDate,
} from "@/lib/date-utils";
import {
  createWeeklyPlanItem,
  deleteWeeklyPlanItem,
  fetchStudySessions,
  fetchWeeklyPlanItems,
  updateWeeklyPlanItem,
} from "@/lib/planner-service";
import { useToast } from "@/components/providers/ToastProvider";
import { CardGridSkeleton } from "@/components/shared/EditorialSkeleton";
import type {
  StudySession,
  Subject,
  Topic,
  WeeklyPlanItem,
} from "@/types/database";

const WEEKDAY_NAMES = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

export function PlannerWorkspace() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialSubjectId = searchParams.get("subjectId") || null;
  const initialTopicId = searchParams.get("topicId") || null;

  const [items, setItems] = useState<WeeklyPlanItem[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() =>
    getStartOfWeekMonday(new Date())
  );

  // Modal de nova tarefa
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [taskMode, setTaskMode] = useState<"curriculum" | "custom">(
    "curriculum"
  );
  const [taskDate, setTaskDate] = useState(getTodayIso());
  const [taskSubjectId, setTaskSubjectId] = useState<string | null>(null);
  const [taskTopicId, setTaskTopicId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Mover tarefa entre dias
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planItems, studySessions, curriculum] = await Promise.all([
        fetchWeeklyPlanItems(),
        fetchStudySessions(),
        fetchCurriculumData(),
      ]);
      setItems(planItems);
      setSessions(studySessions);
      setSubjects(curriculum.subjects);
      setTopics(curriculum.topics);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar seu planejador."
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
  const topicMap = useMemo(
    () => new Map(topics.map((t) => [t.id, t])),
    [topics]
  );

  const subjectOptions: ComboboxOption[] = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.id,
        label: s.name,
        dotColor: s.color,
      })),
    [subjects]
  );

  const topicOptions: ComboboxOption[] = useMemo(
    () =>
      topics
        .filter((t) => !taskSubjectId || t.subject_id === taskSubjectId)
        .map((t) => ({
          value: t.id,
          label: t.name,
          sublabel: taskSubjectId
            ? undefined
            : subjectMap.get(t.subject_id)?.name,
        })),
    [topics, taskSubjectId, subjectMap]
  );

  const todayIso = getTodayIso();

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const d = addDays(weekStart, idx);
      const iso = toLocalIsoDate(d);
      return {
        idx,
        name: WEEKDAY_NAMES[idx],
        iso,
        shortDate: formatShortDatePtBr(iso),
        isToday: iso === todayIso,
      };
    });
  }, [weekStart, todayIso]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem[]>();
    for (const item of items) {
      const list = map.get(item.planned_date) ?? [];
      list.push(item);
      map.set(item.planned_date, list);
    }
    return map;
  }, [items]);

  const weekTotals = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const day of weekDays) {
      const list = itemsByDate.get(day.iso) ?? [];
      total += list.length;
      done += list.filter((i) => i.is_completed).length;
    }
    return { total, done };
  }, [weekDays, itemsByDate]);

  const openAddForDay = (isoDate: string) => {
    setTaskDate(isoDate);
    setTaskMode(topics.length > 0 ? "curriculum" : "custom");
    setTaskSubjectId(null);
    setTaskTopicId(null);
    setTaskTitle("");
    setAddModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = taskTitle.trim();
    if (!finalTitle) return;

    setSavingTask(true);
    try {
      const created = await createWeeklyPlanItem({
        planned_date: taskDate,
        subject_id: taskSubjectId,
        topic_id: taskTopicId,
        title: finalTitle,
      });
      setItems((prev) => [...prev, created]);
      setAddModalOpen(false);
      showToast("Tarefa adicionada ao planejador.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível criar a tarefa."
      );
    } finally {
      setSavingTask(false);
    }
  };

  const handleToggleItem = async (item: WeeklyPlanItem) => {
    const nextCompleted = !item.is_completed;
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, is_completed: nextCompleted } : it
      )
    );
    try {
      await updateWeeklyPlanItem(item.id, { is_completed: nextCompleted });
    } catch {
      void loadAll();
    }
  };

  const handleMoveItem = async (item: WeeklyPlanItem, newIsoDate: string) => {
    setMovingItemId(null);
    if (item.planned_date === newIsoDate) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, planned_date: newIsoDate } : it
      )
    );
    try {
      await updateWeeklyPlanItem(item.id, { planned_date: newIsoDate });
    } catch {
      void loadAll();
    }
  };

  const handleDeleteItem = async (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      await deleteWeeklyPlanItem(id);
      showToast("Tarefa removida.", "info");
    } catch {
      void loadAll();
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div className="space-y-1">
          <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
            Rotina &amp; Foco
          </p>
          <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            Planejador
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Organize sua semana de Segunda a Domingo e registre suas sessões de
            estudo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openAddForDay(todayIso)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer shrink-0"
        >
          <Plus size={16} weight="light" />
          <span>Nova tarefa</span>
        </button>
      </header>

      {error && (
        <div className="rounded-xl px-4 py-3 bg-[var(--accent-terracotta-soft)] border border-[var(--accent-terracotta)]/30 text-[13px] text-[var(--accent-terracotta)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WarningCircle size={17} weight="duotone" className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="cursor-pointer"
          >
            <X size={15} weight="light" />
          </button>
        </div>
      )}

      {/* 1. Cronômetro / Pomodoro & Registro de Tempo */}
      <StudyTimerWidget
        subjects={subjects}
        topics={topics}
        sessions={sessions}
        initialSubjectId={initialSubjectId}
        initialTopicId={initialTopicId}
        onSessionAdded={(session) => setSessions((prev) => [session, ...prev])}
        onSessionDeleted={(id) =>
          setSessions((prev) => prev.filter((s) => s.id !== id))
        }
      />

      {/* 2. Visão Semanal (Segunda a Domingo) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarBlank
              size={19}
              weight="duotone"
              className="text-[var(--accent-sage)]"
            />
            <div>
              <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
                Semana de {weekDays[0].shortDate} a {weekDays[6].shortDate}
              </h2>
              <p className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                {weekTotals.done} de {weekTotals.total} tarefas concluídas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              aria-label="Semana anterior"
              className="w-9 h-9 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <CaretLeft size={16} weight="light" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getStartOfWeekMonday(new Date()))}
              className="px-3 py-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] text-[12.5px] font-medium text-[var(--text-primary)] cursor-pointer"
            >
              Semana atual
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              aria-label="Próxima semana"
              className="w-9 h-9 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <CaretRight size={16} weight="light" />
            </button>
          </div>
        </div>

        {loading ? (
          <CardGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {weekDays.map((day) => {
              const dayItems = itemsByDate.get(day.iso) ?? [];
              const doneCount = dayItems.filter((i) => i.is_completed).length;

              return (
                <article
                  key={day.iso}
                  className={`bg-[var(--bg-card)] rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                    day.isToday
                      ? "border-[var(--accent-sage)]"
                      : "border-[var(--border-hairline)]"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Cabeçalho do dia */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)]">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-editorial text-[19px] leading-none text-[var(--text-primary)]">
                            {day.name}
                          </h3>
                          {day.isToday && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-mono-tabular text-[10px] font-medium">
                              HOJE
                            </span>
                          )}
                        </div>
                        <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] block mt-1">
                          {day.shortDate}
                          {dayItems.length > 0
                            ? ` · ${doneCount}/${dayItems.length}`
                            : ""}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAddForDay(day.iso)}
                        aria-label={`Adicionar tarefa em ${day.name}`}
                        title="Adicionar tarefa neste dia"
                        className="w-7 h-7 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <Plus size={14} weight="light" />
                      </button>
                    </div>

                    {/* Lista de tarefas do dia */}
                    {dayItems.length === 0 ? (
                      <p className="text-[12px] text-[var(--text-muted)] py-3 text-center">
                        Dia livre
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map((item) => {
                          const subj = item.subject_id
                            ? subjectMap.get(item.subject_id)
                            : null;
                          const isMoving = movingItemId === item.id;

                          return (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-[var(--bg-subtle)]/75 border border-[var(--border-hairline)]/70 space-y-2"
                            >
                              <div className="flex items-start gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => void handleToggleItem(item)}
                                  aria-label={
                                    item.is_completed
                                      ? "Desmarcar tarefa"
                                      : "Concluir tarefa"
                                  }
                                  className={`mt-0.5 w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                    item.is_completed
                                      ? "bg-[var(--accent-sage)] border-[var(--accent-sage)] text-[#FAF8F5]"
                                      : "border-[var(--border-strong)] bg-[var(--bg-card)]"
                                  }`}
                                >
                                  {item.is_completed && (
                                    <Check size={10} weight="bold" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-[13px] leading-snug ${
                                      item.is_completed
                                        ? "line-through text-[var(--text-muted)]"
                                        : "text-[var(--text-primary)] font-medium"
                                    }`}
                                  >
                                    {item.title}
                                  </p>
                                  {subj && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-[var(--text-secondary)]">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: subj.color }}
                                      />
                                      <span className="truncate">
                                        {subj.name}
                                      </span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMovingItemId(isMoving ? null : item.id)
                                    }
                                    title="Mover para outro dia"
                                    aria-label="Mover para outro dia"
                                    className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] cursor-pointer"
                                  >
                                    <ArrowsLeftRight size={12} weight="light" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDeleteItem(item.id)
                                    }
                                    title="Excluir tarefa"
                                    aria-label="Excluir tarefa"
                                    className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                                  >
                                    <Trash size={12} weight="light" />
                                  </button>
                                </div>
                              </div>

                              {/* Mini seletor para mover para outro dia */}
                              {isMoving && (
                                <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1.5">
                                  <span className="text-[10.5px] text-[var(--text-muted)] block">
                                    Mover para:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {weekDays.map((targetDay) => (
                                      <button
                                        key={targetDay.iso}
                                        type="button"
                                        onClick={() =>
                                          void handleMoveItem(
                                            item,
                                            targetDay.iso
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded font-mono-tabular text-[10.5px] cursor-pointer ${
                                          targetDay.iso === item.planned_date
                                            ? "bg-[var(--accent-sage)] text-[#FAF8F5]"
                                            : "bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        }`}
                                      >
                                        {targetDay.name.slice(0, 3)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Adicionar Tarefa */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setAddModalOpen(false)}
          />

          <div
            className="relative z-10 w-full max-w-[480px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-4"
            style={{ boxShadow: "var(--shadow-tactile)" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
              <h3 className="font-editorial text-[22px] text-[var(--text-primary)]">
                Nova tarefa no planejador
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X size={17} weight="light" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTaskMode("curriculum")}
                className={`py-2 px-3 rounded-xl border text-[12.5px] cursor-pointer ${
                  taskMode === "curriculum"
                    ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)] text-[var(--accent-sage)] font-medium"
                    : "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)]"
                }`}
              >
                Puxar do Cronograma
              </button>
              <button
                type="button"
                onClick={() => setTaskMode("custom")}
                className={`py-2 px-3 rounded-xl border text-[12.5px] cursor-pointer ${
                  taskMode === "custom"
                    ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)] text-[var(--accent-sage)] font-medium"
                    : "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)]"
                }`}
              >
                Tarefa avulsa
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateTask(e)}
              className="space-y-4"
            >
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Data planejada
                </span>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] font-mono-tabular text-[13px]"
                />
              </label>

              {taskMode === "curriculum" ? (
                <div className="space-y-3">
                  <SearchableCombobox
                    label="Matéria"
                    options={subjectOptions}
                    value={taskSubjectId}
                    onChange={(val) => {
                      setTaskSubjectId(val);
                      setTaskTopicId(null);
                    }}
                    placeholder="Escolha a matéria"
                  />

                  <SearchableCombobox
                    label="Assunto do Cronograma"
                    options={topicOptions}
                    value={taskTopicId}
                    onChange={(val) => {
                      setTaskTopicId(val);
                      if (val) {
                        const found = topicMap.get(val);
                        if (found) {
                          setTaskSubjectId(found.subject_id);
                          setTaskTitle(found.name);
                        }
                      }
                    }}
                    placeholder="Escolha o assunto"
                  />

                  <label className="block space-y-1">
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                      Título da tarefa (editável)
                    </span>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Ex: Revisar Atomística + 15 exercícios"
                      required
                      className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[13.5px]"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                      Descrição da tarefa
                    </span>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Ex: Fazer redação tema ENEM, revisar flashcards..."
                      autoFocus
                      required
                      className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[13.5px]"
                    />
                  </label>

                  <SearchableCombobox
                    label="Vincular cor de uma matéria (opcional)"
                    options={subjectOptions}
                    value={taskSubjectId}
                    onChange={setTaskSubjectId}
                    placeholder="Sem matéria"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTask || !taskTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-60"
                >
                  <Check size={15} weight="light" />
                  <span>{savingTask ? "Salvando..." : "Adicionar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
