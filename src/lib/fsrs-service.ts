import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_FSRS_TARGET_RETENTION,
  recalculateFsrsFromHistory,
  type TopicFsrsFields,
} from "@/lib/fsrsEngine";
import type { ExerciseLog, MockExam, MockQuestion } from "@/types/database";

function isMissingFsrsSchemaError(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes("fsrs_") ||
    message.includes("fsrs_review_logs") ||
    message.includes("does not exist")
  );
}

/**
 * Sincroniza de forma idempotente e exata o estado FSRS de um único assunto
 * a partir de todas as listas (`exercise_logs`) e questões de simulados (`mock_questions`)
 * vinculadas a esse `topic_id`.
 *
 * Vantagem: editar um exercício ou marcar várias questões do mesmo assunto no Raio-X
 * sempre produz 1 estado consistente sem duplicar repetições.
 */
export async function syncTopicFsrsState(
  topicId: string | null | undefined,
  targetRetention: number = DEFAULT_FSRS_TARGET_RETENTION
): Promise<{ updated: boolean; fields?: TopicFsrsFields; skippedMigration?: boolean }> {
  if (!topicId) return { updated: false };
  const supabase = getSupabaseClient();
  if (!supabase) return { updated: false };

  try {
    const [logsRes, questionsRes, examsRes] = await Promise.all([
      supabase
        .from("exercise_logs")
        .select("*")
        .eq("topic_id", topicId),
      supabase
        .from("mock_questions")
        .select("*")
        .eq("topic_id", topicId),
      supabase.from("mock_exams").select("id, date"),
    ]);

    if (logsRes.error || questionsRes.error || examsRes.error) {
      return { updated: false };
    }

    const { fieldsByTopicId, logs } = recalculateFsrsFromHistory({
      topicIds: [topicId],
      exerciseLogs: (logsRes.data ?? []) as ExerciseLog[],
      mockExams: (examsRes.data ?? []) as MockExam[],
      mockQuestions: (questionsRes.data ?? []) as MockQuestion[],
      targetRetention,
    });

    const nextFields = fieldsByTopicId[topicId];
    if (!nextFields) return { updated: false };

    const { error: topicUpdateError } = await supabase
      .from("topics")
      .update(nextFields)
      .eq("id", topicId);

    if (topicUpdateError) {
      if (isMissingFsrsSchemaError(topicUpdateError.message)) {
        return { updated: false, skippedMigration: true };
      }
      return { updated: false };
    }

    // Atualiza logs daquele assunto de forma limpa e sem duplicatas
    const { error: deleteErr } = await supabase
      .from("fsrs_review_logs")
      .delete()
      .eq("topic_id", topicId);

    if (!deleteErr && logs.length > 0) {
      await supabase.from("fsrs_review_logs").insert(logs);
    }

    return { updated: true, fields: nextFields };
  } catch {
    return { updated: false };
  }
}

/**
 * Recalcula retroativamente o estado de memória FSRS de TODOS os assuntos cadastrados
 * a partir de todo o histórico salvo no Supabase.
 */
export async function recalculateAllTopicsFsrs(
  targetRetention: number = DEFAULT_FSRS_TARGET_RETENTION
): Promise<{
  processedTopics: number;
  practicedTopics: number;
  logsCreated: number;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const [topicsRes, logsRes, examsRes, questionsRes] = await Promise.all([
    supabase.from("topics").select("id"),
    supabase.from("exercise_logs").select("*"),
    supabase.from("mock_exams").select("id, date"),
    supabase.from("mock_questions").select("*"),
  ]);

  if (topicsRes.error) throw new Error(topicsRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);
  if (examsRes.error) throw new Error(examsRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);

  const topicIds = ((topicsRes.data ?? []) as { id: string }[]).map(
    (t) => t.id
  );

  if (topicIds.length === 0) {
    return { processedTopics: 0, practicedTopics: 0, logsCreated: 0 };
  }

  const { fieldsByTopicId, logs } = recalculateFsrsFromHistory({
    topicIds,
    exerciseLogs: (logsRes.data ?? []) as ExerciseLog[],
    mockExams: (examsRes.data ?? []) as MockExam[],
    mockQuestions: (questionsRes.data ?? []) as MockQuestion[],
    targetRetention,
  });

  // Atualiza os assuntos em pequenos lotes paralelos
  let practicedTopics = 0;
  const batchSize = 20;
  for (let i = 0; i < topicIds.length; i += batchSize) {
    const slice = topicIds.slice(i, i + batchSize);
    const results = await Promise.all(
      slice.map((id) => {
        const fields = fieldsByTopicId[id];
        if (fields.fsrs_reps > 0) practicedTopics += 1;
        return supabase.from("topics").update(fields).eq("id", id);
      })
    );

    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      if (isMissingFsrsSchemaError(firstErr.message)) {
        throw new Error(
          "As colunas de Revisões ainda não existem no Supabase. Execute o arquivo supabase/migration_phase6_fsrs.sql no SQL Editor primeiro."
        );
      }
      throw new Error(firstErr.message);
    }
  }

  // Substitui fsrs_review_logs de forma limpa
  const { error: clearLogsError } = await supabase
    .from("fsrs_review_logs")
    .delete()
    .in("topic_id", topicIds);

  if (clearLogsError) {
    if (isMissingFsrsSchemaError(clearLogsError.message)) {
      throw new Error(
        "A tabela fsrs_review_logs ainda não existe. Execute supabase/migration_phase6_fsrs.sql no SQL Editor."
      );
    }
    throw new Error(clearLogsError.message);
  }

  if (logs.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < logs.length; i += chunkSize) {
      const { error: insertErr } = await supabase
        .from("fsrs_review_logs")
        .insert(logs.slice(i, i + chunkSize));
      if (insertErr) throw new Error(insertErr.message);
    }
  }

  return {
    processedTopics: topicIds.length,
    practicedTopics,
    logsCreated: logs.length,
  };
}
