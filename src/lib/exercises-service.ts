import { getSupabaseClient } from "@/lib/supabase/client";
import type { ExerciseLog } from "@/types/database";

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase não configurado.");
  }
  return client;
}

export interface ExerciseLogInput {
  date: string;
  subject_id: string;
  topic_id: string;
  subtopic_id: string | null;
  total_questions: number;
  raw_correct: number;
  guesses_count: number;
  error_gap_count: number;
  error_attention_count: number;
  error_other_count: number;
  notes: string | null;
}

export async function fetchExerciseLogs(): Promise<ExerciseLog[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ExerciseLog[];
}

export async function createExerciseLog(
  input: ExerciseLogInput
): Promise<ExerciseLog> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("exercise_logs")
    .insert({
      ...input,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Erro ao registrar bateria de exercícios.");
  }
  return data as ExerciseLog;
}

export async function updateExerciseLog(
  id: string,
  input: ExerciseLogInput
): Promise<ExerciseLog> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("exercise_logs")
    .update({
      ...input,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Erro ao atualizar bateria de exercícios.");
  }
  return data as ExerciseLog;
}

export async function deleteExerciseLog(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("exercise_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
