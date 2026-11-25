import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  StudySession,
  StudySessionSource,
  WeeklyPlanItem,
} from "@/types/database";

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase não configurado.");
  }
  return client;
}

export async function fetchWeeklyPlanItems(): Promise<WeeklyPlanItem[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("weekly_plan_items")
    .select("*")
    .order("planned_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WeeklyPlanItem[];
}

export async function createWeeklyPlanItem(input: {
  planned_date: string;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
}): Promise<WeeklyPlanItem> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("weekly_plan_items")
    .insert({
      planned_date: input.planned_date,
      subject_id: input.subject_id,
      topic_id: input.topic_id,
      title: input.title.trim(),
      is_completed: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar a tarefa.");
  }
  return data as WeeklyPlanItem;
}

export async function updateWeeklyPlanItem(
  id: string,
  patch: Partial<{
    planned_date: string;
    subject_id: string | null;
    topic_id: string | null;
    title: string;
    is_completed: boolean;
  }>
): Promise<WeeklyPlanItem> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("weekly_plan_items")
    .update({
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível atualizar a tarefa.");
  }
  return data as WeeklyPlanItem;
}

export async function deleteWeeklyPlanItem(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("weekly_plan_items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchStudySessions(): Promise<StudySession[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as StudySession[];
}

export async function createStudySession(input: {
  date: string;
  subject_id: string | null;
  topic_id: string | null;
  duration_minutes: number;
  source: StudySessionSource;
}): Promise<StudySession> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      ...input,
      duration_minutes: Math.max(1, Math.round(input.duration_minutes)),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível salvar a sessão.");
  }
  return data as StudySession;
}

export async function deleteStudySession(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("study_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
