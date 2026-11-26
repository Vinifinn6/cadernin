import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";
import type {
  ExerciseLog,
  FsrsReviewSource,
  MockExam,
  MockQuestion,
  Topic,
} from "@/types/database";

const MS_PER_DAY = 86_400_000;

export const DEFAULT_FSRS_TARGET_RETENTION = 0.86;
export const DEFAULT_AUTO_MODE_URGENCY_WEIGHT = 0.65;

export interface FsrsCalibrationPreset {
  id: "base" | "consolidacao" | "reta_final";
  label: string;
  targetRetention: number;
  urgencyWeight: number;
  description: string;
}

export const FSRS_CALIBRATION_PRESETS: FsrsCalibrationPreset[] = [
  {
    id: "base",
    label: "Fase Base",
    targetRetention: 0.85,
    urgencyWeight: 0.7,
    description:
      "85% de retenção · 70% lacunas / 30% revisões. Ideal enquanto você ainda avança na teoria.",
  },
  {
    id: "consolidacao",
    label: "Consolidação",
    targetRetention: 0.88,
    urgencyWeight: 0.55,
    description:
      "88% de retenção · 55% lacunas / 45% revisões. Equilíbrio entre corrigir pontos fracos e manter a memória firme.",
  },
  {
    id: "reta_final",
    label: "Reta Final",
    targetRetention: 0.91,
    urgencyWeight: 0.3,
    description:
      "91% de retenção · 30% lacunas / 70% revisões. Foco máximo em não esquecer o que você já construiu.",
  },
];

export interface TopicFsrsFields {
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_reps: number;
  fsrs_lapses: number;
  fsrs_state: number;
  fsrs_due: string | null;
  fsrs_last_review: string | null;
}

export interface GeneratedFsrsReviewLog {
  topic_id: string;
  reviewed_at: string;
  rating: 1 | 2 | 3 | 4;
  source: FsrsReviewSource;
  real_accuracy: number | null;
  stability_after: number;
  difficulty_after: number;
}

export interface TopicMemorySnapshot {
  retrievability: number | null; // 0..1 ou null se nunca praticado
  retrievabilityPct: number | null; // 0..100 arredondado
  stabilityDays: number;
  difficulty: number;
  dueIso: string | null;
  lastReviewIso: string | null;
  daysUntilDue: number | null; // < 0 atrasado, 0 vence hoje, > 0 futuro
  isDueForReview: boolean;
  dueStatusLabel: string;
}

export function clampTargetRetention(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FSRS_TARGET_RETENTION;
  return Math.min(0.95, Math.max(0.8, Math.round(value * 100) / 100));
}

export function clampUrgencyWeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUTO_MODE_URGENCY_WEIGHT;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

/**
 * Converte data YYYY-MM-DD ou ISO timestamp em Date seguro (meio-dia UTC para datas puras,
 * evitando regressão de dia por timezone negativo).
 */
export function parseSafeDate(
  input: string | Date | null | undefined,
  fallback: Date = new Date()
): Date {
  if (!input) return fallback;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? fallback : input;
  }

  const trimmed = input.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return new Date(
      Date.UTC(
        Number.parseInt(dateOnly[1], 10),
        Number.parseInt(dateOnly[2], 10) - 1,
        Number.parseInt(dateOnly[3], 10),
        12,
        0,
        0
      )
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toUtcDayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      MS_PER_DAY
  );
}

function toLocalDayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
  );
}

/**
 * Converte a taxa de acerto real (0..1, excluindo chutes) para o Rating oficial do ts-fsrs:
 * - < 0.50 -> Rating.Again (1)
 * - >= 0.50 e < 0.70 -> Rating.Hard (2)
 * - >= 0.70 e < 0.90 -> Rating.Good (3)
 * - >= 0.90 -> Rating.Easy (4)
 */
export function accuracyToFsrsGrade(realAccuracy: number): Grade {
  const safe = Number.isFinite(realAccuracy)
    ? Math.min(1, Math.max(0, realAccuracy))
    : 0;

  if (safe < 0.5) return Rating.Again;
  if (safe < 0.7) return Rating.Hard;
  if (safe < 0.9) return Rating.Good;
  return Rating.Easy;
}

function createScheduler(targetRetention: number) {
  return fsrs({
    request_retention: clampTargetRetention(targetRetention),
    enable_short_term: false,
    enable_fuzz: false,
  });
}

function normalizeState(raw?: number): State {
  if (
    raw === State.New ||
    raw === State.Learning ||
    raw === State.Review ||
    raw === State.Relearning
  ) {
    return raw;
  }
  return State.New;
}

export function topicToFsrsCard(
  topic: Pick<
    Topic,
    | "fsrs_stability"
    | "fsrs_difficulty"
    | "fsrs_scheduled_days"
    | "fsrs_reps"
    | "fsrs_lapses"
    | "fsrs_state"
    | "fsrs_due"
    | "fsrs_last_review"
  >,
  fallbackNow: Date = new Date()
): Card {
  const stability = Number(topic.fsrs_stability ?? 0);
  if (!topic.fsrs_last_review || !Number.isFinite(stability) || stability <= 0) {
    return createEmptyCard(fallbackNow);
  }

  const lastReview = parseSafeDate(topic.fsrs_last_review, fallbackNow);
  const due = parseSafeDate(topic.fsrs_due, fallbackNow);

  return {
    due,
    stability,
    difficulty: Number(topic.fsrs_difficulty ?? 0),
    scheduled_days: Math.max(0, Math.round(Number(topic.fsrs_scheduled_days ?? 0))),
    learning_steps: 0,
    reps: Math.max(0, Math.round(Number(topic.fsrs_reps ?? 0))),
    lapses: Math.max(0, Math.round(Number(topic.fsrs_lapses ?? 0))),
    state: normalizeState(topic.fsrs_state),
    last_review: lastReview,
  };
}

export function emptyTopicFsrsFields(): TopicFsrsFields {
  return {
    fsrs_stability: 0,
    fsrs_difficulty: 0,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_reps: 0,
    fsrs_lapses: 0,
    fsrs_state: State.New,
    fsrs_due: null,
    fsrs_last_review: null,
  };
}

/**
 * Aplica uma sessão de prática ativa (exercício ou simulado) sobre o estado FSRS de um assunto.
 * Função pura e determinística.
 */
export function scheduleTopicReview(params: {
  current: Pick<
    Topic,
    | "id"
    | "fsrs_stability"
    | "fsrs_difficulty"
    | "fsrs_scheduled_days"
    | "fsrs_reps"
    | "fsrs_lapses"
    | "fsrs_state"
    | "fsrs_due"
    | "fsrs_last_review"
  >;
  realAccuracy: number;
  reviewDate: string | Date;
  source: FsrsReviewSource;
  targetRetention?: number;
}): { fields: TopicFsrsFields; log: GeneratedFsrsReviewLog } {
  const retention = clampTargetRetention(
    params.targetRetention ?? DEFAULT_FSRS_TARGET_RETENTION
  );
  const rawDate = parseSafeDate(params.reviewDate);
  const card = topicToFsrsCard(params.current, rawDate);

  // Evita dias negativos se dois eventos caírem no mesmo dia ou fora de ordem
  const safeReviewDate =
    card.last_review && rawDate.getTime() < card.last_review.getTime()
      ? new Date(card.last_review.getTime())
      : rawDate;

  const elapsedDays = card.last_review
    ? Math.max(
        0,
        Math.floor(
          (safeReviewDate.getTime() - card.last_review.getTime()) / MS_PER_DAY
        )
      )
    : 0;

  const safeAccuracy = Number.isFinite(params.realAccuracy)
    ? Math.min(1, Math.max(0, params.realAccuracy))
    : 0;
  const grade = accuracyToFsrsGrade(safeAccuracy);

  const scheduler = createScheduler(retention);
  const result = scheduler.next(card, safeReviewDate, grade);
  const nextCard = result.card;

  const stability = Number.isFinite(nextCard.stability)
    ? Math.max(0, Math.round(nextCard.stability * 10000) / 10000)
    : 0;
  const difficulty = Number.isFinite(nextCard.difficulty)
    ? Math.max(0, Math.round(nextCard.difficulty * 10000) / 10000)
    : 0;
  const scheduledDays = Math.max(
    0,
    Math.round(Number.isFinite(nextCard.scheduled_days) ? nextCard.scheduled_days : 0)
  );

  const dueDate =
    nextCard.due instanceof Date && !Number.isNaN(nextCard.due.getTime())
      ? nextCard.due
      : new Date(safeReviewDate.getTime() + Math.max(1, scheduledDays) * MS_PER_DAY);

  const fields: TopicFsrsFields = {
    fsrs_stability: stability,
    fsrs_difficulty: difficulty,
    fsrs_elapsed_days: elapsedDays,
    fsrs_scheduled_days: scheduledDays,
    fsrs_reps: Math.max(0, Math.round(nextCard.reps)),
    fsrs_lapses: Math.max(0, Math.round(nextCard.lapses)),
    fsrs_state: nextCard.state,
    fsrs_due: dueDate.toISOString(),
    fsrs_last_review: safeReviewDate.toISOString(),
  };

  const log: GeneratedFsrsReviewLog = {
    topic_id: params.current.id,
    reviewed_at: safeReviewDate.toISOString(),
    rating: grade as 1 | 2 | 3 | 4,
    source: params.source,
    real_accuracy: Math.round(safeAccuracy * 10000) / 10000,
    stability_after: stability,
    difficulty_after: difficulty,
  };

  return { fields, log };
}

/**
 * Calcula a probabilidade de retenção estimada hoje R ∈ [0, 1].
 * Retorna `null` se o assunto ainda nunca foi praticado com questões.
 */
export function calculateTopicRetrievability(
  topic: Pick<
    Topic,
    | "fsrs_stability"
    | "fsrs_difficulty"
    | "fsrs_scheduled_days"
    | "fsrs_reps"
    | "fsrs_lapses"
    | "fsrs_state"
    | "fsrs_due"
    | "fsrs_last_review"
  >,
  referenceDate: Date = new Date(),
  targetRetention: number = DEFAULT_FSRS_TARGET_RETENTION
): number | null {
  const stability = Number(topic.fsrs_stability ?? 0);
  if (!topic.fsrs_last_review || !Number.isFinite(stability) || stability <= 0) {
    return null;
  }

  const lastReview = parseSafeDate(topic.fsrs_last_review, referenceDate);
  const elapsedDays = Math.max(
    0,
    (referenceDate.getTime() - lastReview.getTime()) / MS_PER_DAY
  );

  // Tenta usar a curva oficial do scheduler ts-fsrs
  try {
    const scheduler = createScheduler(targetRetention);
    const card = topicToFsrsCard(topic, referenceDate);
    const r = scheduler.retrievability(card, referenceDate);
    if (typeof r === "number" && Number.isFinite(r)) {
      return Math.min(1, Math.max(0, r));
    }
  } catch {
    // fallback analítico abaixo
  }

  // Fallback analítico DSR: R(t, S) = (1 + t / (9 * S)) ^ -1
  const fallbackR = Math.pow(1 + elapsedDays / (9 * stability), -1);
  return Number.isFinite(fallbackR)
    ? Math.min(1, Math.max(0, fallbackR))
    : null;
}

export function getTopicMemorySnapshot(
  topic: Pick<
    Topic,
    | "fsrs_stability"
    | "fsrs_difficulty"
    | "fsrs_scheduled_days"
    | "fsrs_reps"
    | "fsrs_lapses"
    | "fsrs_state"
    | "fsrs_due"
    | "fsrs_last_review"
  >,
  targetRetention: number = DEFAULT_FSRS_TARGET_RETENTION,
  referenceDate: Date = new Date()
): TopicMemorySnapshot {
  const safeTarget = clampTargetRetention(targetRetention);
  const retrievability = calculateTopicRetrievability(
    topic,
    referenceDate,
    safeTarget
  );

  if (retrievability === null) {
    return {
      retrievability: null,
      retrievabilityPct: null,
      stabilityDays: 0,
      difficulty: 0,
      dueIso: null,
      lastReviewIso: null,
      daysUntilDue: null,
      isDueForReview: false,
      dueStatusLabel: "Sem prática registrada",
    };
  }

  const stabilityDays = Math.max(0, Math.round(Number(topic.fsrs_stability ?? 0)));
  const difficulty = Number(topic.fsrs_difficulty ?? 0);
  const dueDate = topic.fsrs_due
    ? parseSafeDate(topic.fsrs_due, referenceDate)
    : null;

  const daysUntilDue = dueDate
    ? toUtcDayIndex(dueDate) - toLocalDayIndex(referenceDate)
    : null;

  const isDueForReview =
    retrievability < safeTarget ||
    (daysUntilDue !== null && daysUntilDue <= 0);

  let dueStatusLabel = "Em dia";
  if (daysUntilDue !== null) {
    if (daysUntilDue < 0) {
      dueStatusLabel = `Atrasado há ${Math.abs(daysUntilDue)}d`;
    } else if (daysUntilDue === 0) {
      dueStatusLabel = "Vence hoje";
    } else if (daysUntilDue === 1) {
      dueStatusLabel = "Em 1 dia";
    } else {
      dueStatusLabel = `Em ${daysUntilDue} dias`;
    }
  } else if (retrievability < safeTarget) {
    dueStatusLabel = "Revisão recomendada";
  }

  return {
    retrievability,
    retrievabilityPct: Math.round(retrievability * 100),
    stabilityDays,
    difficulty,
    dueIso: topic.fsrs_due ?? null,
    lastReviewIso: topic.fsrs_last_review ?? null,
    daysUntilDue,
    isDueForReview,
    dueStatusLabel,
  };
}

/**
 * Score Unificado (Modo Automático):
 * autoScore = w * U + (1 - w) * ((1 - R) * 100)
 * Para assuntos sem histórico de revisão (R === null), usa apenas U.
 */
export function computeAutoModeScore(
  urgencyScore: number,
  retrievability: number | null,
  urgencyWeight: number = DEFAULT_AUTO_MODE_URGENCY_WEIGHT
): number {
  const safeU = Number.isFinite(urgencyScore)
    ? Math.min(100, Math.max(0, urgencyScore))
    : 0;
  if (retrievability === null || !Number.isFinite(retrievability)) {
    return Math.round(safeU);
  }
  const w = clampUrgencyWeight(urgencyWeight);
  const forgettingRisk = (1 - Math.min(1, Math.max(0, retrievability))) * 100;
  return Math.min(
    100,
    Math.max(0, Math.round(w * safeU + (1 - w) * forgettingRisk))
  );
}

interface PracticeSessionEvent {
  topicId: string;
  dateStr: string;
  sortTieBreaker: string;
  realAccuracy: number;
  source: FsrsReviewSource;
}

/**
 * Reconstrói cronologicamente o estado de memória FSRS de todos os assuntos
 * (ou de um conjunto filtrado) a partir de `exercise_logs` e `mock_questions`.
 * Protegido contra `total_questions === 0` e questões sem `topic_id`.
 */
export function recalculateFsrsFromHistory(params: {
  topicIds: string[];
  exerciseLogs: ExerciseLog[];
  mockExams: MockExam[];
  mockQuestions: MockQuestion[];
  targetRetention?: number;
}): {
  fieldsByTopicId: Record<string, TopicFsrsFields>;
  logs: GeneratedFsrsReviewLog[];
} {
  const retention = clampTargetRetention(
    params.targetRetention ?? DEFAULT_FSRS_TARGET_RETENTION
  );
  const topicIdSet = new Set(params.topicIds);
  const examDateById = new Map(params.mockExams.map((e) => [e.id, e.date]));

  const events: PracticeSessionEvent[] = [];

  // 1. Eventos vindos de listas de exercícios
  for (const log of params.exerciseLogs) {
    if (!log.topic_id || !topicIdSet.has(log.topic_id)) continue;
    const total = Number(log.total_questions ?? 0);
    if (!Number.isFinite(total) || total <= 0) continue;

    const rawCorrect = Math.min(total, Math.max(0, Number(log.raw_correct ?? 0)));
    const guesses = Math.min(rawCorrect, Math.max(0, Number(log.guesses_count ?? 0)));
    const realCorrect = Math.max(0, rawCorrect - guesses);

    events.push({
      topicId: log.topic_id,
      dateStr: log.date,
      sortTieBreaker: log.created_at ?? `ex-${log.id}`,
      realAccuracy: realCorrect / total,
      source: "exercise",
    });
  }

  // 2. Eventos vindos de simulados Raio-X (agrupados por simulado + assunto)
  const mockGroups = new Map<
    string,
    { examId: string; topicId: string; dateStr: string; total: number; real: number }
  >();

  for (const q of params.mockQuestions) {
    if (!q.topic_id || !topicIdSet.has(q.topic_id)) continue;
    const examDate = examDateById.get(q.mock_exam_id);
    if (!examDate) continue;

    const key = `${q.mock_exam_id}::${q.topic_id}`;
    let group = mockGroups.get(key);
    if (!group) {
      group = {
        examId: q.mock_exam_id,
        topicId: q.topic_id,
        dateStr: examDate,
        total: 0,
        real: 0,
      };
      mockGroups.set(key, group);
    }
    group.total += 1;
    // Chutes (guess_1, guess_2, guess_3) NÃO contam como acerto real
    if (q.outcome === "real_correct") {
      group.real += 1;
    }
  }

  for (const group of mockGroups.values()) {
    if (group.total <= 0) continue;
    events.push({
      topicId: group.topicId,
      dateStr: group.dateStr,
      sortTieBreaker: `mock-${group.examId}`,
      realAccuracy: group.real / group.total,
      source: "mock",
    });
  }

  // Ordenação cronológica estrita
  events.sort(
    (a, b) =>
      a.dateStr.localeCompare(b.dateStr) ||
      a.sortTieBreaker.localeCompare(b.sortTieBreaker)
  );

  // Inicializa todos os assuntos com estado limpo
  const fieldsByTopicId: Record<string, TopicFsrsFields> = {};
  for (const id of params.topicIds) {
    fieldsByTopicId[id] = emptyTopicFsrsFields();
  }

  const generatedLogs: GeneratedFsrsReviewLog[] = [];

  for (const ev of events) {
    const prev = fieldsByTopicId[ev.topicId] ?? emptyTopicFsrsFields();
    const { fields, log } = scheduleTopicReview({
      current: { id: ev.topicId, ...prev },
      realAccuracy: ev.realAccuracy,
      reviewDate: ev.dateStr,
      source: ev.source,
      targetRetention: retention,
    });
    fieldsByTopicId[ev.topicId] = fields;
    generatedLogs.push(log);
  }

  return { fieldsByTopicId, logs: generatedLogs };
}
