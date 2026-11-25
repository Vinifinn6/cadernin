import { getSupabaseClient } from "@/lib/supabase/client";
import type { Subject, Subtopic, Topic, TopicStatus } from "@/types/database";

export interface TopicWithSubtopics extends Topic {
  subtopics: Subtopic[];
  progressPercent: number;
  completedSubtopics: number;
}

export interface SubjectWithTopics extends Subject {
  topics: TopicWithSubtopics[];
  progressPercent: number;
  totalTopics: number;
  masteredTopics: number;
  totalSubtopics: number;
  completedSubtopics: number;
}

export function calculateTopicProgress(
  status: TopicStatus,
  subtopics: Subtopic[]
): { progressPercent: number; completedSubtopics: number } {
  if (subtopics.length > 0) {
    const completedSubtopics = subtopics.filter((s) => s.is_completed).length;
    return {
      progressPercent: Math.round((completedSubtopics / subtopics.length) * 100),
      completedSubtopics,
    };
  }

  if (status === "mastered") return { progressPercent: 100, completedSubtopics: 0 };
  if (status === "studying") return { progressPercent: 50, completedSubtopics: 0 };
  return { progressPercent: 0, completedSubtopics: 0 };
}

export function buildCurriculumTree(
  subjects: Subject[],
  topics: Topic[],
  subtopics: Subtopic[]
): SubjectWithTopics[] {
  const subtopicsByTopic = new Map<string, Subtopic[]>();
  for (const sub of subtopics) {
    const list = subtopicsByTopic.get(sub.topic_id) ?? [];
    list.push(sub);
    subtopicsByTopic.set(sub.topic_id, list);
  }

  const topicsBySubject = new Map<string, TopicWithSubtopics[]>();
  for (const topic of topics) {
    const topicSubs = (subtopicsByTopic.get(topic.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR")
    );
    const { progressPercent, completedSubtopics } = calculateTopicProgress(
      topic.status,
      topicSubs
    );

    const enriched: TopicWithSubtopics = {
      ...topic,
      subtopics: topicSubs,
      progressPercent,
      completedSubtopics,
    };

    const list = topicsBySubject.get(topic.subject_id) ?? [];
    list.push(enriched);
    topicsBySubject.set(topic.subject_id, list);
  }

  return [...subjects]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"))
    .map((subject) => {
      const subjectTopics = (topicsBySubject.get(subject.id) ?? []).sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR")
      );

      const totalTopics = subjectTopics.length;
      const masteredTopics = subjectTopics.filter(
        (t) =>
          t.subtopics.length > 0
            ? t.completedSubtopics === t.subtopics.length
            : t.status === "mastered"
      ).length;

      const totalSubtopics = subjectTopics.reduce(
        (acc, t) => acc + t.subtopics.length,
        0
      );
      const completedSubtopics = subjectTopics.reduce(
        (acc, t) => acc + t.completedSubtopics,
        0
      );

      const progressPercent =
        totalTopics === 0
          ? 0
          : Math.round(
              subjectTopics.reduce((acc, t) => acc + t.progressPercent, 0) /
                totalTopics
            );

      return {
        ...subject,
        topics: subjectTopics,
        progressPercent,
        totalTopics,
        masteredTopics,
        totalSubtopics,
        completedSubtopics,
      };
    });
}

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase não configurado. Verifique seu arquivo .env.local."
    );
  }
  return client;
}

export async function fetchCurriculumData(): Promise<{
  subjects: Subject[];
  topics: Topic[];
  subtopics: Subtopic[];
}> {
  const supabase = requireSupabase();

  const [subjectsRes, topicsRes, subtopicsRes] = await Promise.all([
    supabase
      .from("subjects")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("topics")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("subtopics")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (subjectsRes.error) throw new Error(subjectsRes.error.message);
  if (topicsRes.error) throw new Error(topicsRes.error.message);
  if (subtopicsRes.error) throw new Error(subtopicsRes.error.message);

  return {
    subjects: (subjectsRes.data ?? []) as Subject[],
    topics: (topicsRes.data ?? []) as Topic[],
    subtopics: (subtopicsRes.data ?? []) as Subtopic[],
  };
}

export async function createSubject(input: {
  name: string;
  color: string;
  icon_name: string;
  sort_order: number;
}): Promise<Subject> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name: input.name.trim(),
      color: input.color,
      icon_name: input.icon_name,
      sort_order: input.sort_order,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar a matéria.");
  }
  return data as Subject;
}

export async function updateSubject(
  id: string,
  patch: { name?: string; color?: string; icon_name?: string; sort_order?: number }
): Promise<Subject> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("subjects")
    .update({
      ...patch,
      ...(patch.name ? { name: patch.name.trim() } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível atualizar a matéria.");
  }
  return data as Subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createTopic(input: {
  subject_id: string;
  name: string;
  status?: TopicStatus;
  sort_order: number;
}): Promise<Topic> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("topics")
    .insert({
      subject_id: input.subject_id,
      name: input.name.trim(),
      status: input.status ?? "not_started",
      sort_order: input.sort_order,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar o assunto.");
  }
  return data as Topic;
}

export async function updateTopic(
  id: string,
  patch: { name?: string; status?: TopicStatus; sort_order?: number }
): Promise<Topic> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("topics")
    .update({
      ...patch,
      ...(patch.name ? { name: patch.name.trim() } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível atualizar o assunto.");
  }
  return data as Topic;
}

export async function deleteTopic(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createSubtopic(input: {
  topic_id: string;
  name: string;
  sort_order: number;
}): Promise<Subtopic> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("subtopics")
    .insert({
      topic_id: input.topic_id,
      name: input.name.trim(),
      is_completed: false,
      sort_order: input.sort_order,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar o subtópico.");
  }
  return data as Subtopic;
}

export async function updateSubtopic(
  id: string,
  patch: { name?: string; is_completed?: boolean; sort_order?: number }
): Promise<Subtopic> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("subtopics")
    .update({
      ...patch,
      ...(patch.name ? { name: patch.name.trim() } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível atualizar o subtópico.");
  }
  return data as Subtopic;
}

export async function deleteSubtopic(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("subtopics").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
