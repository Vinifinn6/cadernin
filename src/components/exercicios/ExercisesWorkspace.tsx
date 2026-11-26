"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowsClockwise,
  Check,
  MagnifyingGlass,
  Minus,
  PencilLine,
  PencilSimple,
  Plus,
  SpinnerGap,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { fetchCurriculumData } from "@/lib/curriculum-service";
import {
  createExerciseLog,
  deleteExerciseLog,
  fetchExerciseLogs,
  updateExerciseLog,
} from "@/lib/exercises-service";
import { syncTopicFsrsState } from "@/lib/fsrs-service";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "@/components/shared/SearchableCombobox";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ListRowsSkeleton } from "@/components/shared/EditorialSkeleton";
import type { ExerciseLog, Subject, Subtopic, Topic } from "@/types/database";

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDatePtBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function ExercisesWorkspace() {
  const { profile } = useProfileTheme();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const querySubjectId = searchParams.get("subjectId");
  const queryTopicId = searchParams.get("topicId");
  const isReviewPrefill = searchParams.get("review") === "1";

  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado do formulário rápido
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayIso());
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [subtopicId, setSubtopicId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [rawCorrect, setRawCorrect] = useState<number>(8);
  const [guessesCount, setGuessesCount] = useState<number>(0);
  const [errorGap, setErrorGap] = useState<number>(0);
  const [errorAttention, setErrorAttention] = useState<number>(0);
  const [errorOther, setErrorOther] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Filtros do histórico
  const [filterSubjectId, setFilterSubjectId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logData, curriculum] = await Promise.all([
        fetchExerciseLogs(),
        fetchCurriculumData(),
      ]);
      setLogs(logData);
      setSubjects(curriculum.subjects);
      setTopics(curriculum.topics);
      setSubtopics(curriculum.subtopics);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os exercícios."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Pré-preenche Matéria + Assunto quando o usuário chega pelo botão "Revisar" da Home
  useEffect(() => {
    if (queryTopicId && topics.length > 0) {
      const foundTopic = topics.find((t) => t.id === queryTopicId);
      if (foundTopic) {
        setSubjectId(querySubjectId || foundTopic.subject_id);
        setTopicId(foundTopic.id);
        setSubtopicId(null);
      }
    } else if (querySubjectId && subjects.length > 0) {
      const foundSubj = subjects.find((s) => s.id === querySubjectId);
      if (foundSubj) setSubjectId(foundSubj.id);
    }
  }, [querySubjectId, queryTopicId, topics, subjects]);

  // Mapas de consulta rápida
  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );
  const topicMap = useMemo(
    () => new Map(topics.map((t) => [t.id, t])),
    [topics]
  );
  const subtopicMap = useMemo(
    () => new Map(subtopics.map((s) => [s.id, s])),
    [subtopics]
  );

  // Opções para os Comboboxes em cascata
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
        .filter((t) => !subjectId || t.subject_id === subjectId)
        .map((t) => ({
          value: t.id,
          label: t.name,
          sublabel: subjectId ? undefined : subjectMap.get(t.subject_id)?.name,
        })),
    [topics, subjectId, subjectMap]
  );

  const subtopicOptions: ComboboxOption[] = useMemo(
    () =>
      subtopics
        .filter((st) => st.topic_id === topicId)
        .map((st) => ({
          value: st.id,
          label: st.name,
        })),
    [subtopics, topicId]
  );

  // Cálculos em tempo real no formulário
  const safeTotal = Math.max(1, totalQuestions || 0);
  const clampedRaw = Math.min(safeTotal, Math.max(0, rawCorrect || 0));
  const clampedGuesses = Math.min(clampedRaw, Math.max(0, guessesCount || 0));
  const realCorrect = Math.max(0, clampedRaw - clampedGuesses);
  const totalErrors = Math.max(0, safeTotal - clampedRaw);
  const classifiedErrors = errorGap + errorAttention + errorOther;
  const remainingErrors = totalErrors - classifiedErrors;

  const rawPct = Math.round((clampedRaw / safeTotal) * 1000) / 10;
  const realPct = Math.round((realCorrect / safeTotal) * 1000) / 10;

  const handleSubjectChange = (nextSubjectId: string | null) => {
    setSubjectId(nextSubjectId);
    setTopicId(null);
    setSubtopicId(null);
  };

  const handleTopicChange = (nextTopicId: string | null) => {
    setTopicId(nextTopicId);
    setSubtopicId(null);
    if (nextTopicId && !subjectId) {
      const found = topicMap.get(nextTopicId);
      if (found) setSubjectId(found.subject_id);
    }
  };

  const adjustErrorsAfterTotalsChange = (nextTotal: number, nextRaw: number) => {
    const nextMaxErrors = Math.max(0, nextTotal - nextRaw);
    if (errorGap + errorAttention + errorOther > nextMaxErrors) {
      setErrorGap(Math.min(errorGap, nextMaxErrors));
      const rem1 = Math.max(0, nextMaxErrors - Math.min(errorGap, nextMaxErrors));
      setErrorAttention(Math.min(errorAttention, rem1));
      const rem2 = Math.max(0, rem1 - Math.min(errorAttention, rem1));
      setErrorOther(Math.min(errorOther, rem2));
    }
  };

  const handleTotalChange = (val: number) => {
    const clean = Math.max(1, Math.min(500, Number.isFinite(val) ? Math.round(val) : 1));
    const nextRaw = Math.min(rawCorrect, clean);
    const nextGuesses = Math.min(guessesCount, nextRaw);
    setTotalQuestions(clean);
    setRawCorrect(nextRaw);
    setGuessesCount(nextGuesses);
    adjustErrorsAfterTotalsChange(clean, nextRaw);
  };

  const handleRawCorrectChange = (val: number) => {
    const clean = Math.max(0, Math.min(safeTotal, Number.isFinite(val) ? Math.round(val) : 0));
    const nextGuesses = Math.min(guessesCount, clean);
    setRawCorrect(clean);
    setGuessesCount(nextGuesses);
    adjustErrorsAfterTotalsChange(safeTotal, clean);
  };

  const handleGuessesChange = (val: number) => {
    const clean = Math.max(0, Math.min(clampedRaw, Number.isFinite(val) ? Math.round(val) : 0));
    setGuessesCount(clean);
  };

  const stepErrorCount = (
    kind: "gap" | "attention" | "other",
    delta: number
  ) => {
    const current =
      kind === "gap" ? errorGap : kind === "attention" ? errorAttention : errorOther;
    const otherSum = classifiedErrors - current;
    const maxForThis = Math.max(0, totalErrors - otherSum);
    const next = Math.max(0, Math.min(maxForThis, current + delta));

    if (kind === "gap") setErrorGap(next);
    else if (kind === "attention") setErrorAttention(next);
    else setErrorOther(next);
  };

  const assignRemainingErrorsTo = (kind: "gap" | "attention" | "other") => {
    if (remainingErrors <= 0) return;
    if (kind === "gap") setErrorGap((prev) => prev + remainingErrors);
    else if (kind === "attention")
      setErrorAttention((prev) => prev + remainingErrors);
    else setErrorOther((prev) => prev + remainingErrors);
  };

  const resetForm = (keepSubject = true) => {
    setEditingId(null);
    setDate(getTodayIso());
    if (!keepSubject) {
      setSubjectId(null);
      setTopicId(null);
    }
    setSubtopicId(null);
    setTotalQuestions(10);
    setRawCorrect(8);
    setGuessesCount(0);
    setErrorGap(0);
    setErrorAttention(0);
    setErrorOther(0);
    setNotes("");
  };

  const startEditLog = (log: ExerciseLog) => {
    setEditingId(log.id);
    setDate(log.date);
    setSubjectId(log.subject_id);
    setTopicId(log.topic_id);
    setSubtopicId(log.subtopic_id);
    setTotalQuestions(log.total_questions);
    setRawCorrect(log.raw_correct);
    setGuessesCount(log.guesses_count);
    setErrorGap(log.error_gap_count);
    setErrorAttention(log.error_attention_count);
    setErrorOther(log.error_other_count);
    setNotes(log.notes ?? "");
    setError(null);
    setSuccessMsg(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!subjectId || !topicId) {
      setError("Escolha a Matéria e o Assunto antes de registrar.");
      return;
    }

    if (classifiedErrors > totalErrors) {
      setError(
        `A soma dos motivos de erro (${classifiedErrors}) não pode ultrapassar o total de erros (${totalErrors}).`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date,
        subject_id: subjectId,
        topic_id: topicId,
        subtopic_id: subtopicId,
        total_questions: safeTotal,
        raw_correct: clampedRaw,
        guesses_count: clampedGuesses,
        error_gap_count: errorGap,
        error_attention_count: errorAttention,
        error_other_count: errorOther,
        notes: notes.trim() || null,
      };

      if (editingId) {
        const previousTopicId = logs.find((l) => l.id === editingId)?.topic_id;
        const updated = await updateExerciseLog(editingId, payload);
        setLogs((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        void syncTopicFsrsState(updated.topic_id, profile.fsrs_target_retention);
        if (previousTopicId && previousTopicId !== updated.topic_id) {
          void syncTopicFsrsState(previousTopicId, profile.fsrs_target_retention);
        }
        resetForm(true);
        setSuccessMsg("Bateria atualizada e memória de revisão sincronizada.");
        showToast("Bateria atualizada e revisão sincronizada.");
      } else {
        const created = await createExerciseLog(payload);
        setLogs((prev) => [created, ...prev]);
        void syncTopicFsrsState(created.topic_id, profile.fsrs_target_retention);
        resetForm(true);
        setSuccessMsg("Bateria registrada e memória de revisão atualizada.");
        showToast("Bateria registrada e memória atualizada.");
      }

      setTimeout(() => setSuccessMsg(null), 3200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar a bateria."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    const removed = logs.find((item) => item.id === id);
    setLogs((prev) => prev.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
    if (editingId === id) resetForm(true);
    try {
      await deleteExerciseLog(id);
      if (removed?.topic_id) {
        void syncTopicFsrsState(removed.topic_id, profile.fsrs_target_retention);
      }
      showToast("Registro excluído.", "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir registro.");
      void loadAll();
    }
  };

  // Histórico filtrado
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (filterSubjectId !== "all" && log.subject_id !== filterSubjectId) {
        return false;
      }
      if (!q) return true;
      const subj = subjectMap.get(log.subject_id)?.name.toLowerCase() ?? "";
      const top = topicMap.get(log.topic_id)?.name.toLowerCase() ?? "";
      const sub = log.subtopic_id
        ? subtopicMap.get(log.subtopic_id)?.name.toLowerCase() ?? ""
        : "";
      const note = (log.notes ?? "").toLowerCase();
      return (
        subj.includes(q) ||
        top.includes(q) ||
        sub.includes(q) ||
        note.includes(q)
      );
    });
  }, [logs, filterSubjectId, searchQuery, subjectMap, topicMap, subtopicMap]);

  const filteredSummary = useMemo(() => {
    const total = filteredLogs.reduce((acc, l) => acc + l.total_questions, 0);
    const raw = filteredLogs.reduce((acc, l) => acc + l.raw_correct, 0);
    const guesses = filteredLogs.reduce((acc, l) => acc + l.guesses_count, 0);
    const real = Math.max(0, raw - guesses);
    return {
      total,
      rawPct: total > 0 ? Math.round((raw / total) * 1000) / 10 : 0,
      realPct: total > 0 ? Math.round((real / total) * 1000) / 10 : 0,
      guesses,
    };
  }, [filteredLogs]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="space-y-1.5 border-b border-[var(--border-hairline)] pb-5">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
          Registro de Baterias
        </p>
        <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
          Exercícios
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Lance suas listas em segundos separando acertos reais, chutes e o
          motivo de cada erro.
        </p>
      </header>

      {/* Banner de Modo Revisão quando vem do atalho da Home */}
      {isReviewPrefill && topicId && topicMap.get(topicId) && (
        <div className="rounded-xl px-4 py-3 bg-[var(--accent-sage-soft)] border border-[var(--accent-sage)]/30 text-[13px] text-[var(--accent-sage)] flex items-center gap-2.5">
          <ArrowsClockwise size={17} weight="duotone" className="shrink-0" />
          <span>
            <strong>Revisão rápida:</strong> assunto{" "}
            <strong className="underline underline-offset-2">
              {topicMap.get(topicId)?.name}
            </strong>{" "}
            já pré-selecionado. Lance sua bateria abaixo para atualizar a
            próxima data de revisão automaticamente.
          </span>
        </div>
      )}

      {/* Aviso se ainda não houver matérias/assuntos no Cronograma */}
      {!loading && (subjects.length === 0 || topics.length === 0) && (
        <div className="rounded-2xl p-5 bg-[var(--bg-card)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium text-[var(--text-primary)]">
              Cadastre ao menos 1 matéria e 1 assunto no Cronograma primeiro
            </p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Os exercícios ficam vinculados aos assuntos do seu cronograma para
              calcular sua prioridade de revisão.
            </p>
          </div>
          <Link
            href="/cronograma"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] text-[#FAF8F5] text-[13px] font-medium shrink-0"
          >
            <span>Ir ao Cronograma</span>
            <ArrowRight size={15} weight="light" />
          </Link>
        </div>
      )}

      {/* Mensagens de erro / sucesso */}
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

      {successMsg && (
        <div className="rounded-xl px-4 py-3 bg-[var(--accent-sage-soft)] border border-[var(--accent-sage)]/30 text-[13px] text-[var(--accent-sage)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check size={16} weight="bold" className="shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="cursor-pointer"
          >
            <X size={15} weight="light" />
          </button>
        </div>
      )}

      {/* =====================================================================
          FORMULÁRIO ULTRA-RÁPIDO DE REGISTRO
         ===================================================================== */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PencilLine
              size={19}
              weight="duotone"
              className="text-[var(--accent-sage)]"
            />
            <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
              {editingId ? "Editar bateria registrada" : "Registrar nova lista"}
            </h2>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={() => resetForm(true)}
              className="text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 cursor-pointer"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Linha 1: Data + Matéria + Assunto + Subtópico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <label className="block">
              <span className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Data
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13.5px] text-[var(--text-primary)]"
              />
            </label>

            <SearchableCombobox
              label="Matéria"
              options={subjectOptions}
              value={subjectId}
              onChange={handleSubjectChange}
              placeholder="Escolha a matéria"
              searchPlaceholder="Buscar matéria..."
              emptyText="Nenhuma matéria cadastrada."
            />

            <SearchableCombobox
              label="Assunto"
              options={topicOptions}
              value={topicId}
              onChange={handleTopicChange}
              placeholder={
                subjectId ? "Escolha o assunto" : "Selecione a matéria antes"
              }
              searchPlaceholder="Buscar assunto..."
              emptyText="Nenhum assunto nesta matéria."
              disabled={!subjectId && topicOptions.length === 0}
            />

            <SearchableCombobox
              label="Subtópico (opcional)"
              options={subtopicOptions}
              value={subtopicId}
              onChange={setSubtopicId}
              placeholder={
                !topicId
                  ? "Opcional"
                  : subtopicOptions.length === 0
                  ? "Sem subtópicos"
                  : "Opcional"
              }
              searchPlaceholder="Buscar subtópico..."
              emptyText="Este assunto não tem subtópicos."
              disabled={!topicId || subtopicOptions.length === 0}
            />
          </div>

          {/* Linha 2: Números + Painel ao vivo de Acerto Bruto vs Real */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-7 grid grid-cols-3 gap-3">
              <label className="block p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70">
                <span className="block text-[11.5px] font-medium text-[var(--text-secondary)]">
                  Total de questões
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={totalQuestions}
                  onChange={(e) =>
                    handleTotalChange(Number.parseInt(e.target.value, 10))
                  }
                  className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[18px] font-medium text-[var(--text-primary)]"
                />
              </label>

              <label className="block p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70">
                <span className="block text-[11.5px] font-medium text-[var(--text-secondary)]">
                  Acertos (gabarito)
                </span>
                <input
                  type="number"
                  min={0}
                  max={safeTotal}
                  value={clampedRaw}
                  onChange={(e) =>
                    handleRawCorrectChange(Number.parseInt(e.target.value, 10))
                  }
                  className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[18px] font-medium text-[var(--accent-slate)]"
                />
              </label>

              <label className="block p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70">
                <span className="block text-[11.5px] font-medium text-[var(--text-secondary)]">
                  Acertos no chute
                </span>
                <input
                  type="number"
                  min={0}
                  max={clampedRaw}
                  value={clampedGuesses}
                  onChange={(e) =>
                    handleGuessesChange(Number.parseInt(e.target.value, 10))
                  }
                  className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[18px] font-medium text-[var(--accent-ochre)]"
                />
              </label>
            </div>

            {/* Destaque ao vivo: Acerto Real vs Bruto */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex flex-col justify-between gap-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-muted)] block">
                    Acerto Real (sem chutes)
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-mono-tabular text-[24px] font-semibold text-[var(--accent-sage)] leading-none">
                      {realCorrect}/{safeTotal}
                    </span>
                    <span className="font-mono-tabular text-[14px] font-medium text-[var(--accent-sage)]">
                      {realPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Bruto: <strong className="font-mono-tabular text-[var(--text-primary)]">{rawPct.toFixed(1)}%</strong>
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    Erros: <strong className="font-mono-tabular text-[var(--accent-terracotta)]">{totalErrors}</strong>
                  </span>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-[var(--border-hairline)] overflow-hidden flex">
                <div
                  className="h-full bg-[var(--accent-sage)] transition-all"
                  style={{ width: `${(realCorrect / safeTotal) * 100}%` }}
                  title="Acerto Real"
                />
                <div
                  className="h-full bg-[var(--accent-ochre)] transition-all"
                  style={{ width: `${(clampedGuesses / safeTotal) * 100}%` }}
                  title="Acertos no Chute"
                />
              </div>
            </div>
          </div>

          {/* Linha 3: Contagem rápida de motivos de erro (aparece ativa quando há erros) */}
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)]/65 border border-[var(--border-hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
                  Motivos dos erros
                </span>
                <span className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                  ({classifiedErrors} de {totalErrors} classificados)
                </span>
              </div>

              {remainingErrors > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  <span className="text-[var(--text-muted)]">
                    Restantes ({remainingErrors}) como:
                  </span>
                  <button
                    type="button"
                    onClick={() => assignRemainingErrorsTo("gap")}
                    className="px-2 py-0.5 rounded-md bg-[var(--accent-terracotta-soft)] text-[var(--accent-terracotta)] font-medium hover:opacity-85 cursor-pointer"
                  >
                    + Lacuna
                  </button>
                  <button
                    type="button"
                    onClick={() => assignRemainingErrorsTo("attention")}
                    className="px-2 py-0.5 rounded-md bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)] font-medium hover:opacity-85 cursor-pointer"
                  >
                    + Atenção
                  </button>
                  <button
                    type="button"
                    onClick={() => assignRemainingErrorsTo("other")}
                    className="px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    + Outro
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  {
                    kind: "gap" as const,
                    label: "Lacuna de conteúdo",
                    value: errorGap,
                    dot: "bg-[var(--accent-terracotta)]",
                  },
                  {
                    kind: "attention" as const,
                    label: "Falta de atenção",
                    value: errorAttention,
                    dot: "bg-[var(--accent-ochre)]",
                  },
                  {
                    kind: "other" as const,
                    label: "Outro / Tempo",
                    value: errorOther,
                    dot: "bg-[var(--text-muted)]",
                  },
                ]
              ).map((item) => (
                <div
                  key={item.kind}
                  className="px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-hairline)] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${item.dot} shrink-0`} />
                    <span className="text-[12.5px] text-[var(--text-primary)] truncate">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={item.value <= 0}
                      onClick={() => stepErrorCount(item.kind, -1)}
                      aria-label={`Diminuir ${item.label}`}
                      className="w-7 h-7 rounded-lg border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-35 cursor-pointer"
                    >
                      <Minus size={12} weight="bold" />
                    </button>
                    <span className="w-7 text-center font-mono-tabular text-[14px] font-medium text-[var(--text-primary)]">
                      {item.value}
                    </span>
                    <button
                      type="button"
                      disabled={remainingErrors <= 0}
                      onClick={() => stepErrorCount(item.kind, 1)}
                      aria-label={`Aumentar ${item.label}`}
                      className="w-7 h-7 rounded-lg border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-35 cursor-pointer"
                    >
                      <Plus size={12} weight="bold" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Linha 4: Nota opcional + Botão Salvar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota opcional (ex: Lista FUVEST 2023 — revisar fórmula de potência)"
              maxLength={240}
              className="flex-1 px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13.5px] text-[var(--text-primary)]"
            />
            <button
              type="submit"
              disabled={saving || !subjectId || !topicId}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {saving ? (
                <SpinnerGap size={16} weight="light" className="animate-spin" />
              ) : (
                <Check size={16} weight="light" />
              )}
              <span>
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Registrar bateria"}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* =====================================================================
          HISTÓRICO FILTRÁVEL POR MATÉRIA
         ===================================================================== */}
      <section className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-hairline)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
                Histórico de Exercícios
              </h2>
              <p className="font-mono-tabular text-[12px] text-[var(--text-secondary)] mt-0.5">
                {filteredLogs.length}{" "}
                {filteredLogs.length === 1 ? "bateria" : "baterias"} ·{" "}
                {filteredSummary.total} questões · Bruto{" "}
                <strong className="text-[var(--text-primary)]">
                  {filteredSummary.rawPct.toFixed(1)}%
                </strong>{" "}
                · Real{" "}
                <strong className="text-[var(--accent-sage)]">
                  {filteredSummary.realPct.toFixed(1)}%
                </strong>
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <MagnifyingGlass
                size={15}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar assunto ou nota..."
                className="w-full pl-8 pr-7 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13px] text-[var(--text-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] cursor-pointer"
                >
                  <X size={13} weight="light" />
                </button>
              )}
            </div>
          </div>

          {/* Filtro rápido por matéria */}
          {subjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterSubjectId("all")}
                className={`px-3 py-1 rounded-full text-[12px] transition-colors cursor-pointer ${
                  filterSubjectId === "all"
                    ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Todas as matérias
              </button>
              {subjects.map((s) => {
                const active = filterSubjectId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFilterSubjectId(s.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] transition-colors cursor-pointer ${
                      active
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
                );
              })}
            </div>
          )}
        </div>

        {loading ? (
          <ListRowsSkeleton count={4} />
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-1.5">
            <p className="font-editorial text-[20px] text-[var(--text-primary)]">
              {logs.length === 0
                ? "Nenhuma bateria registrada ainda"
                : "Nenhum registro encontrado com esse filtro"}
            </p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {logs.length === 0
                ? "Use o formulário acima para registrar sua primeira lista de questões."
                : "Tente limpar o filtro de matéria ou busca."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {filteredLogs.map((log) => {
              const subj = subjectMap.get(log.subject_id);
              const top = topicMap.get(log.topic_id);
              const sub = log.subtopic_id
                ? subtopicMap.get(log.subtopic_id)
                : null;

              const logReal = Math.max(0, log.raw_correct - log.guesses_count);
              const logRawPct = Math.round(
                (log.raw_correct / log.total_questions) * 100
              );
              const logRealPct = Math.round(
                (logReal / log.total_questions) * 100
              );

              return (
                <div
                  key={log.id}
                  className="p-4 sm:px-5 hover:bg-[var(--bg-subtle)]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                        {formatDatePtBr(log.date)}
                      </span>
                      <span className="text-[var(--border-strong)]">•</span>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-secondary)]">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: subj?.color ?? "var(--accent-sage)",
                          }}
                        />
                        {subj?.name ?? "Matéria"}
                      </span>
                      <span className="text-[var(--text-muted)]">/</span>
                      <span className="text-[14px] font-medium text-[var(--text-primary)]">
                        {top?.name ?? "Assunto"}
                      </span>
                      {sub && (
                        <span className="text-[12.5px] text-[var(--text-secondary)]">
                          ({sub.name})
                        </span>
                      )}
                    </div>

                    {/* Badges de chutes e erros */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {log.guesses_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)] font-mono-tabular text-[11px]">
                          {log.guesses_count}{" "}
                          {log.guesses_count === 1 ? "chute" : "chutes"}
                        </span>
                      )}
                      {log.error_gap_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent-terracotta-soft)] text-[var(--accent-terracotta)] font-mono-tabular text-[11px]">
                          {log.error_gap_count} lacuna
                        </span>
                      )}
                      {log.error_attention_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] font-mono-tabular text-[11px]">
                          {log.error_attention_count} atenção
                        </span>
                      )}
                      {log.error_other_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-muted)] font-mono-tabular text-[11px]">
                          {log.error_other_count} outro
                        </span>
                      )}
                      {log.notes && (
                        <span className="text-[12px] text-[var(--text-secondary)] italic truncate max-w-[380px]">
                          — {log.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Métricas + Ações */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="flex items-center gap-3 font-mono-tabular text-right">
                      <div>
                        <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                          Bruto
                        </span>
                        <span className="text-[13px] text-[var(--text-primary)]">
                          {log.raw_correct}/{log.total_questions}{" "}
                          <span className="text-[11px] text-[var(--text-muted)]">
                            ({logRawPct}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-7 w-px bg-[var(--border-hairline)]" />
                      <div>
                        <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                          Real
                        </span>
                        <span className="text-[13.5px] font-semibold text-[var(--accent-sage)]">
                          {logReal}/{log.total_questions}{" "}
                          <span className="text-[11px] font-normal">
                            ({logRealPct}%)
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditLog(log)}
                        aria-label="Editar registro"
                        title="Editar"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                      >
                        <PencilSimple size={15} weight="light" />
                      </button>

                      {confirmDeleteId === log.id ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--accent-terracotta-soft)] text-[11.5px]">
                          <button
                            type="button"
                            onClick={() => void handleDeleteLog(log.id)}
                            className="font-medium text-[var(--accent-terracotta)] hover:underline cursor-pointer"
                          >
                            Excluir
                          </button>
                          <span className="text-[var(--text-muted)]">·</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[var(--text-secondary)] cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(log.id)}
                          aria-label="Excluir registro"
                          title="Excluir"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                        >
                          <Trash size={15} weight="light" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
