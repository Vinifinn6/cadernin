import type {
  ExerciseLog,
  MockExam,
  MockQuestion,
  StudySession,
} from "@/types/database";

export interface DailyActivityData {
  date: string; // YYYY-MM-DD (sempre string local pura, sem deslocamento UTC)
  minutes: number;
  questions: number;
}

/**
 * Extrai estritamente YYYY-MM-DD sem converter por Date/UTC,
 * evitando regressão de 1 dia em fusos negativos (ex: UTC-3).
 */
export function normalizeLocalDateKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1] : null;
}

/**
 * Agrega por dia local (YYYY-MM-DD) todo o tempo estudado (`study_sessions`)
 * e TODAS as questões feitas (`exercise_logs` + `mock_exams` / `mock_questions`).
 */
export function buildDailyActivityMap(params: {
  studySessions: StudySession[];
  exerciseLogs: ExerciseLog[];
  mockExams: MockExam[];
  mockQuestions: MockQuestion[];
}): Record<string, DailyActivityData> {
  const map: Record<string, DailyActivityData> = {};

  const ensure = (iso: string): DailyActivityData => {
    if (!map[iso]) {
      map[iso] = { date: iso, minutes: 0, questions: 0 };
    }
    return map[iso];
  };

  // 1. Tempo estudado (Cronômetro / Manual)
  for (const session of params.studySessions) {
    const key = normalizeLocalDateKey(session.date);
    if (!key) continue;
    ensure(key).minutes += Math.max(0, Number(session.duration_minutes ?? 0));
  }

  // 2. Baterias de exercícios
  for (const log of params.exerciseLogs) {
    const key = normalizeLocalDateKey(log.date);
    if (!key) continue;
    ensure(key).questions += Math.max(0, Number(log.total_questions ?? 0));
  }

  // 3. Simulados (Raio-X via contagem real de mock_questions; Express via soma das áreas preenchidas)
  const questionCountByExam = new Map<string, number>();
  for (const q of params.mockQuestions) {
    questionCountByExam.set(
      q.mock_exam_id,
      (questionCountByExam.get(q.mock_exam_id) ?? 0) + 1
    );
  }

  for (const exam of params.mockExams) {
    const key = normalizeLocalDateKey(exam.date);
    if (!key) continue;

    const detailedCount = questionCountByExam.get(exam.id) ?? 0;
    if (detailedCount > 0) {
      ensure(key).questions += detailedCount;
    } else {
      // Modo Express: soma os acertos preenchidos (ou 45 por área preenchida? Aqui usamos
      // contagem conservadora das questões respondidas/acertadas para não inflar sem saber o total)
      const expressAreas = [
        exam.score_lc,
        exam.score_ch,
        exam.score_cn,
        exam.score_mt,
      ].filter((v): v is number => v !== null && v !== undefined);
      if (expressAreas.length > 0) {
        const sumScores = expressAreas.reduce((a, b) => a + Math.max(0, b), 0);
        // Garante ao menos a soma das notas (ou 1 se zerado mas prova feita)
        ensure(key).questions += Math.max(1, sumScores);
      }
    }
  }

  return map;
}
