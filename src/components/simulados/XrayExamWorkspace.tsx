"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  CloudCheck,
  Eraser,
  Plus,
  Question,
  SlidersHorizontal,
  SpinnerGap,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react";
import {
  ExamMetaFormFields,
  parseNullableFloat,
  parseNullableInt,
  type TriAndEssayValues,
} from "@/components/simulados/ExamMetaFormFields";
import type { XrayGridConfig } from "@/components/simulados/XraySetupModal";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "@/components/shared/SearchableCombobox";
import {
  computeAreaScoresFromQuestions,
  deleteMockQuestion,
  updateMockExam,
  upsertMockQuestion,
} from "@/lib/mock-exams-service";
import { syncTopicFsrsState } from "@/lib/fsrs-service";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import type {
  EnemArea,
  EnemSkill,
  MockExam,
  MockQuestion,
  MockTaggingMode,
  QuestionOutcome,
  Subject,
  Subtopic,
  Topic,
} from "@/types/database";

const AREA_SHORT: Record<EnemArea, string> = {
  linguagens: "LC",
  humanas: "CH",
  natureza: "CN",
  matematica: "MT",
};

const AREA_LABEL: Record<EnemArea, string> = {
  linguagens: "Linguagens",
  humanas: "Humanas",
  natureza: "Natureza",
  matematica: "Matemática",
};

interface OutcomeButtonSpec {
  outcome: QuestionOutcome;
  shortcut: string;
  label: string;
  hint: string;
  group: "real" | "guess" | "error";
}

const OUTCOME_BUTTONS: OutcomeButtonSpec[] = [
  {
    outcome: "real_correct",
    shortcut: "1",
    label: "Acerto Real",
    hint: "Sabia o conteúdo e resolveu com segurança",
    group: "real",
  },
  {
    outcome: "guess_1",
    shortcut: "2",
    label: "Chute Nível 1",
    hint: "Pouca dúvida — quase certo",
    group: "guess",
  },
  {
    outcome: "guess_2",
    shortcut: "3",
    label: "Chute Nível 2",
    hint: "Entre 2 opções pelo contexto",
    group: "guess",
  },
  {
    outcome: "guess_3",
    shortcut: "4",
    label: "Chute Nível 3",
    hint: "Chute total / no escuro",
    group: "guess",
  },
  {
    outcome: "error_gap",
    shortcut: "5",
    label: "Erro: Lacuna de Conteúdo",
    hint: "Faltou domínio teórico ou fórmula",
    group: "error",
  },
  {
    outcome: "error_attention",
    shortcut: "6",
    label: "Erro: Falta de Atenção",
    hint: "Descuido de leitura, conta ou gabarito",
    group: "error",
  },
  {
    outcome: "error_other",
    shortcut: "7",
    label: "Erro: Tempo / Outro",
    hint: "Faltou tempo ou outro motivo",
    group: "error",
  },
];

function getOutcomeGroup(
  outcome?: QuestionOutcome
): "real" | "guess" | "error" | "pending" {
  if (!outcome) return "pending";
  if (outcome === "real_correct") return "real";
  if (outcome === "guess_1" || outcome === "guess_2" || outcome === "guess_3") {
    return "guess";
  }
  return "error";
}

function getGridConfigStorageKey(examId: string): string {
  return `cadernin_xray_grid_${examId}`;
}

export function saveXrayGridConfig(
  examId: string,
  config: XrayGridConfig
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getGridConfigStorageKey(examId),
      JSON.stringify(config)
    );
  } catch {
    // noop
  }
}

export function loadOrInferXrayGridConfig(
  exam: MockExam,
  existingQuestions: MockQuestion[]
): XrayGridConfig {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(getGridConfigStorageKey(exam.id));
      if (raw) {
        const parsed = JSON.parse(raw) as XrayGridConfig;
        if (parsed?.slots && parsed.slots.length > 0) {
          // Garante que qualquer questão já salva no banco também exista nos slots
          const existingMap = new Map(
            parsed.slots.map((s) => [s.questionNumber, s])
          );
          for (const q of existingQuestions) {
            if (!existingMap.has(q.question_number)) {
              existingMap.set(q.question_number, {
                questionNumber: q.question_number,
                area: q.area,
              });
            }
          }
          return {
            slots: Array.from(existingMap.values()).sort(
              (a, b) => a.questionNumber - b.questionNumber
            ),
          };
        }
      }
    } catch {
      // fallback abaixo
    }
  }

  // Se não houver config salva neste navegador, infere com inteligência a partir das questões já gravadas
  if (existingQuestions.length > 0) {
    const nums = existingQuestions.map((q) => q.question_number);
    const minQ = Math.min(...nums);
    const maxQ = Math.max(...nums);
    const byNum = new Map(
      existingQuestions.map((q) => [q.question_number, q.area])
    );

    const endNum =
      maxQ <= 45 ? 45 : maxQ <= 90 ? 90 : maxQ <= 135 ? 135 : Math.max(180, maxQ);
    const startNum = minQ >= 91 ? 91 : 1;

    const slots: { questionNumber: number; area: EnemArea }[] = [];
    for (let n = startNum; n <= endNum; n++) {
      const fallbackArea: EnemArea =
        n <= 45
          ? "linguagens"
          : n <= 90
          ? "humanas"
          : n <= 135
          ? "natureza"
          : "matematica";
      slots.push({
        questionNumber: n,
        area: byNum.get(n) ?? fallbackArea,
      });
    }
    return { slots };
  }

  // Fallback padrão: 90 questões Dia 1
  return {
    slots: Array.from({ length: 90 }, (_, idx) => ({
      questionNumber: idx + 1,
      area: idx < 45 ? "linguagens" : "humanas",
    })),
  };
}

interface XrayExamWorkspaceProps {
  exam: MockExam;
  initialQuestions: MockQuestion[];
  initialGridConfig?: XrayGridConfig;
  subjects: Subject[];
  topics: Topic[];
  subtopics: Subtopic[];
  enemSkills: EnemSkill[];
  onBack: () => void;
  onExamUpdated: (updated: MockExam) => void;
  onQuestionsChanged: (examId: string, nextQuestions: MockQuestion[]) => void;
}

export function XrayExamWorkspace({
  exam,
  initialQuestions,
  initialGridConfig,
  subjects,
  topics,
  subtopics,
  enemSkills,
  onBack,
  onExamUpdated,
  onQuestionsChanged,
}: XrayExamWorkspaceProps) {
  const { profile } = useProfileTheme();
  const [gridConfig, setGridConfig] = useState<XrayGridConfig>(() => {
    const cfg =
      initialGridConfig ?? loadOrInferXrayGridConfig(exam, initialQuestions);
    saveXrayGridConfig(exam.id, cfg);
    return cfg;
  });

  const [questionsMap, setQuestionsMap] = useState<Record<number, MockQuestion>>(
    () => {
      const map: Record<number, MockQuestion> = {};
      for (const q of initialQuestions) {
        map[q.question_number] = q;
      }
      return map;
    }
  );

  const [areaFilter, setAreaFilter] = useState<"all" | EnemArea>("all");
  const [mobileGridOpen, setMobileGridOpen] = useState(true);
  const [activeNumber, setActiveNumber] = useState<number>(
    () => gridConfig.slots[0]?.questionNumber ?? 1
  );

  // Lembra a última matéria escolhida para acelerar o preenchimento das próximas questões
  const [lastUsedSubjectId, setLastUsedSubjectId] = useState<string | null>(
    null
  );
  const [showAllEnemAreas, setShowAllEnemAreas] = useState(false);

  // Estado local da pílula de erro para digitação fluida com autosave debounce
  const [noteDraft, setNoteDraft] = useState<string>("");
  const noteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modal de TRI, Redação e Configurações do Simulado
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(exam.title);
  const [dateDraft, setDateDraft] = useState(exam.date);
  const [taggingDraft, setTaggingDraft] = useState<MockTaggingMode>(
    exam.tagging_mode
  );
  const [metaDraft, setMetaDraft] = useState<TriAndEssayValues>({
    tri_lc: exam.tri_lc !== null ? String(exam.tri_lc) : "",
    tri_ch: exam.tri_ch !== null ? String(exam.tri_ch) : "",
    tri_cn: exam.tri_cn !== null ? String(exam.tri_cn) : "",
    tri_mt: exam.tri_mt !== null ? String(exam.tri_mt) : "",
    essay_c1: exam.essay_c1 !== null ? String(exam.essay_c1) : "",
    essay_c2: exam.essay_c2 !== null ? String(exam.essay_c2) : "",
    essay_c3: exam.essay_c3 !== null ? String(exam.essay_c3) : "",
    essay_c4: exam.essay_c4 !== null ? String(exam.essay_c4) : "",
    essay_c5: exam.essay_c5 !== null ? String(exam.essay_c5) : "",
    essay_total: exam.essay_total !== null ? String(exam.essay_total) : "",
    notes: exam.notes ?? "",
  });
  const [savingMeta, setSavingMeta] = useState(false);

  const slotsInView = useMemo(() => {
    if (areaFilter === "all") return gridConfig.slots;
    return gridConfig.slots.filter((slot) => slot.area === areaFilter);
  }, [gridConfig.slots, areaFilter]);

  const distinctAreas = useMemo(() => {
    const set = new Set<EnemArea>();
    for (const s of gridConfig.slots) set.add(s.area);
    return Array.from(set);
  }, [gridConfig.slots]);

  const activeSlot = useMemo(
    () =>
      gridConfig.slots.find((s) => s.questionNumber === activeNumber) ??
      gridConfig.slots[0],
    [gridConfig.slots, activeNumber]
  );

  const activeQuestion = activeSlot
    ? questionsMap[activeSlot.questionNumber]
    : undefined;

  const activeArea: EnemArea =
    activeQuestion?.area ?? activeSlot?.area ?? "linguagens";

  // Sincroniza o input da pílula de erro quando troca de questão
  useEffect(() => {
    if (noteTimeoutRef.current) {
      clearTimeout(noteTimeoutRef.current);
      noteTimeoutRef.current = null;
    }
    setNoteDraft(activeQuestion?.error_note ?? "");
    setShowAllEnemAreas(false);
  }, [activeNumber, activeQuestion?.id]);

  // Estatísticas ao vivo do simulado
  const stats = useMemo(() => {
    const all = Object.values(questionsMap);
    let real = 0;
    let guess = 0;
    let err = 0;
    for (const q of all) {
      const g = getOutcomeGroup(q.outcome);
      if (g === "real") real += 1;
      else if (g === "guess") guess += 1;
      else if (g === "error") err += 1;
    }
    return {
      answered: all.length,
      totalSlots: gridConfig.slots.length,
      rawCorrect: real + guess,
      realCorrect: real,
      guesses: guess,
      errors: err,
    };
  }, [questionsMap, gridConfig.slots.length]);

  // Persistência suave no Supabase + sincronização de acertos por área no mock_exam
  const persistQuestion = useCallback(
    async (
      questionNumber: number,
      patch: Partial<{
        area: EnemArea;
        subject_id: string | null;
        topic_id: string | null;
        subtopic_id: string | null;
        enem_skill_id: string | null;
        outcome: QuestionOutcome;
        error_note: string | null;
      }>
    ) => {
      const existing = questionsMap[questionNumber];
      const slot = gridConfig.slots.find(
        (s) => s.questionNumber === questionNumber
      );

      // Só grava no banco se já houver outcome (se o usuário escolheu assunto antes do outcome,
      // mantemos no rascunho ou exigimos outcome; aqui usamos 'real_correct' apenas se outcome foi passado)
      const finalOutcome = patch.outcome ?? existing?.outcome;
      if (!finalOutcome) {
        return;
      }

      const nextRecord: MockQuestion = {
        id: existing?.id ?? `temp-${questionNumber}`,
        mock_exam_id: exam.id,
        question_number: questionNumber,
        area: patch.area ?? existing?.area ?? slot?.area ?? "linguagens",
        subject_id:
          patch.subject_id !== undefined
            ? patch.subject_id
            : existing?.subject_id ?? null,
        topic_id:
          patch.topic_id !== undefined
            ? patch.topic_id
            : existing?.topic_id ?? null,
        subtopic_id:
          patch.subtopic_id !== undefined
            ? patch.subtopic_id
            : existing?.subtopic_id ?? null,
        enem_skill_id:
          patch.enem_skill_id !== undefined
            ? patch.enem_skill_id
            : existing?.enem_skill_id ?? null,
        outcome: finalOutcome,
        error_note:
          patch.error_note !== undefined
            ? patch.error_note
            : existing?.error_note ?? null,
      };

      // Atualização otimista imediata
      const optimisticMap = { ...questionsMap, [questionNumber]: nextRecord };
      setQuestionsMap(optimisticMap);
      setSaveState("saving");
      setSaveError(null);

      try {
        const saved = await upsertMockQuestion({
          mock_exam_id: exam.id,
          question_number: nextRecord.question_number,
          area: nextRecord.area,
          subject_id: nextRecord.subject_id,
          topic_id: nextRecord.topic_id,
          subtopic_id: nextRecord.subtopic_id,
          enem_skill_id: nextRecord.enem_skill_id,
          outcome: nextRecord.outcome,
          error_note: nextRecord.error_note,
        });

        const confirmedMap = { ...optimisticMap, [questionNumber]: saved };
        setQuestionsMap(confirmedMap);

        const allConfirmed = Object.values(confirmedMap);
        onQuestionsChanged(exam.id, allConfirmed);

        // Atualiza acertos brutos por área no registro principal do simulado
        const areaScores = computeAreaScoresFromQuestions(allConfirmed);
        const updatedExam = await updateMockExam(exam.id, areaScores);
        onExamUpdated(updatedExam);

        // Alimenta automaticamente o motor FSRS para o assunto vinculado (sem duplicar sessões)
        if (saved.topic_id) {
          void syncTopicFsrsState(
            saved.topic_id,
            profile.fsrs_target_retention
          );
        }
        if (existing?.topic_id && existing.topic_id !== saved.topic_id) {
          void syncTopicFsrsState(
            existing.topic_id,
            profile.fsrs_target_retention
          );
        }

        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        setSaveError(
          err instanceof Error ? err.message : "Falha ao salvar questão."
        );
      }
    },
    [
      exam.id,
      gridConfig.slots,
      onExamUpdated,
      onQuestionsChanged,
      profile.fsrs_target_retention,
      questionsMap,
    ]
  );

  const handleClearQuestion = async () => {
    if (!activeSlot || !activeQuestion) return;
    const num = activeSlot.questionNumber;
    const prevTopicId = activeQuestion.topic_id;
    const nextMap = { ...questionsMap };
    delete nextMap[num];
    setQuestionsMap(nextMap);
    setNoteDraft("");
    setSaveState("saving");

    try {
      await deleteMockQuestion(exam.id, num);
      const remaining = Object.values(nextMap);
      onQuestionsChanged(exam.id, remaining);
      const areaScores = computeAreaScoresFromQuestions(remaining);
      const updatedExam = await updateMockExam(exam.id, areaScores);
      onExamUpdated(updatedExam);
      if (prevTopicId) {
        void syncTopicFsrsState(prevTopicId, profile.fsrs_target_retention);
      }
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(
        err instanceof Error ? err.message : "Erro ao limpar questão."
      );
    }
  };

  // Navegação por índice dentro da lista visível
  const goRelative = useCallback(
    (delta: number) => {
      if (slotsInView.length === 0) return;
      const idx = slotsInView.findIndex(
        (s) => s.questionNumber === activeNumber
      );
      const safeIdx = idx === -1 ? 0 : idx;
      const nextIdx = Math.max(
        0,
        Math.min(slotsInView.length - 1, safeIdx + delta)
      );
      setActiveNumber(slotsInView[nextIdx].questionNumber);
    },
    [slotsInView, activeNumber]
  );

  // Atalhos de teclado: ← / → para navegar e 1..7 para marcar resultado com 1 toque
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (metaModalOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goRelative(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goRelative(1);
      } else if (e.key >= "1" && e.key <= "7" && activeSlot) {
        const spec = OUTCOME_BUTTONS[Number.parseInt(e.key, 10) - 1];
        if (spec) {
          e.preventDefault();
          void persistQuestion(activeSlot.questionNumber, {
            outcome: spec.outcome,
            subject_id:
              activeQuestion?.subject_id ?? lastUsedSubjectId ?? null,
          });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    metaModalOpen,
    goRelative,
    activeSlot,
    activeQuestion?.subject_id,
    lastUsedSubjectId,
    persistQuestion,
  ]);

  // Opções para Comboboxes de classificação
  const effectiveSubjectId =
    activeQuestion?.subject_id ?? lastUsedSubjectId ?? null;

  const subjectOptions: ComboboxOption[] = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.id,
        label: s.name,
        dotColor: s.color,
      })),
    [subjects]
  );

  const topicOptions: ComboboxOption[] = useMemo(() => {
    const subjNameById = new Map(subjects.map((s) => [s.id, s.name]));
    return topics
      .filter((t) => !effectiveSubjectId || t.subject_id === effectiveSubjectId)
      .map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: effectiveSubjectId
          ? undefined
          : subjNameById.get(t.subject_id),
      }));
  }, [topics, subjects, effectiveSubjectId]);

  const subtopicOptions: ComboboxOption[] = useMemo(
    () =>
      subtopics
        .filter((st) => st.topic_id === activeQuestion?.topic_id)
        .map((st) => ({
          value: st.id,
          label: st.name,
        })),
    [subtopics, activeQuestion?.topic_id]
  );

  const enemSkillOptions: ComboboxOption[] = useMemo(() => {
    const list = showAllEnemAreas
      ? enemSkills
      : enemSkills.filter((sk) => sk.area === activeArea);
    return list.map((sk) => ({
      value: sk.id,
      label: `${sk.code} · ${sk.competency}${
        showAllEnemAreas ? ` (${AREA_SHORT[sk.area]})` : ""
      }`,
      sublabel: sk.description,
    }));
  }, [enemSkills, activeArea, showAllEnemAreas]);

  const handleSelectOutcome = (outcome: QuestionOutcome) => {
    if (!activeSlot) return;
    void persistQuestion(activeSlot.questionNumber, {
      outcome,
      subject_id: activeQuestion?.subject_id ?? lastUsedSubjectId ?? null,
    });
  };

  const handleSelectSubject = (nextSubjId: string | null) => {
    setLastUsedSubjectId(nextSubjId);
    if (!activeSlot || !activeQuestion) return;
    void persistQuestion(activeSlot.questionNumber, {
      subject_id: nextSubjId,
      topic_id: null,
      subtopic_id: null,
    });
  };

  const handleSelectTopic = (nextTopicId: string | null) => {
    if (!activeSlot) return;
    const foundTopic = nextTopicId
      ? topics.find((t) => t.id === nextTopicId)
      : null;
    const nextSubjId = foundTopic?.subject_id ?? effectiveSubjectId;
    if (nextSubjId) setLastUsedSubjectId(nextSubjId);

    if (!activeQuestion) return;
    void persistQuestion(activeSlot.questionNumber, {
      subject_id: nextSubjId ?? null,
      topic_id: nextTopicId,
      subtopic_id: null,
    });
  };

  const handleSelectSubtopic = (nextSubId: string | null) => {
    if (!activeSlot || !activeQuestion) return;
    void persistQuestion(activeSlot.questionNumber, {
      subtopic_id: nextSubId,
    });
  };

  const handleSelectEnemSkill = (nextSkillId: string | null) => {
    if (!activeSlot || !activeQuestion) return;
    void persistQuestion(activeSlot.questionNumber, {
      enem_skill_id: nextSkillId,
    });
  };

  const handleAreaChangeForQuestion = (nextArea: EnemArea) => {
    if (!activeSlot) return;
    const updatedSlots = gridConfig.slots.map((s) =>
      s.questionNumber === activeSlot.questionNumber
        ? { ...s, area: nextArea }
        : s
    );
    const nextConfig = { slots: updatedSlots };
    setGridConfig(nextConfig);
    saveXrayGridConfig(exam.id, nextConfig);

    if (activeQuestion) {
      void persistQuestion(activeSlot.questionNumber, { area: nextArea });
    }
  };

  const handleNoteChange = (val: string) => {
    setNoteDraft(val);
    if (!activeSlot || !activeQuestion) return;

    if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
    const num = activeSlot.questionNumber;
    noteTimeoutRef.current = setTimeout(() => {
      void persistQuestion(num, { error_note: val.trim() || null });
    }, 550);
  };

  const handleAddMoreQuestions = () => {
    const last = gridConfig.slots[gridConfig.slots.length - 1];
    const startNum = (last?.questionNumber ?? 0) + 1;
    const defaultArea: EnemArea = last?.area ?? "matematica";
    const extras = Array.from({ length: 10 }, (_, idx) => ({
      questionNumber: startNum + idx,
      area: defaultArea,
    }));
    const nextConfig = { slots: [...gridConfig.slots, ...extras] };
    setGridConfig(nextConfig);
    saveXrayGridConfig(exam.id, nextConfig);
  };

  const handleSaveMetaModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeta(true);
    try {
      const updated = await updateMockExam(exam.id, {
        title: titleDraft.trim() || exam.title,
        date: dateDraft,
        tagging_mode: taggingDraft,
        tri_lc: parseNullableFloat(metaDraft.tri_lc),
        tri_ch: parseNullableFloat(metaDraft.tri_ch),
        tri_cn: parseNullableFloat(metaDraft.tri_cn),
        tri_mt: parseNullableFloat(metaDraft.tri_mt),
        essay_c1: parseNullableInt(metaDraft.essay_c1),
        essay_c2: parseNullableInt(metaDraft.essay_c2),
        essay_c3: parseNullableInt(metaDraft.essay_c3),
        essay_c4: parseNullableInt(metaDraft.essay_c4),
        essay_c5: parseNullableInt(metaDraft.essay_c5),
        essay_total: parseNullableInt(metaDraft.essay_total),
        notes: metaDraft.notes.trim() || null,
      });
      onExamUpdated(updated);
      setMetaModalOpen(false);
    } finally {
      setSavingMeta(false);
    }
  };

  const showTopicFields =
    exam.tagging_mode === "topic" || exam.tagging_mode === "both";
  const showSkillField =
    exam.tagging_mode === "enem_skill" || exam.tagging_mode === "both";

  const activeIdx = slotsInView.findIndex(
    (s) => s.questionNumber === activeNumber
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho do Raio-X */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer self-start"
        >
          <ArrowLeft size={16} weight="light" />
          <span>Voltar para Simulados</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Autosave */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-hairline)] font-mono-tabular text-[11px] text-[var(--text-secondary)]">
            {saveState === "saving" ? (
              <>
                <SpinnerGap size={13} weight="light" className="animate-spin" />
                <span>Salvando...</span>
              </>
            ) : saveState === "error" ? (
              <>
                <WarningCircle
                  size={13}
                  weight="duotone"
                  className="text-[var(--accent-terracotta)]"
                />
                <span className="text-[var(--accent-terracotta)]">
                  Erro ao salvar
                </span>
              </>
            ) : (
              <>
                <CloudCheck
                  size={13}
                  weight="duotone"
                  className="text-[var(--accent-sage)]"
                />
                <span>Autosave ativo</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => setMetaModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] text-[12.5px] font-medium text-[var(--text-primary)] cursor-pointer"
          >
            <SlidersHorizontal size={14} weight="light" />
            <span>TRI, Redação e Config.</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="px-4 py-2.5 rounded-xl bg-[var(--accent-terracotta-soft)] text-[var(--accent-terracotta)] text-[12.5px]">
          {saveError}
        </div>
      )}

      {/* Barra Resumo do Simulado */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-4 sm:p-5 border border-[var(--border-hairline)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-editorial text-[24px] sm:text-[28px] leading-tight text-[var(--text-primary)] truncate">
            {exam.title}
          </h1>
          <p className="font-mono-tabular text-[12px] text-[var(--text-secondary)] mt-0.5">
            {exam.date.split("-").reverse().join("/")} ·{" "}
            {stats.answered}/{stats.totalSlots} respondidas
            {exam.essay_total !== null && ` · Redação ${exam.essay_total}`}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3 shrink-0">
          <div className="px-3 py-2 rounded-xl bg-[var(--bg-subtle)] text-center">
            <span className="block text-[10px] uppercase text-[var(--text-muted)]">
              Bruto
            </span>
            <span className="font-mono-tabular text-[16px] font-medium text-[var(--text-primary)]">
              {stats.rawCorrect}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[var(--accent-sage-soft)] text-center">
            <span className="block text-[10px] uppercase text-[var(--accent-sage)]">
              Real
            </span>
            <span className="font-mono-tabular text-[16px] font-semibold text-[var(--accent-sage)]">
              {stats.realCorrect}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[var(--accent-ochre-soft)] text-center">
            <span className="block text-[10px] uppercase text-[var(--accent-ochre)]">
              Chutes
            </span>
            <span className="font-mono-tabular text-[16px] font-semibold text-[var(--accent-ochre)]">
              {stats.guesses}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[var(--accent-terracotta-soft)] text-center">
            <span className="block text-[10px] uppercase text-[var(--accent-terracotta)]">
              Erros
            </span>
            <span className="font-mono-tabular text-[16px] font-semibold text-[var(--accent-terracotta)]">
              {stats.errors}
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          GRADE RÁPIDA (ESQUERDA) + PAINEL ÁGIL DA QUESTÃO ATIVA (DIREITA)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ESQUERDA: Cartão-Resposta compacto */}
        <section className="lg:col-span-5 bg-[var(--bg-card)] rounded-2xl p-4 sm:p-5 border border-[var(--border-hairline)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-editorial text-[19px] text-[var(--text-primary)]">
                Cartão-Resposta
              </h2>
              <button
                type="button"
                onClick={() => setMobileGridOpen((prev) => !prev)}
                className="lg:hidden px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] cursor-pointer"
              >
                {mobileGridOpen ? "Recolher" : "Mostrar grade"}
              </button>
            </div>

            {distinctAreas.length > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAreaFilter("all")}
                  className={`px-2 py-0.5 rounded-md font-mono-tabular text-[11px] cursor-pointer ${
                    areaFilter === "all"
                      ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  Todas
                </button>
                {distinctAreas.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      setAreaFilter(area);
                      const first = gridConfig.slots.find(
                        (s) => s.area === area
                      );
                      if (first) setActiveNumber(first.questionNumber);
                    }}
                    className={`px-2 py-0.5 rounded-md font-mono-tabular text-[11px] cursor-pointer ${
                      areaFilter === area
                        ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {AREA_SHORT[area]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legenda discreta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent-sage)]" />
              Real
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent-ochre)]" />
              Chute
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent-terracotta)]" />
              Erro
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--bg-subtle)] border border-[var(--border-hairline)]" />
              Pendente
            </span>
          </div>

          {/* Grade numérica compacta */}
          <div
            className={`${
              mobileGridOpen ? "grid" : "hidden lg:grid"
            } grid-cols-5 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-7 gap-1.5 max-h-[240px] lg:max-h-[460px] overflow-y-auto pr-1`}
          >
            {slotsInView.map((slot) => {
              const q = questionsMap[slot.questionNumber];
              const group = getOutcomeGroup(q?.outcome);
              const isActive = slot.questionNumber === activeNumber;
              const hasTag = Boolean(q?.topic_id || q?.enem_skill_id);

              let cellColors =
                "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]";
              if (group === "real") {
                cellColors =
                  "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)]/40 text-[var(--accent-sage)] font-medium";
              } else if (group === "guess") {
                cellColors =
                  "bg-[var(--accent-ochre-soft)] border-[var(--accent-ochre)]/45 text-[var(--accent-ochre)] font-medium";
              } else if (group === "error") {
                cellColors =
                  "bg-[var(--accent-terracotta-soft)] border-[var(--accent-terracotta)]/45 text-[var(--accent-terracotta)] font-medium";
              }

              return (
                <button
                  key={slot.questionNumber}
                  type="button"
                  onClick={() => setActiveNumber(slot.questionNumber)}
                  className={`relative h-10 sm:h-9 rounded-lg border font-mono-tabular text-[12px] flex items-center justify-center transition-all cursor-pointer ${cellColors} ${
                    isActive
                      ? "ring-2 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-card)] scale-[1.03]"
                      : ""
                  }`}
                >
                  {String(slot.questionNumber).padStart(2, "0")}
                  {hasTag && (
                    <span
                      title="Classificada"
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-current opacity-70"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddMoreQuestions}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/50 hover:bg-[var(--bg-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Plus size={13} weight="light" />
            <span>Adicionar +10 questões ao cartão</span>
          </button>
        </section>

        {/* DIREITA: Painel Ágil da Questão Ativa */}
        <section className="lg:col-span-7 bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-5">
          {/* Topo do Painel: Número, Área e Navegação ← → */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-editorial text-[26px] leading-none text-[var(--text-primary)]">
                Questão{" "}
                <span className="font-mono-tabular text-[24px]">
                  {String(activeNumber).padStart(2, "0")}
                </span>
              </h2>

              <select
                value={activeArea}
                onChange={(e) =>
                  handleAreaChangeForQuestion(e.target.value as EnemArea)
                }
                aria-label="Área da questão"
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] font-mono-tabular text-[11.5px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-slate)] cursor-pointer"
              >
                {(
                  ["linguagens", "humanas", "natureza", "matematica"] as const
                ).map((a) => (
                  <option key={a} value={a}>
                    {AREA_SHORT[a]} · {AREA_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeIdx <= 0}
                onClick={() => goRelative(-1)}
                title="Questão anterior (seta ←)"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[12.5px] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
              >
                <ArrowLeft size={14} weight="light" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <button
                type="button"
                disabled={activeIdx === -1 || activeIdx >= slotsInView.length - 1}
                onClick={() => goRelative(1)}
                title="Próxima questão (seta →)"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[12.5px] text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ArrowRight size={14} weight="light" />
              </button>
            </div>
          </div>

          {/* 7 Botões de 1 clique para Resultado */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                Resultado da questão (1 clique ou teclas 1–7)
              </span>
              {activeQuestion && (
                <button
                  type="button"
                  onClick={() => void handleClearQuestion()}
                  className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] cursor-pointer"
                >
                  <Eraser size={13} weight="light" />
                  <span>Limpar</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OUTCOME_BUTTONS.map((btn) => {
                const selected = activeQuestion?.outcome === btn.outcome;

                let activeClass =
                  "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)] text-[var(--accent-sage)]";
                let Icon = CheckCircle;
                if (btn.group === "guess") {
                  activeClass =
                    "bg-[var(--accent-ochre-soft)] border-[var(--accent-ochre)] text-[var(--accent-ochre)]";
                  Icon = Question;
                } else if (btn.group === "error") {
                  activeClass =
                    "bg-[var(--accent-terracotta-soft)] border-[var(--accent-terracotta)] text-[var(--accent-terracotta)]";
                  Icon = XCircle;
                }

                return (
                  <button
                    key={btn.outcome}
                    type="button"
                    onClick={() => handleSelectOutcome(btn.outcome)}
                    className={`p-3 rounded-xl border text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                      btn.outcome === "real_correct" ? "sm:col-span-2" : ""
                    } ${
                      selected
                        ? activeClass
                        : "bg-[var(--bg-subtle)]/65 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon
                        size={18}
                        weight={selected ? "duotone" : "light"}
                        className="shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-tight">
                          {btn.label}
                        </p>
                        <p className="text-[11px] opacity-75 mt-0.5 leading-snug">
                          {btn.hint}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono-tabular text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--bg-card)]/70 border border-[var(--border-hairline)]/60 text-[var(--text-muted)] shrink-0">
                      {btn.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Classificação rápida (Matéria/Assunto e/ou Habilidade ENEM) */}
          <div
            className={`space-y-3.5 pt-2 border-t border-[var(--border-hairline)] ${
              !activeQuestion ? "opacity-55 pointer-events-none" : ""
            }`}
          >
            {!activeQuestion && (
              <p className="text-[12px] text-[var(--text-muted)]">
                Marque primeiro o resultado acima (1 a 7) para vincular assunto,
                habilidade ENEM ou anotação.
              </p>
            )}

            {showTopicFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SearchableCombobox
                  label="Matéria (lembra a última usada)"
                  options={subjectOptions}
                  value={effectiveSubjectId}
                  onChange={handleSelectSubject}
                  placeholder="Escolha a matéria"
                  searchPlaceholder="Digite o nome da matéria..."
                  emptyText="Cadastre matérias no Cronograma."
                />

                <SearchableCombobox
                  label="Assunto"
                  options={topicOptions}
                  value={activeQuestion?.topic_id ?? null}
                  onChange={handleSelectTopic}
                  placeholder="Escolha o assunto"
                  searchPlaceholder="Digite o nome do assunto..."
                  emptyText="Nenhum assunto encontrado."
                />

                {subtopicOptions.length > 0 && (
                  <div className="sm:col-span-2">
                    <SearchableCombobox
                      label="Subtópico (opcional)"
                      options={subtopicOptions}
                      value={activeQuestion?.subtopic_id ?? null}
                      onChange={handleSelectSubtopic}
                      placeholder="Escolha o subtópico (opcional)"
                      searchPlaceholder="Buscar subtópico..."
                    />
                  </div>
                )}
              </div>
            )}

            {showSkillField && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Habilidade ENEM ({AREA_LABEL[activeArea]})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllEnemAreas((prev) => !prev)}
                    className="text-[11px] text-[var(--accent-slate)] hover:underline cursor-pointer"
                  >
                    {showAllEnemAreas
                      ? `Filtrar só ${AREA_SHORT[activeArea]}`
                      : "Mostrar todas as áreas"}
                  </button>
                </div>

                <SearchableCombobox
                  options={enemSkillOptions}
                  value={activeQuestion?.enem_skill_id ?? null}
                  onChange={handleSelectEnemSkill}
                  placeholder="Buscar H1–H30 ou palavra-chave..."
                  searchPlaceholder="Digite H12, C3 ou parte da descrição..."
                  emptyText="Carregue a Matriz ENEM em Configurações."
                />
              </div>
            )}

            {/* Pílula de erro (1 linha) */}
            <label className="block space-y-1.5">
              <span className="block text-[12px] font-medium text-[var(--text-secondary)]">
                Pílula de erro: o que faltou pra acertar? (opcional)
              </span>
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => handleNoteChange(e.target.value)}
                onBlur={() => {
                  if (!activeSlot || !activeQuestion) return;
                  if (noteTimeoutRef.current) {
                    clearTimeout(noteTimeoutRef.current);
                    noteTimeoutRef.current = null;
                  }
                  const trimmed = noteDraft.trim() || null;
                  if (trimmed !== (activeQuestion.error_note ?? null)) {
                    void persistQuestion(activeSlot.questionNumber, {
                      error_note: trimmed,
                    });
                  }
                }}
                placeholder="Ex: Esqueci de converter cm³ para litros antes de aplicar a fórmula"
                maxLength={220}
                className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13.5px] text-[var(--text-primary)]"
              />
            </label>
          </div>

          <p className="text-[11.5px] text-[var(--text-muted)] pt-1">
            Dica de agilidade: use as setas{" "}
            <kbd className="font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              ←
            </kbd>{" "}
            e{" "}
            <kbd className="font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              →
            </kbd>{" "}
            para avançar entre questões e{" "}
            <kbd className="font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              1
            </kbd>
            –
            <kbd className="font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              7
            </kbd>{" "}
            para marcar o resultado.
          </p>
        </section>
      </div>

      {/* Modal TRI, Redação e Modo de Classificação */}
      {metaModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setMetaModalOpen(false)}
          />

          <div
            className="relative z-10 w-full max-w-[680px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-5"
            style={{ boxShadow: "var(--shadow-tactile)" }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
              <h2 className="font-editorial text-[24px] text-[var(--text-primary)]">
                TRI, Redação e Dados da Prova
              </h2>
              <button
                type="button"
                onClick={() => setMetaModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X size={18} weight="light" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveMetaModal(e)}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <label className="sm:col-span-8 block space-y-1.5">
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Nome da prova
                  </span>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[14px]"
                  />
                </label>
                <label className="sm:col-span-4 block space-y-1.5">
                  <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Data
                  </span>
                  <input
                    type="date"
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] font-mono-tabular text-[13.5px]"
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-[var(--text-secondary)] block">
                  Modo de classificação das questões
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "topic", label: "Matéria / Assunto" },
                      { id: "enem_skill", label: "Habilidade ENEM" },
                      { id: "both", label: "Ambos" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTaggingDraft(opt.id)}
                      className={`py-2 px-3 rounded-lg border text-[12.5px] cursor-pointer ${
                        taggingDraft === opt.id
                          ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)] text-[var(--accent-sage)] font-medium"
                          : "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <ExamMetaFormFields values={metaDraft} onChange={setMetaDraft} />

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setMetaModalOpen(false)}
                  className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMeta}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-60"
                >
                  <Check size={15} weight="light" />
                  <span>{savingMeta ? "Salvando..." : "Salvar dados"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
