"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
  Clock,
  FloppyDisk,
  Pause,
  Play,
  Plus,
  SpeakerHigh,
  SpeakerSlash,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  isFocusChimeMuted,
  playFocusChime,
  setFocusChimeMuted,
} from "@/lib/focusChime";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "@/components/shared/SearchableCombobox";
import {
  createStudySession,
  deleteStudySession,
} from "@/lib/planner-service";
import { formatMinutesHuman, getTodayIso } from "@/lib/date-utils";
import type { StudySession, Subject, Topic } from "@/types/database";

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

interface StudyTimerWidgetProps {
  subjects: Subject[];
  topics: Topic[];
  sessions: StudySession[];
  initialSubjectId?: string | null;
  initialTopicId?: string | null;
  onSessionAdded: (session: StudySession) => void;
  onSessionDeleted: (id: string) => void;
}

export function StudyTimerWidget({
  subjects,
  topics,
  sessions,
  initialSubjectId = null,
  initialTopicId = null,
  onSessionAdded,
  onSessionDeleted,
}: StudyTimerWidgetProps) {
  const [mode, setMode] = useState<"free" | "pomodoro">("free");
  const [pomodoroMinutes, setPomodoroMinutes] = useState<number>(25);

  const [subjectId, setSubjectId] = useState<string | null>(initialSubjectId);
  const [topicId, setTopicId] = useState<string | null>(initialTopicId);

  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [savingTimer, setSavingTimer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [chimeMuted, setChimeMuted] = useState(false);

  useEffect(() => {
    setChimeMuted(isFocusChimeMuted());
  }, []);

  // Modal de registro manual
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(getTodayIso());
  const [manualMinutes, setManualMinutes] = useState(45);
  const [manualSubjectId, setManualSubjectId] = useState<string | null>(null);
  const [manualTopicId, setManualTopicId] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  // Sincroniza quando vem de link direto (?subjectId=...&topicId=...)
  useEffect(() => {
    if (initialSubjectId) setSubjectId(initialSubjectId);
    if (initialTopicId) setTopicId(initialTopicId);
  }, [initialSubjectId, initialTopicId]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (mode === "pomodoro" && next >= pomodoroMinutes * 60) {
          setRunning(false);
          playFocusChime();
          setNotice(
            `Pomodoro de ${pomodoroMinutes} min concluído! Clique em "Salvar sessão" para registrar.`
          );
          return pomodoroMinutes * 60;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, mode, pomodoroMinutes]);

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

  const buildTopicOptions = (subjId: string | null): ComboboxOption[] =>
    topics
      .filter((t) => !subjId || t.subject_id === subjId)
      .map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: subjId ? undefined : subjectMap.get(t.subject_id)?.name,
      }));

  const timerTopicOptions = useMemo(
    () => buildTopicOptions(subjectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, subjectId, subjectMap]
  );

  const manualTopicOptions = useMemo(
    () => buildTopicOptions(manualSubjectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, manualSubjectId, subjectMap]
  );

  const displaySeconds =
    mode === "pomodoro"
      ? Math.max(0, pomodoroMinutes * 60 - elapsedSeconds)
      : elapsedSeconds;

  const todayIso = getTodayIso();
  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === todayIso),
    [sessions, todayIso]
  );
  const todayMinutesTotal = useMemo(
    () => todaySessions.reduce((acc, s) => acc + s.duration_minutes, 0),
    [todaySessions]
  );

  const handleSaveTimerSession = async () => {
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setRunning(false);
    setSavingTimer(true);
    setNotice(null);
    try {
      const created = await createStudySession({
        date: getTodayIso(),
        subject_id: subjectId,
        topic_id: topicId,
        duration_minutes: minutes,
        source: "timer",
      });
      onSessionAdded(created);
      setElapsedSeconds(0);
      setNotice(`Sessão de ${formatMinutesHuman(minutes)} salva.`);
      setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Erro ao salvar sessão."
      );
    } finally {
      setSavingTimer(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualMinutes <= 0) return;
    setSavingManual(true);
    try {
      const created = await createStudySession({
        date: manualDate,
        subject_id: manualSubjectId,
        topic_id: manualTopicId,
        duration_minutes: manualMinutes,
        source: "manual",
      });
      onSessionAdded(created);
      setManualOpen(false);
      setManualMinutes(45);
      setNotice(
        `Tempo manual de ${formatMinutesHuman(created.duration_minutes)} registrado.`
      );
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setSavingManual(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    onSessionDeleted(id);
    try {
      await deleteStudySession(id);
    } catch {
      // noop
    }
  };

  return (
    <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock
            size={19}
            weight="duotone"
            className="text-[var(--accent-sage)]"
          />
          <div>
            <h2 className="font-editorial text-[21px] text-[var(--text-primary)] leading-tight">
              Cronômetro &amp; Registro de Tempo
            </h2>
            <p className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
              Hoje: {formatMinutesHuman(todayMinutesTotal)} registrados
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextMuted = !chimeMuted;
              setChimeMuted(nextMuted);
              setFocusChimeMuted(nextMuted);
              if (!nextMuted) playFocusChime(true);
            }}
            title={
              chimeMuted
                ? "Ativar sino suave ao finalizar o Pomodoro"
                : "Silenciar sino do cronômetro"
            }
            aria-label={chimeMuted ? "Ativar som do cronômetro" : "Silenciar som"}
            className="w-8 h-8 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {chimeMuted ? (
              <SpeakerSlash size={15} weight="light" />
            ) : (
              <SpeakerHigh
                size={15}
                weight="duotone"
                className="text-[var(--accent-sage)]"
              />
            )}
          </button>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setElapsedSeconds(0);
                setMode("free");
              }}
              className={`px-2.5 py-1 rounded-md text-[12px] cursor-pointer ${
                mode === "free"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Livre
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setElapsedSeconds(0);
                setMode("pomodoro");
              }}
              className={`px-2.5 py-1 rounded-md text-[12px] cursor-pointer ${
                mode === "pomodoro"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border-hairline)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Pomodoro
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setManualSubjectId(subjectId);
              setManualTopicId(topicId);
              setManualDate(getTodayIso());
              setManualOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[12px] font-medium text-[var(--text-primary)] cursor-pointer"
          >
            <Plus size={13} weight="light" />
            <span>Lançar manual</span>
          </button>
        </div>
      </div>

      {/* Área central do relógio + vínculo Matéria/Assunto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70 flex flex-col items-center text-center space-y-4">
          {mode === "pomodoro" && (
            <div className="flex items-center gap-1.5">
              {[25, 45, 50].map((min) => (
                <button
                  key={min}
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setPomodoroMinutes(min);
                    setElapsedSeconds(0);
                  }}
                  className={`px-2.5 py-0.5 rounded-full font-mono-tabular text-[11px] cursor-pointer disabled:opacity-50 ${
                    pomodoroMinutes === min
                      ? "bg-[var(--accent-sage)] text-[#FAF8F5] font-medium"
                      : "bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                  }`}
                >
                  {min}m
                </button>
              ))}
            </div>
          )}

          <p className="font-mono-tabular text-[42px] sm:text-[46px] font-medium tracking-tight text-[var(--text-primary)] leading-none">
            {formatClock(displaySeconds)}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer"
            >
              {running ? (
                <>
                  <Pause size={15} weight="duotone" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play size={15} weight="duotone" />
                  <span>{elapsedSeconds > 0 ? "Retomar" : "Iniciar"}</span>
                </>
              )}
            </button>

            {elapsedSeconds > 0 && (
              <>
                <button
                  type="button"
                  disabled={savingTimer}
                  onClick={() => void handleSaveTimerSession()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[var(--accent-sage)]/40 bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] text-[13px] font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {savingTimer ? (
                    <SpinnerGap
                      size={14}
                      weight="light"
                      className="animate-spin"
                    />
                  ) : (
                    <FloppyDisk size={15} weight="duotone" />
                  )}
                  <span>Salvar sessão</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setElapsedSeconds(0);
                  }}
                  title="Zerar cronômetro"
                  aria-label="Zerar cronômetro"
                  className="w-9 h-9 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <ArrowCounterClockwise size={15} weight="light" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Vínculo opcional com Matéria e Assunto + Sessões de Hoje */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SearchableCombobox
              label="Matéria (opcional)"
              options={subjectOptions}
              value={subjectId}
              onChange={(val) => {
                setSubjectId(val);
                setTopicId(null);
              }}
              placeholder="Estudo geral"
              searchPlaceholder="Buscar matéria..."
            />

            <SearchableCombobox
              label="Assunto (opcional)"
              options={timerTopicOptions}
              value={topicId}
              onChange={(val) => {
                setTopicId(val);
                if (val && !subjectId) {
                  const found = topicMap.get(val);
                  if (found) setSubjectId(found.subject_id);
                }
              }}
              placeholder="Qualquer assunto"
              searchPlaceholder="Buscar assunto..."
            />
          </div>

          {notice && (
            <p className="text-[12.5px] font-medium text-[var(--accent-sage)]">
              {notice}
            </p>
          )}

          {/* Lista compacta das sessões de hoje */}
          {todaySessions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.05em] text-[var(--text-muted)] block">
                Sessões de hoje ({todaySessions.length})
              </span>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {todaySessions.map((s) => {
                  const subj = s.subject_id
                    ? subjectMap.get(s.subject_id)
                    : null;
                  const top = s.topic_id ? topicMap.get(s.topic_id) : null;
                  return (
                    <div
                      key={s.id}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)]/75 border border-[var(--border-hairline)]/60 flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {subj && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subj.color }}
                          />
                        )}
                        <span className="truncate text-[var(--text-primary)]">
                          {subj?.name ?? "Estudo livre"}
                          {top ? ` · ${top.name}` : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-tabular font-medium text-[var(--accent-sage)]">
                          {formatMinutesHuman(s.duration_minutes)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSession(s.id)}
                          aria-label="Excluir sessão"
                          className="text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] cursor-pointer"
                        >
                          <Trash size={13} weight="light" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Registro Manual de Tempo */}
      {manualOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setManualOpen(false)}
          />

          <div
            className="relative z-10 w-full max-w-[460px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-4"
            style={{ boxShadow: "var(--shadow-tactile)" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
              <h3 className="font-editorial text-[22px] text-[var(--text-primary)]">
                Registrar tempo manualmente
              </h3>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X size={17} weight="light" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveManual(e)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Data
                  </span>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] font-mono-tabular text-[13px]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Duração (minutos)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={960}
                    value={manualMinutes}
                    onChange={(e) =>
                      setManualMinutes(Number.parseInt(e.target.value, 10) || 1)
                    }
                    required
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] font-mono-tabular text-[13.5px]"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[30, 45, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setManualMinutes(m)}
                    className={`px-2.5 py-1 rounded-full font-mono-tabular text-[11px] cursor-pointer ${
                      manualMinutes === m
                        ? "bg-[var(--accent-sage)] text-[#FAF8F5]"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {formatMinutesHuman(m)}
                  </button>
                ))}
              </div>

              <SearchableCombobox
                label="Matéria (opcional)"
                options={subjectOptions}
                value={manualSubjectId}
                onChange={(val) => {
                  setManualSubjectId(val);
                  setManualTopicId(null);
                }}
                placeholder="Estudo livre"
              />

              <SearchableCombobox
                label="Assunto (opcional)"
                options={manualTopicOptions}
                value={manualTopicId}
                onChange={(val) => {
                  setManualTopicId(val);
                  if (val && !manualSubjectId) {
                    const found = topicMap.get(val);
                    if (found) setManualSubjectId(found.subject_id);
                  }
                }}
                placeholder="Qualquer assunto"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-60"
                >
                  <Check size={15} weight="light" />
                  <span>{savingManual ? "Salvando..." : "Salvar tempo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
