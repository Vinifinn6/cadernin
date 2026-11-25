"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookBookmark,
  CaretRight,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SpinnerGap,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  buildCurriculumTree,
  createSubject,
  createSubtopic,
  createTopic,
  deleteSubject,
  deleteSubtopic,
  deleteTopic,
  fetchCurriculumData,
  type SubjectWithTopics,
  updateSubject,
  updateSubtopic,
  updateTopic,
} from "@/lib/curriculum-service";
import { getSubjectIcon } from "@/lib/subject-icons";
import { SubjectFormModal } from "@/components/cronograma/SubjectFormModal";
import { SubjectDetailView } from "@/components/cronograma/SubjectDetailView";
import { useToast } from "@/components/providers/ToastProvider";
import { CardGridSkeleton } from "@/components/shared/EditorialSkeleton";
import type { Subject, Subtopic, Topic, TopicStatus } from "@/types/database";

export function CronogramaWorkspace() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null
  );

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] =
    useState<SubjectWithTopics | null>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCurriculumData();
      setSubjects(data.subjects);
      setTopics(data.topics);
      setSubtopics(data.subtopics);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar seu cronograma."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tree = useMemo(
    () => buildCurriculumTree(subjects, topics, subtopics),
    [subjects, topics, subtopics]
  );

  const overallStats = useMemo(() => {
    const totalSubjects = tree.length;
    const totalTopics = tree.reduce((acc, s) => acc + s.totalTopics, 0);
    const overallProgress =
      totalTopics === 0
        ? 0
        : Math.round(
            tree
              .flatMap((s) => s.topics)
              .reduce((acc, t) => acc + t.progressPercent, 0) / totalTopics
          );
    return { totalSubjects, totalTopics, overallProgress };
  }, [tree]);

  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tree;
    return tree.filter((subject) => {
      if (subject.name.toLowerCase().includes(q)) return true;
      return subject.topics.some(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subtopics.some((sub) => sub.name.toLowerCase().includes(q))
      );
    });
  }, [tree, searchQuery]);

  const selectedSubject = useMemo(
    () => tree.find((s) => s.id === selectedSubjectId) ?? null,
    [tree, selectedSubjectId]
  );

  const handleSaveSubject = async (values: {
    name: string;
    color: string;
    icon_name: string;
  }) => {
    if (editingSubject) {
      const updated = await updateSubject(editingSubject.id, values);
      setSubjects((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      showToast(`Matéria "${updated.name}" atualizada.`);
    } else {
      const created = await createSubject({
        ...values,
        sort_order: subjects.length,
      });
      setSubjects((prev) => [...prev, created]);
      showToast(`Matéria "${created.name}" criada.`);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setDeletingSubject(true);
    try {
      const removedName = subjectToDelete.name;
      await deleteSubject(subjectToDelete.id);
      const removedTopicIds = new Set(
        topics
          .filter((t) => t.subject_id === subjectToDelete.id)
          .map((t) => t.id)
      );
      setSubjects((prev) => prev.filter((s) => s.id !== subjectToDelete.id));
      setTopics((prev) =>
        prev.filter((t) => t.subject_id !== subjectToDelete.id)
      );
      setSubtopics((prev) =>
        prev.filter((sub) => !removedTopicIds.has(sub.topic_id))
      );
      if (selectedSubjectId === subjectToDelete.id) {
        setSelectedSubjectId(null);
      }
      setSubjectToDelete(null);
      showToast(`Matéria "${removedName}" excluída.`, "info");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir a matéria."
      );
    } finally {
      setDeletingSubject(false);
    }
  };

  const handleCreateTopic = async (subjectId: string, name: string) => {
    const count = topics.filter((t) => t.subject_id === subjectId).length;
    const created = await createTopic({
      subject_id: subjectId,
      name,
      status: "not_started",
      sort_order: count,
    });
    setTopics((prev) => [...prev, created]);
  };

  const handleUpdateTopicStatus = async (
    topicId: string,
    status: TopicStatus
  ) => {
    // Atualização otimista para sensação instantânea
    setTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, status } : t))
    );
    try {
      await updateTopic(topicId, { status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status.");
      void loadData();
    }
  };

  const handleRenameTopic = async (topicId: string, name: string) => {
    setTopics((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, name } : t))
    );
    try {
      await updateTopic(topicId, { name });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao renomear assunto."
      );
      void loadData();
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
    setSubtopics((prev) => prev.filter((s) => s.topic_id !== topicId));
    try {
      await deleteTopic(topicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir assunto.");
      void loadData();
    }
  };

  const handleCreateSubtopics = async (topicId: string, rawInput: string) => {
    const pieces = rawInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (pieces.length === 0) return;

    const baseOrder = subtopics.filter((s) => s.topic_id === topicId).length;
    const createdList: Subtopic[] = [];

    for (let i = 0; i < pieces.length; i++) {
      const created = await createSubtopic({
        topic_id: topicId,
        name: pieces[i],
        sort_order: baseOrder + i,
      });
      createdList.push(created);
    }

    setSubtopics((prev) => [...prev, ...createdList]);
  };

  const handleToggleSubtopic = async (
    subtopicId: string,
    isCompleted: boolean
  ) => {
    setSubtopics((prev) =>
      prev.map((s) =>
        s.id === subtopicId ? { ...s, is_completed: isCompleted } : s
      )
    );
    try {
      await updateSubtopic(subtopicId, { is_completed: isCompleted });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao marcar subtópico."
      );
      void loadData();
    }
  };

  const handleRenameSubtopic = async (subtopicId: string, name: string) => {
    setSubtopics((prev) =>
      prev.map((s) => (s.id === subtopicId ? { ...s, name } : s))
    );
    try {
      await updateSubtopic(subtopicId, { name });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao renomear subtópico."
      );
      void loadData();
    }
  };

  const handleDeleteSubtopic = async (subtopicId: string) => {
    setSubtopics((prev) => prev.filter((s) => s.id !== subtopicId));
    try {
      await deleteSubtopic(subtopicId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao remover subtópico."
      );
      void loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Aviso de erro caso ocorra falha de rede */}
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
            aria-label="Fechar erro"
          >
            <X size={15} weight="light" />
          </button>
        </div>
      )}

      {/* Visão de Detalhe de uma Matéria */}
      {selectedSubject ? (
        <SubjectDetailView
          subject={selectedSubject}
          initialSearch={searchQuery}
          onBack={() => setSelectedSubjectId(null)}
          onEditSubject={() => {
            setEditingSubject(selectedSubject);
            setSubjectModalOpen(true);
          }}
          onRequestDeleteSubject={() => setSubjectToDelete(selectedSubject)}
          onCreateTopic={(name) => handleCreateTopic(selectedSubject.id, name)}
          onUpdateTopicStatus={handleUpdateTopicStatus}
          onRenameTopic={handleRenameTopic}
          onDeleteTopic={handleDeleteTopic}
          onCreateSubtopics={handleCreateSubtopics}
          onToggleSubtopic={handleToggleSubtopic}
          onRenameSubtopic={handleRenameSubtopic}
          onDeleteSubtopic={handleDeleteSubtopic}
        />
      ) : (
        /* Visão Macro — Cards de todas as Matérias */
        <>
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
            <div className="space-y-1">
              <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
                Árvore de Conteúdos
              </p>
              <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
                Cronograma
              </h1>
              <p className="text-[14px] text-[var(--text-secondary)]">
                Organize suas matérias, assuntos gerais e subtópicos com
                acompanhamento automático de progresso.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingSubject(null);
                setSubjectModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer shrink-0"
            >
              <Plus size={16} weight="light" />
              <span>Nova matéria</span>
            </button>
          </header>

          {/* Resumo + Barra de Busca Rápida */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-[440px]">
              <MagnifyingGlass
                size={17}
                weight="light"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar matéria, assunto ou subtópico..."
                className="w-full pl-10 pr-9 py-2.5 rounded-[10px] bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13.5px] text-[var(--text-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar busca"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={15} weight="light" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 font-mono-tabular text-[12px] text-[var(--text-secondary)]">
              <span>
                {overallStats.totalSubjects}{" "}
                {overallStats.totalSubjects === 1 ? "matéria" : "matérias"}
              </span>
              <span className="text-[var(--border-strong)]">•</span>
              <span>
                {overallStats.totalTopics}{" "}
                {overallStats.totalTopics === 1 ? "assunto" : "assuntos"}
              </span>
              <span className="text-[var(--border-strong)]">•</span>
              <span className="text-[var(--accent-sage)] font-medium">
                {overallStats.overallProgress}% concluído
              </span>
            </div>
          </div>

          {/* Lista / Grade de Cards das Matérias */}
          {loading ? (
            <CardGridSkeleton count={6} />
          ) : tree.length === 0 ? (
            <section className="bg-[var(--bg-card)] rounded-2xl p-10 border border-[var(--border-hairline)] text-center space-y-4">
              <span className="w-12 h-12 rounded-2xl bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] mx-auto flex items-center justify-center">
                <BookBookmark size={24} weight="duotone" />
              </span>
              <div className="space-y-1.5">
                <h2 className="font-editorial text-[24px] text-[var(--text-primary)]">
                  Monte seu cronograma do seu jeito
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] max-w-[460px] mx-auto leading-relaxed">
                  Comece criando suas primeiras matérias (ex: Matemática,
                  Física, Química, História). Dentro de cada matéria você
                  cadastra assuntos gerais e subtópicos opcionais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer"
              >
                <Plus size={16} weight="light" />
                <span>Criar primeira matéria</span>
              </button>
            </section>
          ) : filteredTree.length === 0 ? (
            <section className="bg-[var(--bg-card)] rounded-2xl p-8 border border-[var(--border-hairline)] text-center space-y-2">
              <p className="font-editorial text-[20px] text-[var(--text-primary)]">
                Nenhum resultado para “{searchQuery}”
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[13px] font-medium text-[var(--accent-sage)] hover:underline cursor-pointer"
              >
                Limpar busca
              </button>
            </section>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTree.map((subject) => {
                const Icon = getSubjectIcon(subject.icon_name);
                const q = searchQuery.trim().toLowerCase();
                const matchingTopics = q
                  ? subject.topics.filter(
                      (t) =>
                        t.name.toLowerCase().includes(q) ||
                        t.subtopics.some((s) =>
                          s.name.toLowerCase().includes(q)
                        )
                    )
                  : [];

                return (
                  <article
                    key={subject.id}
                    className="group bg-[var(--bg-card)] rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--border-strong)] transition-colors flex flex-col justify-between overflow-hidden"
                  >
                    <div
                      onClick={() => setSelectedSubjectId(subject.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedSubjectId(subject.id);
                        }
                      }}
                      className="p-5 space-y-4 flex-1 cursor-pointer focus:outline-none"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${subject.color}1F`,
                            color: subject.color,
                          }}
                        >
                          <Icon size={23} weight="duotone" />
                        </span>

                        <div
                          className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubject(subject);
                              setSubjectModalOpen(true);
                            }}
                            aria-label={`Editar ${subject.name}`}
                            title="Editar matéria"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                          >
                            <PencilSimple size={15} weight="light" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubjectToDelete(subject)}
                            aria-label={`Excluir ${subject.name}`}
                            title="Excluir matéria"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                          >
                            <Trash size={15} weight="light" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h2 className="font-editorial text-[22px] leading-tight text-[var(--text-primary)] group-hover:text-[var(--accent-sage)] transition-colors">
                          {subject.name}
                        </h2>
                        <p className="font-mono-tabular text-[11.5px] text-[var(--text-secondary)]">
                          {subject.totalTopics}{" "}
                          {subject.totalTopics === 1 ? "assunto" : "assuntos"}
                          {subject.totalSubtopics > 0 && (
                            <> · {subject.totalSubtopics} subtópicos</>
                          )}
                        </p>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between font-mono-tabular text-[11.5px]">
                          <span className="text-[var(--text-muted)]">
                            {subject.masteredTopics}/{subject.totalTopics}{" "}
                            dominados
                          </span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {subject.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${subject.progressPercent}%`,
                              backgroundColor: subject.color,
                            }}
                          />
                        </div>
                      </div>

                      {/* Resultados encontrados na busca dentro dos assuntos */}
                      {matchingTopics.length > 0 && (
                        <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1">
                          <span className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--text-muted)] block">
                            Assuntos encontrados
                          </span>
                          {matchingTopics.slice(0, 3).map((t) => (
                            <p
                              key={t.id}
                              className="text-[12px] text-[var(--text-primary)] truncate"
                            >
                              • {t.name}
                            </p>
                          ))}
                          {matchingTopics.length > 3 && (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              + {matchingTopics.length - 3} outros
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSubjectId(subject.id)}
                      className="px-5 py-2.5 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 hover:bg-[var(--bg-subtle)] flex items-center justify-between text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <span>Abrir assuntos</span>
                      <CaretRight size={14} weight="light" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Criar / Editar Matéria */}
      <SubjectFormModal
        open={subjectModalOpen}
        editingSubject={editingSubject}
        onClose={() => setSubjectModalOpen(false)}
        onSubmit={handleSaveSubject}
      />

      {/* Modal Confirmação de Exclusão de Matéria */}
      {subjectToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setSubjectToDelete(null)}
          />
          <div
            className="relative z-10 w-full max-w-[420px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-4"
            style={{ boxShadow: "var(--shadow-tactile)" }}
          >
            <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
              Excluir “{subjectToDelete.name}”?
            </h2>
            <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
              Esta ação apagará permanentemente a matéria
              {subjectToDelete.totalTopics > 0
                ? `, seus ${subjectToDelete.totalTopics} assuntos e ${subjectToDelete.totalSubtopics} subtópicos`
                : ""}
              .
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingSubject}
                onClick={() => void handleConfirmDeleteSubject()}
                className="px-4 py-2 rounded-[10px] bg-[var(--accent-terracotta)] hover:opacity-90 text-white text-[13px] font-medium cursor-pointer disabled:opacity-60"
              >
                {deletingSubject ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
