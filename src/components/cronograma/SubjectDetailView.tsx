"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  CaretDown,
  CaretRight,
  Check,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import type {
  SubjectWithTopics,
  TopicWithSubtopics,
} from "@/lib/curriculum-service";
import { getSubjectIcon } from "@/lib/subject-icons";
import { MemoryBattery } from "@/components/shared/MemoryBattery";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import { getTopicMemorySnapshot } from "@/lib/fsrsEngine";
import type { TopicStatus } from "@/types/database";

const STATUS_META: Record<
  TopicStatus,
  { label: string; next: TopicStatus; bg: string; text: string }
> = {
  not_started: {
    label: "Não iniciado",
    next: "studying",
    bg: "bg-[var(--bg-subtle)] border border-[var(--border-hairline)]",
    text: "text-[var(--text-secondary)]",
  },
  studying: {
    label: "Estudando",
    next: "mastered",
    bg: "bg-[var(--accent-ochre-soft)] border border-[var(--accent-ochre)]/30",
    text: "text-[var(--accent-ochre)]",
  },
  mastered: {
    label: "Dominado",
    next: "not_started",
    bg: "bg-[var(--accent-sage-soft)] border border-[var(--accent-sage)]/30",
    text: "text-[var(--accent-sage)]",
  },
};

interface SubjectDetailViewProps {
  subject: SubjectWithTopics;
  initialSearch?: string;
  onBack: () => void;
  onEditSubject: () => void;
  onRequestDeleteSubject: () => void;
  onCreateTopic: (name: string) => Promise<void>;
  onUpdateTopicStatus: (topicId: string, status: TopicStatus) => Promise<void>;
  onRenameTopic: (topicId: string, name: string) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
  onCreateSubtopics: (topicId: string, rawInput: string) => Promise<void>;
  onToggleSubtopic: (subtopicId: string, isCompleted: boolean) => Promise<void>;
  onRenameSubtopic: (subtopicId: string, name: string) => Promise<void>;
  onDeleteSubtopic: (subtopicId: string) => Promise<void>;
}

export function SubjectDetailView({
  subject,
  initialSearch = "",
  onBack,
  onEditSubject,
  onRequestDeleteSubject,
  onCreateTopic,
  onUpdateTopicStatus,
  onRenameTopic,
  onDeleteTopic,
  onCreateSubtopics,
  onToggleSubtopic,
  onRenameSubtopic,
  onDeleteSubtopic,
}: SubjectDetailViewProps) {
  const { profile } = useProfileTheme();
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);

  const [topicSearch, setTopicSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<"all" | TopicStatus>("all");

  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    () => {
      // Se veio de uma busca, expande automaticamente assuntos cujos subtópicos deram match
      if (!initialSearch.trim()) return {};
      const q = initialSearch.toLowerCase();
      const map: Record<string, boolean> = {};
      for (const topic of subject.topics) {
        if (topic.subtopics.some((s) => s.name.toLowerCase().includes(q))) {
          map[topic.id] = true;
        }
      }
      return map;
    }
  );

  const [subtopicInputs, setSubtopicInputs] = useState<Record<string, string>>(
    {}
  );
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicDraft, setEditingTopicDraft] = useState("");
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<
    string | null
  >(null);

  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubDraft, setEditingSubDraft] = useState("");

  const Icon = getSubjectIcon(subject.icon_name);

  const filteredTopics = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    return subject.topics.filter((topic) => {
      const effectiveStatus: TopicStatus =
        topic.subtopics.length > 0
          ? topic.completedSubtopics === topic.subtopics.length
            ? "mastered"
            : topic.completedSubtopics > 0
            ? "studying"
            : topic.status
          : topic.status;

      if (statusFilter !== "all" && effectiveStatus !== statusFilter) {
        return false;
      }

      if (!q) return true;
      return (
        topic.name.toLowerCase().includes(q) ||
        topic.subtopics.some((sub) => sub.name.toLowerCase().includes(q))
      );
    });
  }, [subject.topics, topicSearch, statusFilter]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    setAddingTopic(true);
    try {
      await onCreateTopic(newTopicName.trim());
      setNewTopicName("");
    } finally {
      setAddingTopic(false);
    }
  };

  const handleAddSubtopics = async (topicId: string, e: React.FormEvent) => {
    e.preventDefault();
    const raw = (subtopicInputs[topicId] ?? "").trim();
    if (!raw) return;
    setAddingSubFor(topicId);
    try {
      await onCreateSubtopics(topicId, raw);
      setSubtopicInputs((prev) => ({ ...prev, [topicId]: "" }));
    } finally {
      setAddingSubFor(null);
    }
  };

  const toggleExpand = (topicId: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const commitTopicRename = async (topic: TopicWithSubtopics) => {
    const cleaned = editingTopicDraft.trim();
    setEditingTopicId(null);
    if (!cleaned || cleaned === topic.name) return;
    await onRenameTopic(topic.id, cleaned);
  };

  const commitSubRename = async (subId: string, original: string) => {
    const cleaned = editingSubDraft.trim();
    setEditingSubId(null);
    if (!cleaned || cleaned === original) return;
    await onRenameSubtopic(subId, cleaned);
  };

  return (
    <div className="space-y-6">
      {/* Navegação superior */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} weight="light" />
          <span>Todas as matérias</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEditSubject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <PencilSimple size={14} weight="light" />
            <span>Editar matéria</span>
          </button>
          <button
            type="button"
            onClick={onRequestDeleteSubject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[12.5px] text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] transition-colors cursor-pointer"
          >
            <Trash size={14} weight="light" />
            <span>Excluir</span>
          </button>
        </div>
      </div>

      {/* Cabeçalho da Matéria */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${subject.color}1F`,
                color: subject.color,
              }}
            >
              <Icon size={25} weight="duotone" />
            </span>
            <div className="min-w-0">
              <h1 className="font-editorial text-[28px] sm:text-[32px] leading-tight text-[var(--text-primary)] truncate">
                {subject.name}
              </h1>
              <p className="font-mono-tabular text-[12px] text-[var(--text-secondary)] mt-0.5">
                {subject.totalTopics}{" "}
                {subject.totalTopics === 1 ? "assunto" : "assuntos"}
                {subject.totalSubtopics > 0 && (
                  <>
                    {" "}
                    · {subject.completedSubtopics}/{subject.totalSubtopics}{" "}
                    subtópicos concluídos
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="font-mono-tabular text-[26px] font-medium text-[var(--text-primary)] leading-none">
              {subject.progressPercent}%
            </span>
            <span className="block text-[11.5px] text-[var(--text-muted)] mt-1">
              Progresso geral
            </span>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${subject.progressPercent}%`,
              backgroundColor: subject.color,
            }}
          />
        </div>
      </section>

      {/* Adicionar novo Assunto Geral */}
      <form
        onSubmit={(e) => void handleAddTopic(e)}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        <input
          type="text"
          value={newTopicName}
          onChange={(e) => setNewTopicName(e.target.value)}
          placeholder={`Novo assunto em ${subject.name} (ex: Atomística, Termodinâmica...)`}
          maxLength={90}
          className="flex-1 px-4 py-2.5 rounded-[10px] bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[14px] text-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={addingTopic || !newTopicName.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Plus size={16} weight="light" />
          <span>{addingTopic ? "Adicionando..." : "Adicionar assunto"}</span>
        </button>
      </form>

      {/* Busca e filtro por status dos assuntos */}
      {subject.topics.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-[360px]">
            <MagnifyingGlass
              size={16}
              weight="light"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder="Filtrar assuntos ou subtópicos..."
              className="w-full pl-9 pr-8 py-2 rounded-[10px] bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13px] text-[var(--text-primary)]"
            />
            {topicSearch && (
              <button
                type="button"
                onClick={() => setTopicSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} weight="light" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "not_started", label: "Não iniciados" },
                { id: "studying", label: "Estudando" },
                { id: "mastered", label: "Dominados" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-[12px] transition-colors cursor-pointer ${
                  statusFilter === opt.id
                    ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                    : "bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Assuntos Gerais */}
      {subject.topics.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-2xl p-8 border border-[var(--border-hairline)] text-center space-y-2">
          <p className="font-editorial text-[20px] text-[var(--text-primary)]">
            Nenhum assunto cadastrado ainda
          </p>
          <p className="text-[13.5px] text-[var(--text-secondary)] max-w-[440px] mx-auto">
            Adicione o primeiro assunto geral acima (por exemplo, Atomística ou
            Funções). Depois você pode expandir o assunto para criar subtópicos
            se quiser.
          </p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] text-center text-[13.5px] text-[var(--text-secondary)]">
          Nenhum assunto encontrado com esse filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic) => {
            const isExpanded = Boolean(expandedTopics[topic.id]);
            const hasSubtopics = topic.subtopics.length > 0;
            const statusInfo = STATUS_META[topic.status];
            const memory = getTopicMemorySnapshot(
              topic,
              profile.fsrs_target_retention
            );

            return (
              <article
                key={topic.id}
                className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden"
              >
                {/* Linha principal do Assunto */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(topic.id)}
                      aria-label={
                        isExpanded
                          ? "Recolher subtópicos"
                          : "Expandir subtópicos"
                      }
                      title="Expandir ou adicionar subtópicos"
                      className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] shrink-0 cursor-pointer"
                    >
                      {isExpanded ? (
                        <CaretDown size={15} weight="light" />
                      ) : (
                        <CaretRight size={15} weight="light" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      {editingTopicId === topic.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void commitTopicRename(topic);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={editingTopicDraft}
                            onChange={(e) =>
                              setEditingTopicDraft(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingTopicId(null);
                            }}
                            autoFocus
                            className="flex-1 max-w-[340px] px-2.5 py-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--accent-slate)] text-[14.5px] text-[var(--text-primary)] focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded-lg bg-[var(--accent-sage)] text-[#FAF8F5] text-[12px] font-medium cursor-pointer"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTopicId(null)}
                            className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleExpand(topic.id)}
                          className="text-left group cursor-pointer"
                        >
                          <h3 className="text-[15.5px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-sage)] transition-colors leading-snug">
                            {topic.name}
                          </h3>
                        </button>
                      )}

                      {/* Metadados + barra de progresso do assunto */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono-tabular text-[11.5px] text-[var(--text-muted)]">
                          {hasSubtopics
                            ? `${topic.completedSubtopics}/${topic.subtopics.length} subtópicos (${topic.progressPercent}%)`
                            : `Sem subtópicos · ${topic.progressPercent}%`}
                        </span>

                        {hasSubtopics && (
                          <div className="w-24 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${topic.progressPercent}%`,
                                backgroundColor: subject.color,
                              }}
                            />
                          </div>
                        )}

                        {!isExpanded && !hasSubtopics && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(topic.id)}
                            className="text-[11.5px] text-[var(--accent-slate)] hover:underline cursor-pointer"
                          >
                            + Subtópicos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações à direita: Bateria de Memória + Status clicável + Editar + Excluir */}
                  <div className="flex items-center gap-2.5 pl-9 sm:pl-0 shrink-0">
                    <MemoryBattery
                      retrievability={memory.retrievability}
                      due={memory.dueIso}
                      stability={memory.stabilityDays}
                      showPercent={memory.retrievability !== null}
                    />

                    {/* Status clicável (alterna no clique) */}
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateTopicStatus(topic.id, statusInfo.next)
                      }
                      title="Clique para alternar o status (Não iniciado → Estudando → Dominado)"
                      className={`px-3 py-1 rounded-full text-[12px] font-medium transition-opacity hover:opacity-85 cursor-pointer ${statusInfo.bg} ${statusInfo.text}`}
                    >
                      {statusInfo.label}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTopicId(topic.id);
                        setEditingTopicDraft(topic.name);
                      }}
                      aria-label={`Renomear ${topic.name}`}
                      title="Renomear assunto"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <PencilSimple size={15} weight="light" />
                    </button>

                    {confirmDeleteTopicId === topic.id ? (
                      <div className="flex items-center gap-1 bg-[var(--accent-terracotta-soft)] px-2 py-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteTopicId(null);
                            void onDeleteTopic(topic.id);
                          }}
                          className="text-[11.5px] font-medium text-[var(--accent-terracotta)] hover:underline cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <span className="text-[var(--text-muted)]">·</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTopicId(null)}
                          className="text-[11.5px] text-[var(--text-secondary)] hover:underline cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTopicId(topic.id)}
                        aria-label={`Excluir ${topic.name}`}
                        title="Excluir assunto"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                      >
                        <Trash size={15} weight="light" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Painel Expandido de Subtópicos */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 pt-3 bg-[var(--bg-subtle)]/55 border-t border-[var(--border-hairline)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
                        Subtópicos ({topic.subtopics.length})
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Dica: separe por vírgula para adicionar vários de uma vez
                      </span>
                    </div>

                    {topic.subtopics.length > 0 && (
                      <div className="space-y-1.5">
                        {topic.subtopics.map((sub) => (
                          <div
                            key={sub.id}
                            className="group flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-hairline)]/80"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void onToggleSubtopic(
                                    sub.id,
                                    !sub.is_completed
                                  )
                                }
                                aria-label={
                                  sub.is_completed
                                    ? `Desmarcar ${sub.name}`
                                    : `Concluir ${sub.name}`
                                }
                                className={`w-4.5 h-4.5 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                  sub.is_completed
                                    ? "bg-[var(--accent-sage)] border-[var(--accent-sage)] text-[#FAF8F5]"
                                    : "border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--accent-sage)]"
                                }`}
                              >
                                {sub.is_completed && (
                                  <Check size={11} weight="bold" />
                                )}
                              </button>

                              {editingSubId === sub.id ? (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void commitSubRename(sub.id, sub.name);
                                  }}
                                  className="flex items-center gap-2 flex-1"
                                >
                                  <input
                                    type="text"
                                    value={editingSubDraft}
                                    onChange={(e) =>
                                      setEditingSubDraft(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape")
                                        setEditingSubId(null);
                                    }}
                                    autoFocus
                                    className="flex-1 px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--accent-slate)] text-[13.5px] text-[var(--text-primary)] focus:outline-none"
                                  />
                                  <button
                                    type="submit"
                                    className="text-[12px] font-medium text-[var(--accent-sage)] cursor-pointer"
                                  >
                                    Salvar
                                  </button>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void onToggleSubtopic(
                                      sub.id,
                                      !sub.is_completed
                                    )
                                  }
                                  className={`text-left text-[13.5px] truncate cursor-pointer ${
                                    sub.is_completed
                                      ? "line-through text-[var(--text-muted)]"
                                      : "text-[var(--text-primary)]"
                                  }`}
                                >
                                  {sub.name}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubId(sub.id);
                                  setEditingSubDraft(sub.name);
                                }}
                                aria-label={`Editar ${sub.name}`}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                              >
                                <PencilSimple size={13} weight="light" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDeleteSubtopic(sub.id)}
                                aria-label={`Remover ${sub.name}`}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                              >
                                <X size={13} weight="light" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input rápido para adicionar subtópicos */}
                    <form
                      onSubmit={(e) => void handleAddSubtopics(topic.id, e)}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={subtopicInputs[topic.id] ?? ""}
                        onChange={(e) =>
                          setSubtopicInputs((prev) => ({
                            ...prev,
                            [topic.id]: e.target.value,
                          }))
                        }
                        placeholder="Ex: Dalton, Thomson, Rutherford, Bohr, Modelo Atual"
                        className="flex-1 px-3 py-2 rounded-[10px] bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13px] text-[var(--text-primary)]"
                      />
                      <button
                        type="submit"
                        disabled={
                          addingSubFor === topic.id ||
                          !(subtopicInputs[topic.id] ?? "").trim()
                        }
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-[10px] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[12.5px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Plus size={14} weight="light" />
                        <span>Adicionar</span>
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
