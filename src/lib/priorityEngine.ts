import {
  DEFAULT_PRIORITY_WEIGHTS,
  type EnemSkill,
  type ExerciseLog,
  type MockExam,
  type MockQuestion,
  type PriorityWeights,
  type QuestionOutcome,
  type Subject,
  type Topic,
} from "@/types/database";
import {
  computeAutoModeScore,
  DEFAULT_AUTO_MODE_URGENCY_WEIGHT,
  DEFAULT_FSRS_TARGET_RETENTION,
  getTopicMemorySnapshot,
} from "@/lib/fsrsEngine";

const MS_PER_DAY = 86_400_000;

export interface PriorityEngineInput {
  exerciseLogs: ExerciseLog[];
  mockExams: MockExam[];
  mockQuestions: MockQuestion[];
  weights?: PriorityWeights;
  halfLifeDays?: number;
  smoothingC?: number;
  targetRetention?: number;
  autoModeUrgencyWeight?: number;
  referenceDate?: Date;
  subjects?: Subject[];
  topics?: Topic[];
  enemSkills?: EnemSkill[];
}

export interface PriorityMetric {
  id: string;
  kind: "topic" | "enem_skill";
  label: string;
  secondaryLabel?: string;
  subjectId?: string | null;
  area?: string;
  urgencyScore: number; // U ∈ [0, 100]
  autoScore: number; // Score combinado Modo Automático ∈ [0, 100]
  rawUrgency: number;
  totalQuestions: number;
  rawCorrect: number;
  realCorrect: number;
  rawAccuracyPct: number;
  realAccuracyPct: number;
  guessesLevel1: number;
  guessesLevel2: number;
  guessesLevel3: number;
  guessesTotal: number;
  errorGap: number;
  errorAttention: number;
  errorOther: number;
  lastActivityDate: string | null;
  // Dados de memória FSRS (apenas para assuntos)
  retrievability: number | null;
  retrievabilityPct: number | null;
  stabilityDays: number;
  dueIso: string | null;
  daysUntilDue: number | null;
  isDueForReview: boolean;
  dueStatusLabel: string;
}

export interface OverallPerformanceSummary {
  totalQuestions: number;
  rawCorrect: number;
  realCorrect: number;
  rawAccuracyPct: number;
  realAccuracyPct: number;
  guessIllusionPct: number;
  guessesLevel1: number;
  guessesLevel2: number;
  guessesLevel3: number;
  guessesTotal: number;
  errorGap: number;
  errorAttention: number;
  errorOther: number;
}

export interface PriorityEngineResult {
  topicPriorities: PriorityMetric[]; // Ordenado por Urgência de Domínio U (Incêndios)
  dueReviews: PriorityMetric[]; // Assuntos que precisam de revisão (R < alvo ou due <= hoje)
  autoPriorities: PriorityMetric[]; // Ordenado por autoScore (Modo Automático)
  enemSkillPriorities: PriorityMetric[];
  overallSummary: OverallPerformanceSummary;
  maxActiveWeight: number;
}

interface Accumulator {
  id: string;
  kind: "topic" | "enem_skill";
  weightedSum: number;
  decaySum: number;
  totalQuestions: number;
  rawCorrect: number;
  realCorrect: number;
  guessesLevel1: number;
  guessesLevel2: number;
  guessesLevel3: number;
  errorGap: number;
  errorAttention: number;
  errorOther: number;
  lastActivityDate: string | null;
}

function createAccumulator(
  id: string,
  kind: "topic" | "enem_skill"
): Accumulator {
  return {
    id,
    kind,
    weightedSum: 0,
    decaySum: 0,
    totalQuestions: 0,
    rawCorrect: 0,
    realCorrect: 0,
    guessesLevel1: 0,
    guessesLevel2: 0,
    guessesLevel3: 0,
    errorGap: 0,
    errorAttention: 0,
    errorOther: 0,
    lastActivityDate: null,
  };
}

function toUtcMidnightMs(dateInput: string | Date): number {
  if (dateInput instanceof Date) {
    return Date.UTC(
      dateInput.getFullYear(),
      dateInput.getMonth(),
      dateInput.getDate()
    );
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput.trim());
  if (match) {
    return Date.UTC(
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10) - 1,
      Number.parseInt(match[3], 10)
    );
  }
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return Date.now();
  }
  return Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate()
  );
}

export function computeDaysAgo(dateStr: string, referenceDate: Date): number {
  const refMs = toUtcMidnightMs(referenceDate);
  const itemMs = toUtcMidnightMs(dateStr);
  return Math.max(0, (refMs - itemMs) / MS_PER_DAY);
}

export function computeTemporalDecay(
  daysAgo: number,
  halfLifeDays: number
): number {
  const safeHalfLife = Math.max(1, halfLifeDays);
  const safeDays = Math.max(0, daysAgo);
  return Math.pow(0.5, safeDays / safeHalfLife);
}

export function getOutcomeWeight(
  outcome: QuestionOutcome,
  weights: PriorityWeights
): number {
  return weights[outcome] ?? 0;
}

export function getMaxActiveWeight(weights: PriorityWeights): number {
  return Math.max(
    weights.real_correct,
    weights.error_attention,
    weights.guess_1,
    weights.guess_2,
    weights.guess_3,
    weights.error_gap,
    weights.error_other,
    0
  );
}

function recordDateIfNewer(acc: Accumulator, dateStr: string): void {
  if (!acc.lastActivityDate || dateStr > acc.lastActivityDate) {
    acc.lastActivityDate = dateStr;
  }
}

function accumulateMockQuestion(
  acc: Accumulator,
  question: MockQuestion,
  dateStr: string,
  decay: number,
  weights: PriorityWeights
): void {
  const weight = getOutcomeWeight(question.outcome, weights);
  acc.weightedSum += weight * decay;
  acc.decaySum += decay;
  acc.totalQuestions += 1;
  recordDateIfNewer(acc, dateStr);

  switch (question.outcome) {
    case "real_correct":
      acc.rawCorrect += 1;
      acc.realCorrect += 1;
      break;
    case "guess_1":
      acc.rawCorrect += 1;
      acc.guessesLevel1 += 1;
      break;
    case "guess_2":
      acc.rawCorrect += 1;
      acc.guessesLevel2 += 1;
      break;
    case "guess_3":
      acc.rawCorrect += 1;
      acc.guessesLevel3 += 1;
      break;
    case "error_gap":
      acc.errorGap += 1;
      break;
    case "error_attention":
      acc.errorAttention += 1;
      break;
    case "error_other":
      acc.errorOther += 1;
      break;
  }
}

function accumulateExerciseLog(
  acc: Accumulator,
  log: ExerciseLog,
  decay: number,
  weights: PriorityWeights
): void {
  const total = Math.max(0, log.total_questions);
  if (total === 0) return;

  const rawCorrect = Math.min(total, Math.max(0, log.raw_correct));
  const guesses = Math.min(rawCorrect, Math.max(0, log.guesses_count));
  const realCorrect = Math.max(0, rawCorrect - guesses);

  const totalErrors = Math.max(0, total - rawCorrect);
  const gap = Math.max(0, log.error_gap_count);
  const attention = Math.max(0, log.error_attention_count);
  const other = Math.max(0, log.error_other_count);
  const unclassifiedErrors = Math.max(
    0,
    totalErrors - (gap + attention + other)
  );

  const logWeightSum =
    realCorrect * weights.real_correct +
    guesses * weights.guess_2 +
    gap * weights.error_gap +
    attention * weights.error_attention +
    (other + unclassifiedErrors) * weights.error_other;

  acc.weightedSum += logWeightSum * decay;
  acc.decaySum += total * decay;
  acc.totalQuestions += total;
  acc.rawCorrect += rawCorrect;
  acc.realCorrect += realCorrect;
  acc.guessesLevel2 += guesses;
  acc.errorGap += gap;
  acc.errorAttention += attention;
  acc.errorOther += other + unclassifiedErrors;
  recordDateIfNewer(acc, log.date);
}

function roundPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function finalizeMetric(
  acc: Accumulator,
  smoothingC: number,
  maxWeight: number,
  meta: {
    label: string;
    secondaryLabel?: string;
    subjectId?: string | null;
    area?: string;
    topic?: Topic;
  },
  targetRetention: number,
  autoModeUrgencyWeight: number,
  referenceDate: Date
): PriorityMetric {
  const safeC = Math.max(0, smoothingC);
  const denominator = acc.decaySum + safeC;
  const rawUrgency = denominator > 0 ? acc.weightedSum / denominator : 0;
  const urgencyScore =
    maxWeight > 0
      ? Math.min(100, Math.max(0, Math.round((rawUrgency / maxWeight) * 100)))
      : 0;

  const guessesTotal =
    acc.guessesLevel1 + acc.guessesLevel2 + acc.guessesLevel3;

  const memory =
    acc.kind === "topic" && meta.topic
      ? getTopicMemorySnapshot(meta.topic, targetRetention, referenceDate)
      : {
          retrievability: null,
          retrievabilityPct: null,
          stabilityDays: 0,
          dueIso: null,
          daysUntilDue: null,
          isDueForReview: false,
          dueStatusLabel: "Sem prática registrada",
        };

  const autoScore = computeAutoModeScore(
    urgencyScore,
    memory.retrievability,
    autoModeUrgencyWeight
  );

  return {
    id: acc.id,
    kind: acc.kind,
    label: meta.label,
    secondaryLabel: meta.secondaryLabel,
    subjectId: meta.subjectId,
    area: meta.area,
    urgencyScore,
    autoScore,
    rawUrgency: Math.round(rawUrgency * 1000) / 1000,
    totalQuestions: acc.totalQuestions,
    rawCorrect: acc.rawCorrect,
    realCorrect: acc.realCorrect,
    rawAccuracyPct: roundPct(acc.rawCorrect, acc.totalQuestions),
    realAccuracyPct: roundPct(acc.realCorrect, acc.totalQuestions),
    guessesLevel1: acc.guessesLevel1,
    guessesLevel2: acc.guessesLevel2,
    guessesLevel3: acc.guessesLevel3,
    guessesTotal,
    errorGap: acc.errorGap,
    errorAttention: acc.errorAttention,
    errorOther: acc.errorOther,
    lastActivityDate: acc.lastActivityDate,
    retrievability: memory.retrievability,
    retrievabilityPct: memory.retrievabilityPct,
    stabilityDays: memory.stabilityDays,
    dueIso: memory.dueIso,
    daysUntilDue: memory.daysUntilDue,
    isDueForReview: memory.isDueForReview,
    dueStatusLabel: memory.dueStatusLabel,
  };
}

/**
 * Motor matemático puro de prioridades + integração FSRS do Cadernin.
 */
export function calculatePriorities(
  input: PriorityEngineInput
): PriorityEngineResult {
  const weights = input.weights ?? DEFAULT_PRIORITY_WEIGHTS;
  const halfLifeDays = Math.max(1, input.halfLifeDays ?? 30);
  const smoothingC = Math.max(0, input.smoothingC ?? 3);
  const targetRetention = input.targetRetention ?? DEFAULT_FSRS_TARGET_RETENTION;
  const autoModeUrgencyWeight =
    input.autoModeUrgencyWeight ?? DEFAULT_AUTO_MODE_URGENCY_WEIGHT;
  const referenceDate = input.referenceDate ?? new Date();
  const maxActiveWeight = getMaxActiveWeight(weights);

  const examDateById = new Map<string, string>();
  for (const exam of input.mockExams) {
    examDateById.set(exam.id, exam.date);
  }

  const subjectById = new Map<string, Subject>();
  for (const subj of input.subjects ?? []) {
    subjectById.set(subj.id, subj);
  }

  const topicById = new Map<string, Topic>();
  for (const topic of input.topics ?? []) {
    topicById.set(topic.id, topic);
  }

  const skillById = new Map<string, EnemSkill>();
  for (const skill of input.enemSkills ?? []) {
    skillById.set(skill.id, skill);
  }

  const topicAccMap = new Map<string, Accumulator>();
  const skillAccMap = new Map<string, Accumulator>();
  const overallAcc = createAccumulator("__overall__", "topic");

  const getOrCreateTopicAcc = (topicId: string) => {
    let acc = topicAccMap.get(topicId);
    if (!acc) {
      acc = createAccumulator(topicId, "topic");
      topicAccMap.set(topicId, acc);
    }
    return acc;
  };

  const getOrCreateSkillAcc = (skillId: string) => {
    let acc = skillAccMap.get(skillId);
    if (!acc) {
      acc = createAccumulator(skillId, "enem_skill");
      skillAccMap.set(skillId, acc);
    }
    return acc;
  };

  // 1. Listas de exercícios
  for (const log of input.exerciseLogs) {
    if (!log.total_questions || log.total_questions <= 0) continue;
    const daysAgo = computeDaysAgo(log.date, referenceDate);
    const decay = computeTemporalDecay(daysAgo, halfLifeDays);

    accumulateExerciseLog(overallAcc, log, decay, weights);

    if (log.topic_id) {
      const topicAcc = getOrCreateTopicAcc(log.topic_id);
      accumulateExerciseLog(topicAcc, log, decay, weights);
    }
  }

  // 2. Questões de simulados Raio-X
  const fallbackTodayStr = referenceDate.toISOString().slice(0, 10);

  for (const q of input.mockQuestions) {
    const examDate = examDateById.get(q.mock_exam_id) ?? fallbackTodayStr;
    const daysAgo = computeDaysAgo(examDate, referenceDate);
    const decay = computeTemporalDecay(daysAgo, halfLifeDays);

    accumulateMockQuestion(overallAcc, q, examDate, decay, weights);

    if (q.topic_id) {
      const topicAcc = getOrCreateTopicAcc(q.topic_id);
      accumulateMockQuestion(topicAcc, q, examDate, decay, weights);
    }

    if (q.enem_skill_id) {
      const skillAcc = getOrCreateSkillAcc(q.enem_skill_id);
      accumulateMockQuestion(skillAcc, q, examDate, decay, weights);
    }
  }

  // Inclui também assuntos que tenham estado FSRS salvo (mesmo sem logs recentes carregados)
  for (const topic of input.topics ?? []) {
    if (
      topic.fsrs_last_review &&
      Number(topic.fsrs_stability ?? 0) > 0 &&
      !topicAccMap.has(topic.id)
    ) {
      topicAccMap.set(topic.id, createAccumulator(topic.id, "topic"));
    }
  }

  // 3. Finaliza Assuntos
  const allTopicMetrics: PriorityMetric[] = Array.from(topicAccMap.values()).map(
    (acc) => {
      const topic = topicById.get(acc.id);
      const subject = topic ? subjectById.get(topic.subject_id) : undefined;
      return finalizeMetric(
        acc,
        smoothingC,
        maxActiveWeight,
        {
          label: topic?.name ?? "Assunto",
          secondaryLabel: subject?.name,
          subjectId: topic?.subject_id ?? null,
          topic,
        },
        targetRetention,
        autoModeUrgencyWeight,
        referenceDate
      );
    }
  );

  // Ranking Incêndios (Urgência de Domínio U)
  const topicPriorities = [...allTopicMetrics]
    .filter((m) => m.totalQuestions > 0)
    .sort(
      (a, b) =>
        b.urgencyScore - a.urgencyScore ||
        b.rawUrgency - a.rawUrgency ||
        b.totalQuestions - a.totalQuestions
    );

  // Ranking Revisões (R < targetRetention ou due <= hoje), mais críticos/atrasados primeiro
  const dueReviews = [...allTopicMetrics]
    .filter((m) => m.isDueForReview)
    .sort((a, b) => {
      const rA = a.retrievability ?? 1;
      const rB = b.retrievability ?? 1;
      if (Math.abs(rA - rB) > 0.005) return rA - rB;
      const dA = a.daysUntilDue ?? 9999;
      const dB = b.daysUntilDue ?? 9999;
      return dA - dB;
    });

  // Ranking Modo Automático (Lacunas + Revisões)
  const autoPriorities = [...allTopicMetrics].sort(
    (a, b) =>
      b.autoScore - a.autoScore ||
      b.urgencyScore - a.urgencyScore ||
      (a.retrievability ?? 1) - (b.retrievability ?? 1)
  );

  // 4. Finaliza Habilidades ENEM (exclusivamente de mock_questions com enem_skill_id)
  const enemSkillPriorities: PriorityMetric[] = Array.from(
    skillAccMap.values()
  )
    .map((acc) => {
      const skill = skillById.get(acc.id);
      return finalizeMetric(
        acc,
        smoothingC,
        maxActiveWeight,
        {
          label: skill ? `${skill.code} · ${skill.competency}` : "Habilidade",
          secondaryLabel: skill?.description,
          area: skill?.area,
        },
        targetRetention,
        autoModeUrgencyWeight,
        referenceDate
      );
    })
    .sort(
      (a, b) =>
        b.urgencyScore - a.urgencyScore ||
        b.rawUrgency - a.rawUrgency ||
        b.totalQuestions - a.totalQuestions
    );

  const overallGuesses =
    overallAcc.guessesLevel1 +
    overallAcc.guessesLevel2 +
    overallAcc.guessesLevel3;
  const overallRawPct = roundPct(
    overallAcc.rawCorrect,
    overallAcc.totalQuestions
  );
  const overallRealPct = roundPct(
    overallAcc.realCorrect,
    overallAcc.totalQuestions
  );

  const overallSummary: OverallPerformanceSummary = {
    totalQuestions: overallAcc.totalQuestions,
    rawCorrect: overallAcc.rawCorrect,
    realCorrect: overallAcc.realCorrect,
    rawAccuracyPct: overallRawPct,
    realAccuracyPct: overallRealPct,
    guessIllusionPct: Math.round((overallRawPct - overallRealPct) * 10) / 10,
    guessesLevel1: overallAcc.guessesLevel1,
    guessesLevel2: overallAcc.guessesLevel2,
    guessesLevel3: overallAcc.guessesLevel3,
    guessesTotal: overallGuesses,
    errorGap: overallAcc.errorGap,
    errorAttention: overallAcc.errorAttention,
    errorOther: overallAcc.errorOther,
  };

  return {
    topicPriorities,
    dueReviews,
    autoPriorities,
    enemSkillPriorities,
    overallSummary,
    maxActiveWeight,
  };
}
