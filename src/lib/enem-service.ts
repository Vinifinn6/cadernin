import { getSupabaseClient } from "@/lib/supabase/client";
import { ENEM_BASE_MATRIX, type EnemSkillSeedItem } from "@/lib/enem-matrix-seed";
import type { EnemArea, EnemSkill } from "@/types/database";

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase não configurado.");
  }
  return client;
}

export function sortEnemSkills(skills: EnemSkill[]): EnemSkill[] {
  return [...skills].sort((a, b) => {
    const numA = Number.parseInt(a.code.replace(/\D/g, ""), 10);
    const numB = Number.parseInt(b.code.replace(/\D/g, ""), 10);
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.code.localeCompare(b.code, "pt-BR");
  });
}

export async function fetchEnemSkills(): Promise<EnemSkill[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("enem_skills").select("*");
  if (error) throw new Error(error.message);
  return sortEnemSkills((data ?? []) as EnemSkill[]);
}

export async function upsertEnemSkill(input: {
  id?: string;
  area: EnemArea;
  code: string;
  competency: string;
  description: string;
}): Promise<EnemSkill> {
  const supabase = requireSupabase();
  const normalizedCode = input.code.trim().toUpperCase();
  const normalizedComp = input.competency.trim().toUpperCase() || "C1";
  const normalizedDesc = input.description.trim();

  if (!normalizedCode || !normalizedDesc) {
    throw new Error("Preencha o código (ex: H1) e a descrição da habilidade.");
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("enem_skills")
      .update({
        area: input.area,
        code: normalizedCode,
        competency: normalizedComp,
        description: normalizedDesc,
      })
      .eq("id", input.id)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Erro ao atualizar habilidade.");
    return data as EnemSkill;
  }

  const { data, error } = await supabase
    .from("enem_skills")
    .upsert(
      {
        area: input.area,
        code: normalizedCode,
        competency: normalizedComp,
        description: normalizedDesc,
      },
      { onConflict: "area,code" }
    )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Erro ao salvar habilidade.");
  return data as EnemSkill;
}

export async function deleteEnemSkill(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("enem_skills").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function bulkUpsertEnemSkills(
  items: EnemSkillSeedItem[]
): Promise<number> {
  if (items.length === 0) return 0;
  const supabase = requireSupabase();

  const payload = items.map((item) => ({
    area: item.area,
    code: item.code.trim().toUpperCase(),
    competency: item.competency.trim().toUpperCase() || "C1",
    description: item.description.trim(),
  }));

  const { error } = await supabase
    .from("enem_skills")
    .upsert(payload, { onConflict: "area,code" });

  if (error) throw new Error(error.message);
  return payload.length;
}

export async function seedBaseEnemMatrix(
  onlyArea?: EnemArea
): Promise<number> {
  const subset = onlyArea
    ? ENEM_BASE_MATRIX.filter((item) => item.area === onlyArea)
    : ENEM_BASE_MATRIX;
  return bulkUpsertEnemSkills(subset);
}

const VALID_AREAS: EnemArea[] = ["linguagens", "humanas", "natureza", "matematica"];

/**
 * Aceita JSON (array de objetos) OU lista rápida linha por linha:
 * Exemplo linha por linha:
 *   H1 | C1 | Descrição da habilidade
 *   H2 ; C1 ; Outra descrição
 */
export function parseBatchEnemInput(
  rawText: string,
  defaultArea: EnemArea
): { items: EnemSkillSeedItem[]; error?: string } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { items: [], error: "Cole o conteúdo em JSON ou lista linha por linha." };
  }

  // Tentativa 1: JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const items: EnemSkillSeedItem[] = [];

      for (const entry of list) {
        if (!entry || typeof entry !== "object") continue;
        const row = entry as Record<string, unknown>;
        const areaRaw = String(row.area ?? defaultArea).toLowerCase().trim();
        const area = VALID_AREAS.includes(areaRaw as EnemArea)
          ? (areaRaw as EnemArea)
          : defaultArea;
        const code = String(row.code ?? row.codigo ?? "").trim().toUpperCase();
        const competency = String(
          row.competency ?? row.competencia ?? "C1"
        )
          .trim()
          .toUpperCase();
        const description = String(
          row.description ?? row.descricao ?? ""
        ).trim();

        if (code && description) {
          items.push({ area, code, competency, description });
        }
      }

      if (items.length === 0) {
        return {
          items: [],
          error:
            "O JSON foi lido, mas nenhum item válido (com code e description) foi encontrado.",
        };
      }
      return { items };
    } catch {
      return {
        items: [],
        error: "JSON inválido. Verifique as aspas, chaves e vírgulas.",
      };
    }
  }

  // Tentativa 2: Lista rápida linha por linha
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: EnemSkillSeedItem[] = [];
  for (const line of lines) {
    const parts = line.includes("|")
      ? line.split("|").map((p) => p.trim())
      : line.includes(";")
      ? line.split(";").map((p) => p.trim())
      : line.split("\t").map((p) => p.trim());

    if (parts.length >= 3) {
      const [first, second, ...rest] = parts;
      // Permite opcionalmente 4 colunas: area | H1 | C1 | Descrição
      if (
        parts.length >= 4 &&
        VALID_AREAS.includes(first.toLowerCase() as EnemArea)
      ) {
        const [, code, comp, ...descParts] = parts;
        const desc = descParts.join(" | ").trim();
        if (code && desc) {
          items.push({
            area: first.toLowerCase() as EnemArea,
            code: code.toUpperCase(),
            competency: comp.toUpperCase() || "C1",
            description: desc,
          });
        }
      } else {
        const desc = rest.join(" | ").trim();
        if (first && desc) {
          items.push({
            area: defaultArea,
            code: first.toUpperCase(),
            competency: second.toUpperCase() || "C1",
            description: desc,
          });
        }
      }
    } else if (parts.length === 2) {
      const [code, desc] = parts;
      if (code && desc) {
        items.push({
          area: defaultArea,
          code: code.toUpperCase(),
          competency: "C1",
          description: desc,
        });
      }
    }
  }

  if (items.length === 0) {
    return {
      items: [],
      error:
        "Nenhuma linha reconhecida. Use o formato: H1 | C1 | Descrição da habilidade",
    };
  }

  return { items };
}
