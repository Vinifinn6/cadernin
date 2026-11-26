"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  GridFour,
  Lightning,
  PencilSimple,
  Plus,
  SpinnerGap,
  Timer,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { ExpressExamModal } from "@/components/simulados/ExpressExamModal";
import {
  XraySetupModal,
  type XrayGridConfig,
} from "@/components/simulados/XraySetupModal";
import {
  saveXrayGridConfig,
  XrayExamWorkspace,
} from "@/components/simulados/XrayExamWorkspace";
import { fetchCurriculumData } from "@/lib/curriculum-service";
import { fetchEnemSkills } from "@/lib/enem-service";
import {
  createMockExam,
  deleteMockExam,
  fetchMockExamsAndQuestions,
  type MockExamInput,
  updateMockExam,
} from "@/lib/mock-exams-service";
import { groupMockExams } from "@/lib/mockGrouping";
import { useToast } from "@/components/providers/ToastProvider";
import { ListRowsSkeleton } from "@/components/shared/EditorialSkeleton";
import type {
  EnemSkill,
  MockExam,
  MockQuestion,
  MockTaggingMode,
  Subject,
  Subtopic,
  Topic,
} from "@/types/database";

function formatDatePtBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function SimuladosWorkspace() {
  const { showToast } = useToast();
  const [exams, setExams] = useState<MockExam[]>([]);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [enemSkills, setEnemSkills] = useState<EnemSkill[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modais e estado de navegação
  const [modeChooserOpen, setModeChooserOpen] = useState(false);
  const [expressModalOpen, setExpressModalOpen] = useState(false);
  const [editingExpressExam, setEditingExpressExam] =
    useState<MockExam | null>(null);
  const [xraySetupOpen, setXraySetupOpen] = useState(false);

  const [activeXrayExamId, setActiveXrayExamId] = useState<string | null>(null);
  const [activeXrayInitialGrid, setActiveXrayInitialGrid] = useState<
    XrayGridConfig | undefined
  >(undefined);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [simData, curriculum, skills] = await Promise.all([
        fetchMockExamsAndQuestions(),
        fetchCurriculumData(),
        fetchEnemSkills(),
      ]);
      setExams(simData.exams);
      setQuestions(simData.questions);
      setSubjects(curriculum.subjects);
      setTopics(curriculum.topics);
      setSubtopics(curriculum.subtopics);
      setEnemSkills(skills);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os simulados."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const questionsByExam = useMemo(() => {
    const map = new Map<string, MockQuestion[]>();
    for (const q of questions) {
      const list = map.get(q.mock_exam_id) ?? [];
      list.push(q);
      map.set(q.mock_exam_id, list);
    }
    return map;
  }, [questions]);

  const groupedExams = useMemo(
    () => groupMockExams(exams, questions),
    [exams, questions]
  );

  const activeXrayExam = useMemo(
    () => exams.find((e) => e.id === activeXrayExamId) ?? null,
    [exams, activeXrayExamId]
  );

  const handleSaveExpress = async (
    payload: MockExamInput,
    existingId?: string
  ) => {
    if (existingId) {
      const updated = await updateMockExam(existingId, payload);
      setExams((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      showToast(`Simulado "${updated.title}" atualizado.`);
    } else {
      const created = await createMockExam(payload);
      setExams((prev) => [created, ...prev]);
      showToast(`Simulado "${created.title}" salvo.`);
    }
  };

  const handleCreateXray = async (params: {
    title: string;
    date: string;
    tagging_mode: MockTaggingMode;
    gridConfig: XrayGridConfig;
  }) => {
    const created = await createMockExam({
      title: params.title,
      date: params.date,
      mode: "xray",
      tagging_mode: params.tagging_mode,
      score_lc: null,
      score_ch: null,
      score_cn: null,
      score_mt: null,
      tri_lc: null,
      tri_ch: null,
      tri_cn: null,
      tri_mt: null,
      essay_total: null,
      essay_c1: null,
      essay_c2: null,
      essay_c3: null,
      essay_c4: null,
      essay_c5: null,
      notes: null,
    });

    saveXrayGridConfig(created.id, params.gridConfig);
    setExams((prev) => [created, ...prev]);
    setActiveXrayInitialGrid(params.gridConfig);
    setActiveXrayExamId(created.id);
  };

  const handleDeleteExam = async (id: string) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
    setQuestions((prev) => prev.filter((q) => q.mock_exam_id !== id));
    setConfirmDeleteId(null);
    try {
      await deleteMockExam(id);
      showToast("Simulado excluído.", "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir simulado.");
      void loadAll();
    }
  };

  const handleQuestionsChanged = useCallback(
    (examId: string, nextForExam: MockQuestion[]) => {
      setQuestions((prev) => [
        ...prev.filter((q) => q.mock_exam_id !== examId),
        ...nextForExam,
      ]);
    },
    []
  );

  const handleExamUpdated = useCallback((updated: MockExam) => {
    setExams((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }, []);

  // Modo Raio-X aberto em tela dedicada
  if (activeXrayExam) {
    return (
      <XrayExamWorkspace
        exam={activeXrayExam}
        initialQuestions={questionsByExam.get(activeXrayExam.id) ?? []}
        initialGridConfig={activeXrayInitialGrid}
        subjects={subjects}
        topics={topics}
        subtopics={subtopics}
        enemSkills={enemSkills}
        onBack={() => {
          setActiveXrayExamId(null);
          setActiveXrayInitialGrid(undefined);
        }}
        onExamUpdated={handleExamUpdated}
        onQuestionsChanged={handleQuestionsChanged}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div className="space-y-1">
          <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
            Provas &amp; Vestibulares
          </p>
          <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            Simulados
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            Registre resultados rápidos no Modo Express ou corrija questão a
            questão no Cartão-Resposta Raio-X.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModeChooserOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer shrink-0"
        >
          <Plus size={16} weight="light" />
          <span>Novo Simulado</span>
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

      {/* Lista de Simulados */}
      {loading ? (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
          <ListRowsSkeleton count={4} />
        </div>
      ) : exams.length === 0 ? (
        <section className="bg-[var(--bg-card)] rounded-2xl p-10 border border-[var(--border-hairline)] text-center space-y-4">
          <span className="w-12 h-12 rounded-2xl bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] mx-auto flex items-center justify-center">
            <Timer size={24} weight="duotone" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-editorial text-[24px] text-[var(--text-primary)]">
              Nenhum simulado registrado ainda
            </h2>
            <p className="text-[14px] text-[var(--text-secondary)] max-w-[480px] mx-auto leading-relaxed">
              Escolha o <strong>Modo Express</strong> para lançar só os acertos,
              TRI e redação, ou o <strong>Modo Raio-X</strong> para mapear cada
              questão por assunto e habilidade ENEM.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setEditingExpressExam(null);
                setExpressModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[13px] font-medium text-[var(--text-primary)] cursor-pointer"
            >
              <Lightning size={15} weight="duotone" className="text-[var(--accent-ochre)]" />
              <span>Novo Modo Express</span>
            </button>
            <button
              type="button"
              onClick={() => setXraySetupOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer"
            >
              <GridFour size={15} weight="duotone" />
              <span>Novo Modo Raio-X</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {groupedExams.map((group) => {
            const isXray = group.mode === "xray";
            const triDone =
              group.triByArea.tri_lc !== null ||
              group.triByArea.tri_ch !== null ||
              group.triByArea.tri_cn !== null ||
              group.triByArea.tri_mt !== null;

            const singlePart = !group.isGrouped ? group.parts[0] : null;
            const hasAnyScore =
              group.scoresByArea.score_lc !== null ||
              group.scoresByArea.score_ch !== null ||
              group.scoresByArea.score_cn !== null ||
              group.scoresByArea.score_mt !== null;

            const tris = [
              group.triByArea.tri_lc,
              group.triByArea.tri_ch,
              group.triByArea.tri_cn,
              group.triByArea.tri_mt,
            ].filter((v): v is number => v !== null);

            return (
              <article
                key={group.id}
                className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-hairline)] hover:border-[var(--border-strong)] transition-colors space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono-tabular text-[11px] font-medium ${
                          isXray
                            ? "bg-[var(--accent-slate-soft)] text-[var(--accent-slate)]"
                            : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]"
                        }`}
                      >
                        {isXray ? (
                          <GridFour size={12} weight="duotone" />
                        ) : (
                          <Lightning size={12} weight="duotone" />
                        )}
                        {isXray ? "Raio-X" : "Express"}
                      </span>

                      {group.isGrouped && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-mono-tabular text-[11px] font-medium">
                          {group.parts.length} dias agrupados
                        </span>
                      )}

                      <span className="font-mono-tabular text-[12px] text-[var(--text-muted)]">
                        {formatDatePtBr(group.date)}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const targetExam = group.parts[0].exam;
                          if (targetExam.mode === "xray") {
                            setActiveXrayInitialGrid(undefined);
                            setActiveXrayExamId(targetExam.id);
                          } else {
                            setEditingExpressExam(targetExam);
                            setExpressModalOpen(true);
                          }
                        }}
                        title="Clique para editar notas TRI e Redação"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono-tabular text-[11px] cursor-pointer ${
                          triDone
                            ? "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]"
                            : "bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)]"
                        }`}
                      >
                        {triDone ? (
                          <CheckCircle size={12} weight="duotone" />
                        ) : (
                          <Clock size={12} weight="light" />
                        )}
                        {triDone ? "TRI preenchida" : "TRI pendente"}
                      </button>
                    </div>

                    <h2 className="font-editorial text-[22px] leading-tight text-[var(--text-primary)]">
                      {group.displayTitle}
                    </h2>
                  </div>

                  {/* Ações para simulado individual (quando 1 parte) */}
                  {singlePart && (
                    <div className="flex items-center gap-2 shrink-0">
                      {singlePart.exam.mode === "xray" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveXrayInitialGrid(undefined);
                            setActiveXrayExamId(singlePart.exam.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[12.5px] font-medium cursor-pointer"
                        >
                          <span>Abrir Cartão-Resposta</span>
                          <ArrowRight size={14} weight="light" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpressExam(singlePart.exam);
                            setExpressModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[12.5px] font-medium text-[var(--text-primary)] cursor-pointer"
                        >
                          <PencilSimple size={14} weight="light" />
                          <span>Editar / TRI</span>
                        </button>
                      )}

                      {confirmDeleteId === singlePart.exam.id ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--accent-terracotta-soft)] text-[12px]">
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteExam(singlePart.exam.id)
                            }
                            className="font-medium text-[var(--accent-terracotta)] hover:underline cursor-pointer"
                          >
                            Confirmar
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
                          onClick={() =>
                            setConfirmDeleteId(singlePart.exam.id)
                          }
                          aria-label={`Excluir ${singlePart.exam.title}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                        >
                          <Trash size={15} weight="light" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Resumo consolidado de métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60">
                    <span className="text-[11px] text-[var(--text-muted)] block">
                      {group.hasDetailedQuestions
                        ? "Acerto Bruto vs Real"
                        : "Acertos Brutos"}
                    </span>
                    {group.hasDetailedQuestions ? (
                      <p className="font-mono-tabular text-[15px] text-[var(--text-primary)] mt-0.5">
                        <strong>{group.rawCorrect}</strong>{" "}
                        <span className="text-[12px] text-[var(--text-muted)]">
                          bruto
                        </span>{" "}
                        ·{" "}
                        <strong className="text-[var(--accent-sage)]">
                          {group.realCorrect}
                        </strong>{" "}
                        <span className="text-[12px] text-[var(--accent-sage)]">
                          real
                        </span>
                      </p>
                    ) : (
                      <p className="font-mono-tabular text-[15px] font-medium text-[var(--text-primary)] mt-0.5">
                        {hasAnyScore ? `${group.rawCorrect} acertos` : "—"}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60">
                    <span className="text-[11px] text-[var(--text-muted)] block">
                      Áreas (LC · CH · CN · MT)
                    </span>
                    <p className="font-mono-tabular text-[13px] text-[var(--text-primary)] mt-1">
                      {[
                        group.scoresByArea.score_lc ?? "–",
                        group.scoresByArea.score_ch ?? "–",
                        group.scoresByArea.score_cn ?? "–",
                        group.scoresByArea.score_mt ?? "–",
                      ].join(" · ")}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60">
                    <span className="text-[11px] text-[var(--text-muted)] block">
                      Média TRI
                    </span>
                    {tris.length === 0 ? (
                      <p className="font-mono-tabular text-[13.5px] text-[var(--text-muted)] mt-0.5">
                        Aguardando nota
                      </p>
                    ) : (
                      <p className="font-mono-tabular text-[15px] font-medium text-[var(--accent-slate)] mt-0.5">
                        {(
                          tris.reduce((a, b) => a + Number(b), 0) / tris.length
                        ).toFixed(1)}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/60">
                    <span className="text-[11px] text-[var(--text-muted)] block">
                      Redação
                    </span>
                    <p className="font-mono-tabular text-[15px] font-medium text-[var(--text-primary)] mt-0.5">
                      {group.essay.essay_total !== null
                        ? group.essay.essay_total
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Acessos individuais por parte quando agrupado (ex: Dia 1 e Dia 2) */}
                {group.isGrouped && (
                  <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-2">
                    {group.parts.map((part) => (
                      <div
                        key={part.exam.id}
                        className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-1"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (part.exam.mode === "xray") {
                              setActiveXrayInitialGrid(undefined);
                              setActiveXrayExamId(part.exam.id);
                            } else {
                              setEditingExpressExam(part.exam);
                              setExpressModalOpen(true);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--accent-sage-soft)] text-[12px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-sage)] transition-colors cursor-pointer"
                        >
                          <span>{part.shortLabel}</span>
                          <ArrowRight size={13} weight="light" />
                        </button>

                        {confirmDeleteId === part.exam.id ? (
                          <div className="flex items-center gap-1 px-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteExam(part.exam.id)
                              }
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
                            onClick={() => setConfirmDeleteId(part.exam.id)}
                            aria-label={`Excluir ${part.shortLabel}`}
                            title={`Excluir ${part.shortLabel}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                          >
                            <Trash size={13} weight="light" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Seletor de Modo: Express vs Raio-X */}
      {modeChooserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setModeChooserOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-[540px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-5"
            style={{ boxShadow: "var(--shadow-tactile)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-editorial text-[24px] text-[var(--text-primary)]">
                Como você quer registrar este simulado?
              </h2>
              <button
                type="button"
                onClick={() => setModeChooserOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X size={18} weight="light" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setModeChooserOpen(false);
                  setEditingExpressExam(null);
                  setExpressModalOpen(true);
                }}
                className="p-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 hover:bg-[var(--bg-subtle)] hover:border-[var(--accent-ochre)] text-left space-y-2.5 transition-colors cursor-pointer"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)] flex items-center justify-center">
                  <Lightning size={21} weight="duotone" />
                </span>
                <div>
                  <h3 className="font-editorial text-[20px] text-[var(--text-primary)]">
                    Modo Express
                  </h3>
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Rápido: informe apenas os acertos por área (LC, CH, CN, MT),
                    TRI opcional e Redação (C1 a C5).
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModeChooserOpen(false);
                  setXraySetupOpen(true);
                }}
                className="p-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 hover:bg-[var(--bg-subtle)] hover:border-[var(--accent-sage)] text-left space-y-2.5 transition-colors cursor-pointer"
              >
                <span className="w-10 h-10 rounded-xl bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] flex items-center justify-center">
                  <GridFour size={21} weight="duotone" />
                </span>
                <div>
                  <h3 className="font-editorial text-[20px] text-[var(--text-primary)]">
                    Modo Raio-X
                  </h3>
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Cartão-resposta rápido questão por questão: separa acertos
                    reais, chutes (1/2/3), erros, assuntos e habilidades ENEM.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modo Express */}
      <ExpressExamModal
        open={expressModalOpen}
        editingExam={editingExpressExam}
        onClose={() => {
          setExpressModalOpen(false);
          setEditingExpressExam(null);
        }}
        onSave={handleSaveExpress}
      />

      {/* Modal Configuração Inicial Modo Raio-X */}
      <XraySetupModal
        open={xraySetupOpen}
        onClose={() => setXraySetupOpen(false)}
        onCreate={handleCreateXray}
      />
    </div>
  );
}
