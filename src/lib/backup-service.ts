import { getSupabaseClient } from "@/lib/supabase/client";

export const BACKUP_TABLES = [
  "user_profile",
  "subjects",
  "topics",
  "subtopics",
  "enem_skills",
  "exercise_logs",
  "mock_exams",
  "mock_questions",
  "study_sessions",
  "weekly_plan_items",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export interface CaderninBackupFile {
  version: number;
  exported_at: string;
  app_name: string;
  counts: Record<BackupTableName, number>;
  data: Record<BackupTableName, Record<string, unknown>[]>;
}

export const BACKUP_TABLE_LABELS: Record<BackupTableName, string> = {
  user_profile: "Perfil e configurações",
  subjects: "Matérias",
  topics: "Assuntos gerais",
  subtopics: "Subtópicos",
  enem_skills: "Habilidades ENEM",
  exercise_logs: "Baterias de exercícios",
  mock_exams: "Simulados",
  mock_questions: "Questões de simulados",
  study_sessions: "Sessões de estudo",
  weekly_plan_items: "Itens do planejador",
};

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase não configurado.");
  }
  return client;
}

export async function exportFullBackup(
  appName: string
): Promise<CaderninBackupFile> {
  const supabase = requireSupabase();

  const results = await Promise.all(
    BACKUP_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        throw new Error(`Erro ao ler tabela ${table}: ${error.message}`);
      }
      return [table, (data ?? []) as Record<string, unknown>[]] as const;
    })
  );

  const dataMap = {} as Record<BackupTableName, Record<string, unknown>[]>;
  const countsMap = {} as Record<BackupTableName, number>;

  for (const [table, rows] of results) {
    dataMap[table] = rows;
    countsMap[table] = rows.length;
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    app_name: appName || "Cadernin",
    counts: countsMap,
    data: dataMap,
  };
}

export function triggerJsonDownload(backup: CaderninBackupFile): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const slug = (backup.app_name || "cadernin")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cadernin";

  const fileName = `${slug}-backup-${datePart}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return fileName;
}

export function validateBackupJson(rawText: string): {
  backup?: CaderninBackupFile;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawText) as Partial<CaderninBackupFile>;
    if (!parsed || typeof parsed !== "object" || !parsed.data) {
      return {
        error: "Este arquivo não parece ser um backup válido do Cadernin.",
      };
    }

    const dataObj = parsed.data as Record<string, unknown>;
    const normalizedData = {} as Record<
      BackupTableName,
      Record<string, unknown>[]
    >;
    const normalizedCounts = {} as Record<BackupTableName, number>;

    for (const table of BACKUP_TABLES) {
      const value = dataObj[table];
      const rows = Array.isArray(value)
        ? (value as Record<string, unknown>[])
        : [];
      normalizedData[table] = rows;
      normalizedCounts[table] = rows.length;
    }

    return {
      backup: {
        version: typeof parsed.version === "number" ? parsed.version : 1,
        exported_at:
          typeof parsed.exported_at === "string"
            ? parsed.exported_at
            : new Date().toISOString(),
        app_name:
          typeof parsed.app_name === "string" ? parsed.app_name : "Cadernin",
        counts: normalizedCounts,
        data: normalizedData,
      },
    };
  } catch {
    return {
      error: "Não foi possível ler o arquivo JSON. Verifique se ele não está corrompido.",
    };
  }
}

/**
 * Restaura os registros em ordem segura de chaves estrangeiras usando upsert.
 */
export async function importFullBackup(
  backup: CaderninBackupFile
): Promise<{ importedTotal: number; perTable: Record<BackupTableName, number> }> {
  const supabase = requireSupabase();
  const perTable = {} as Record<BackupTableName, number>;
  let importedTotal = 0;

  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table] ?? [];
    if (rows.length === 0) {
      perTable[table] = 0;
      continue;
    }

    // Divide em lotes de 200 registros para evitar limites de payload
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      let { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: "id" });

      // Compatibilidade caso user_profile no banco ainda não tenha coluna app_name
      if (
        table === "user_profile" &&
        error &&
        error.message.includes("app_name")
      ) {
        const sanitized = chunk.map((r) => {
          const copy = { ...r };
          delete copy.app_name;
          return copy;
        });
        const retry = await supabase
          .from(table)
          .upsert(sanitized, { onConflict: "id" });
        error = retry.error;
      }

      if (error) {
        throw new Error(
          `Erro ao restaurar "${BACKUP_TABLE_LABELS[table]}": ${error.message}`
        );
      }
    }

    perTable[table] = rows.length;
    importedTotal += rows.length;
  }

  return { importedTotal, perTable };
}
