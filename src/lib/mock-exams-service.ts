import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  EnemArea,
  MockExam,
  MockExamMode,
  MockQuestion,
  MockTaggingMode,
  QuestionOutcome,
} from "@/types/database";

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase não configurado.");
  }
  return client;
}

export interface MockExamInput {
  title: string;
  date: string;
  mode: MockExamMode;
  tagging_mode: MockTaggingMode;
  score_lc: number | null;
  score_ch: number | null;
  score_cn: number | null;
  score_mt: number | null;
  tri_lc: number | null;
  tri_ch: number | null;
  tri_cn: number | null;
  tri_mt: number | null;
  essay_total: number | null;
  essay_c1: number | null;
  essay_c2: number | null;
  essay_c3: number | null;
  essay_c4: number | null;
  essay_c5: number | null;
  notes: string | null;
}

export interface MockQuestionInput {
  mock_exam_id: string;
  question_number: number;
  area: EnemArea;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  enem_skill_id: string | null;
  outcome: QuestionOutcome;
  error_note: string | null;
}

export async function fetchMockExamsAndQuestions(): Promise<{
  exams: MockExam[];
  questions: MockQuestion[];
}> {
  const supabase = requireSupabase();

  const [examsRes, questionsRes] = await Promise.all([
    supabase
      .from("mock_exams")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("mock_questions")
      .select("*")
      .order("question_number", { ascending: true }),
  ]);

  if (examsRes.error) throw new Error(examsRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);

  return {
    exams: (examsRes.data ?? []) as MockExam[],
    questions: (questionsRes.data ?? []) as MockQuestion[],
  };
}

export async function createMockExam(input: MockExamInput): Promise<MockExam> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("mock_exams")
    .insert({
      ...input,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar o simulado.");
  }
  return data as MockExam;
}

export async function updateMockExam(
  id: string,
  patch: Partial<MockExamInput>
): Promise<MockExam> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("mock_exams")
    .update({
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.notes !== undefined
        ? { notes: patch.notes?.trim() || null }
        : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível atualizar o simulado.");
  }
  return data as MockExam;
}

export async function deleteMockExam(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("mock_exams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function upsertMockQuestion(
  input: MockQuestionInput
): Promise<MockQuestion> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("mock_questions")
    .upsert(
      {
        ...input,
        error_note: input.error_note?.trim() || null,
      },
      { onConflict: "mock_exam_id,question_number" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível salvar a questão.");
  }
  return data as MockQuestion;
}

export async function deleteMockQuestion(
  mockExamId: string,
  questionNumber: number
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("mock_questions")
    .delete()
    .eq("mock_exam_id", mockExamId)
    .eq("question_number", questionNumber);

  if (error) throw new Error(error.message);
}

/**
 * Recalcula os acertos brutos por área a partir das questões salvas no modo Raio-X.
 */
export function computeAreaScoresFromQuestions(questions: MockQuestion[]): {
  score_lc: number | null;
  score_ch: number | null;
  score_cn: number | null;
  score_mt: number | null;
} {
  const counts: Record<EnemArea, { total: number; correct: number }> = {
    linguagens: { total: 0, correct: 0 },
    humanas: { total: 0, correct: 0 },
    natureza: { total: 0, correct: 0 },
    matematica: { total: 0, correct: 0 },
  };

  for (const q of questions) {
    counts[q.area].total += 1;
    if (
      q.outcome === "real_correct" ||
      q.outcome === "guess_1" ||
      q.outcome === "guess_2" ||
      q.outcome === "guess_3"
    ) {
      counts[q.area].correct += 1;
    }
  }

  return {
    score_lc: counts.linguagens.total > 0 ? counts.linguagens.correct : null,
    score_ch: counts.humanas.total > 0 ? counts.humanas.correct : null,
    score_cn: counts.natureza.total > 0 ? counts.natureza.correct : null,
    score_mt: counts.matematica.total > 0 ? counts.matematica.correct : null,
  };
}
