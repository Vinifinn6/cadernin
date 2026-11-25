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

const MS_PER_DAY = 86_400_000;

export interface PriorityEngineInput {
  exerciseLogs: ExerciseLog[];
  mockExams: MockExam[];
  mockQuestions: MockQuestion[];
  weights?: PriorityWeights;
  halfLifeDays?: number;
  smoothingC?: number;
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
  urgencyScore: number; // Normalizado 0..100
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
  topicPriorities: PriorityMetric[];
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

/**
 * Calcula quantos dias se passaram entre `dateStr` (YYYY-MM-DD) e `referenceDate`.
 */
export function computeDaysAgo(dateStr: string, referenceDate: Date): number {
  const refMs = toUtcMidnightMs(referenceDate);
  const itemMs = toUtcMidnightMs(dateStr);
  return Math.max(0, (refMs - itemMs) / MS_PER_DAY);
}

/**
 * Decaimento exponencial por meia-vida:
 * decay = 0.5 ^ (daysAgo / halfLifeDays)
 */
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
  const unclassifiedErrors = Math.max(0, totalErrors - (gap + attention + other));

  // Nos exercise_logs, chutes usam o peso do Chute Nível 2 (médio)
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
  }
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

  return {
    id: acc.id,
    kind: acc.kind,
    label: meta.label,
    secondaryLabel: meta.secondaryLabel,
    subjectId: meta.subjectId,
    area: meta.area,
    urgencyScore,
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
  };
}

/**
 * Motor matemático puro de prioridades do Cadernin.
 *
 * - Assuntos: combina `exercise_logs` + `mock_questions` com `topic_id`.
 * - Habilidades ENEM: utiliza EXCLUSIVAMENTE `mock_questions` com `enem_skill_id`.
 */
export function calculatePriorities(
  input: PriorityEngineInput
): PriorityEngineResult {
  const weights = input.weights ?? DEFAULT_PRIORITY_WEIGHTS;
  const halfLifeDays = Math.max(1, input.halfLifeDays ?? 30);
  const smoothingC = Math.max(0, input.smoothingC ?? 3);
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

  // 1. Processa listas de exercícios (somente Assuntos + resumo geral)
  for (const log of input.exerciseLogs) {
    const daysAgo = computeDaysAgo(log.date, referenceDate);
    const decay = computeTemporalDecay(daysAgo, halfLifeDays);

    accumulateExerciseLog(overallAcc, log, decay, weights);

    if (log.topic_id) {
      const topicAcc = getOrCreateTopicAcc(log.topic_id);
      accumulateExerciseLog(topicAcc, log, decay, weights);
    }
  }

  // 2. Processa questões de simulados Raio-X (Assuntos + Habilidades ENEM + resumo geral)
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

  // 3. Finaliza e ordena Assuntos
  const topicPriorities: PriorityMetric[] = Array.from(topicAccMap.values())
    .map((acc) => {
      const topic = topicById.get(acc.id);
      const subject = topic ? subjectById.get(topic.subject_id) : undefined;
      return finalizeMetric(acc, smoothingC, maxActiveWeight, {
        label: topic?.name ?? "Assunto",
        secondaryLabel: subject?.name,
        subjectId: topic?.subject_id ?? null,
      });
    })
    .sort(
      (a, b) =>
        b.urgencyScore - a.urgencyScore ||
        b.rawUrgency - a.rawUrgency ||
        b.totalQuestions - a.totalQuestions
    );

  // 4. Finaliza e ordena Habilidades ENEM
  const enemSkillPriorities: PriorityMetric[] = Array.from(skillAccMap.values())
    .map((acc) => {
      const skill = skillById.get(acc.id);
      return finalizeMetric(acc, smoothingC, maxActiveWeight, {
        label: skill ? `${skill.code} · ${skill.competency}` : "Habilidade",
        secondaryLabel: skill?.description,
        area: skill?.area,
      });
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
    enemSkillPriorities,
    overallSummary,
    maxActiveWeight,
  };
}
