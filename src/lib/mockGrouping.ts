import type { EnemArea, MockExam, MockQuestion } from "@/types/database";

const ALL_AREAS: EnemArea[] = [
  "linguagens",
  "humanas",
  "natureza",
  "matematica",
];

const AREA_SHORT: Record<EnemArea, string> = {
  linguagens: "LC",
  humanas: "CH",
  natureza: "CN",
  matematica: "MT",
};

/**
 * Remove acentos, normaliza espaços e elimina sufixos comuns de divisão em dias/partes
 * para agrupar provas como "ENEM 2024", "ENEM 2024 - 1º Dia" e "ENEM 2024 (Dia 2)".
 */
export function normalizeMockGroupKey(title: string): string {
  const withoutAccents = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Remove sufixos entre parênteses ou após separadores (-, –, —, /, |, :)
  const suffixPattern =
    /(?:[\s\-–—/|:(]+)?(?:\b(?:dia\s*[12]|[12][º°o]?\s*dia|d[12]|parte\s*[12]|p[12]|primeiro\s*dia|segundo\s*dia)\b)\s*\)?\s*$/i;

  let cleaned = withoutAccents.trim();
  // Aplica até 2 vezes caso haja combinações como "(Dia 1) - P1"
  for (let i = 0; i < 2; i++) {
    const next = cleaned
      .replace(suffixPattern, "")
      .replace(/[\s\-–—/|:()]+$/g, "")
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned.replace(/\s+/g, " ").trim() || withoutAccents.trim();
}

/**
 * Gera um título base legível preservando a capitalização original sem o sufixo de dia/parte.
 */
export function cleanMockDisplayTitle(title: string): string {
  const suffixPattern =
    /(?:[\s\-–—/|:(]+)?(?:\b(?:dia\s*[12]|[12][º°o]?\s*dia|d[12]|parte\s*[12]|p[12]|primeiro\s*dia|segundo\s*dia)\b)\s*\)?\s*$/i;

  let cleaned = title.trim();
  for (let i = 0; i < 2; i++) {
    const next = cleaned
      .replace(suffixPattern, "")
      .replace(/[\s\-–—/|:()]+$/g, "")
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned || title.trim();
}

export interface MockExamPart {
  exam: MockExam;
  questions: MockQuestion[];
  areas: EnemArea[];
  shortLabel: string;
}

export interface GroupedMockExam {
  id: string;
  groupKey: string;
  displayTitle: string;
  date: string; // Data mais recente entre as partes
  mode: "express" | "xray";
  isGrouped: boolean;
  totalQuestions: number; // Total de questões registradas no Raio-X (0 se Express puro)
  rawCorrect: number;
  realCorrect: number;
  guessesCount: number;
  hasDetailedQuestions: boolean;
  scoresByArea: {
    score_lc: number | null;
    score_ch: number | null;
    score_cn: number | null;
    score_mt: number | null;
  };
  triByArea: {
    tri_lc: number | null;
    tri_ch: number | null;
    tri_cn: number | null;
    tri_mt: number | null;
  };
  essay: {
    essay_total: number | null;
    essay_c1: number | null;
    essay_c2: number | null;
    essay_c3: number | null;
    essay_c4: number | null;
    essay_c5: number | null;
  };
  parts: MockExamPart[];
  allQuestions: MockQuestion[];
}

function detectExamAreas(exam: MockExam, questions: MockQuestion[]): EnemArea[] {
  const areaSet = new Set<EnemArea>();
  for (const q of questions) {
    areaSet.add(q.area);
  }
  if (exam.score_lc !== null || exam.tri_lc !== null) areaSet.add("linguagens");
  if (exam.score_ch !== null || exam.tri_ch !== null) areaSet.add("humanas");
  if (exam.score_cn !== null || exam.tri_cn !== null) areaSet.add("natureza");
  if (exam.score_mt !== null || exam.tri_mt !== null) areaSet.add("matematica");

  return ALL_AREAS.filter((a) => areaSet.has(a));
}

function areasCollide(a: EnemArea[], b: EnemArea[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setA = new Set(a);
  return b.some((area) => setA.has(area));
}

function sortOrderForPart(part: { areas: EnemArea[]; exam: MockExam }): number {
  if (part.areas.includes("linguagens") || part.areas.includes("humanas")) {
    return 1;
  }
  if (part.areas.includes("natureza") || part.areas.includes("matematica")) {
    return 2;
  }
  return 3;
}

function buildPartLabel(areas: EnemArea[], index: number): string {
  const codes = areas.map((a) => AREA_SHORT[a]).join("/");
  if (areas.length === 0) return `Parte ${index + 1}`;

  const isDay1 =
    areas.every((a) => a === "linguagens" || a === "humanas");
  const isDay2 =
    areas.every((a) => a === "natureza" || a === "matematica");

  if (isDay1) return `Dia 1 (${codes})`;
  if (isDay2) return `Dia 2 (${codes})`;
  return `Parte ${index + 1} (${codes})`;
}

function pickFirstNonNull<T>(values: (T | null | undefined)[]): T | null {
  for (const v of values) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/**
 * Agrupa automaticamente simulados com a mesma chave normalizada de título
 * cujas áreas preenchidas sejam complementares (ex: Dia 1 LC/CH + Dia 2 CN/MT).
 * Camada pura de agregação em leitura: não altera nada no banco de dados.
 */
export function groupMockExams(
  exams: MockExam[],
  questions: MockQuestion[]
): GroupedMockExam[] {
  const questionsByExam = new Map<string, MockQuestion[]>();
  for (const q of questions) {
    const list = questionsByExam.get(q.mock_exam_id) ?? [];
    list.push(q);
    questionsByExam.set(q.mock_exam_id, list);
  }

  // Ordena por data decrescente para manter previsibilidade
  const sortedExams = [...exams].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );

  interface Bucket {
    groupKey: string;
    usedAreas: EnemArea[];
    rawParts: { exam: MockExam; questions: MockQuestion[]; areas: EnemArea[] }[];
  }

  const buckets: Bucket[] = [];

  for (const exam of sortedExams) {
    const examQuestions = questionsByExam.get(exam.id) ?? [];
    const examAreas = detectExamAreas(exam, examQuestions);
    const key = normalizeMockGroupKey(exam.title);

    // Procura um bucket com a mesma chave cujas áreas não colidam
    const compatible = buckets.find(
      (b) => b.groupKey === key && !areasCollide(b.usedAreas, examAreas)
    );

    if (compatible) {
      compatible.rawParts.push({ exam, questions: examQuestions, areas: examAreas });
      for (const a of examAreas) {
        if (!compatible.usedAreas.includes(a)) compatible.usedAreas.push(a);
      }
    } else {
      buckets.push({
        groupKey: key,
        usedAreas: [...examAreas],
        rawParts: [{ exam, questions: examQuestions, areas: examAreas }],
      });
    }
  }

  const grouped: GroupedMockExam[] = buckets.map((bucket) => {
    const orderedParts = [...bucket.rawParts].sort(
      (a, b) =>
        sortOrderForPart(a) - sortOrderForPart(b) ||
        a.exam.date.localeCompare(b.exam.date)
    );

    const parts: MockExamPart[] = orderedParts.map((p, idx) => ({
      exam: p.exam,
      questions: p.questions,
      areas: p.areas,
      shortLabel: buildPartLabel(p.areas, idx),
    }));

    const allQuestions = parts.flatMap((p) => p.questions);
    const hasDetailedQuestions = allQuestions.length > 0;
    const isXray = parts.some((p) => p.exam.mode === "xray");

    const score_lc = pickFirstNonNull(parts.map((p) => p.exam.score_lc));
    const score_ch = pickFirstNonNull(parts.map((p) => p.exam.score_ch));
    const score_cn = pickFirstNonNull(parts.map((p) => p.exam.score_cn));
    const score_mt = pickFirstNonNull(parts.map((p) => p.exam.score_mt));

    const tri_lc = pickFirstNonNull(parts.map((p) => p.exam.tri_lc));
    const tri_ch = pickFirstNonNull(parts.map((p) => p.exam.tri_ch));
    const tri_cn = pickFirstNonNull(parts.map((p) => p.exam.tri_cn));
    const tri_mt = pickFirstNonNull(parts.map((p) => p.exam.tri_mt));

    const essay_total = pickFirstNonNull(parts.map((p) => p.exam.essay_total));
    const essay_c1 = pickFirstNonNull(parts.map((p) => p.exam.essay_c1));
    const essay_c2 = pickFirstNonNull(parts.map((p) => p.exam.essay_c2));
    const essay_c3 = pickFirstNonNull(parts.map((p) => p.exam.essay_c3));
    const essay_c4 = pickFirstNonNull(parts.map((p) => p.exam.essay_c4));
    const essay_c5 = pickFirstNonNull(parts.map((p) => p.exam.essay_c5));

    let realCorrect = 0;
    let guessesCount = 0;
    let rawCorrect = 0;
    let totalQuestions = 0;

    if (hasDetailedQuestions) {
      totalQuestions = allQuestions.length;
      for (const q of allQuestions) {
        if (q.outcome === "real_correct") {
          realCorrect += 1;
        } else if (
          q.outcome === "guess_1" ||
          q.outcome === "guess_2" ||
          q.outcome === "guess_3"
        ) {
          guessesCount += 1;
        }
      }
      rawCorrect = realCorrect + guessesCount;
    } else {
      rawCorrect =
        (score_lc ?? 0) + (score_ch ?? 0) + (score_cn ?? 0) + (score_mt ?? 0);
    }

    // Data mais recente entre as partes
    const latestDate = parts.reduce(
      (latest, p) => (p.exam.date > latest ? p.exam.date : latest),
      parts[0].exam.date
    );

    const displayTitle =
      parts.length > 1
        ? cleanMockDisplayTitle(parts[0].exam.title)
        : parts[0].exam.title;

    return {
      id: parts.map((p) => p.exam.id).join("__"),
      groupKey: bucket.groupKey,
      displayTitle,
      date: latestDate,
      mode: isXray ? "xray" : "express",
      isGrouped: parts.length > 1,
      totalQuestions,
      rawCorrect,
      realCorrect,
      guessesCount,
      hasDetailedQuestions,
      scoresByArea: { score_lc, score_ch, score_cn, score_mt },
      triByArea: { tri_lc, tri_ch, tri_cn, tri_mt },
      essay: {
        essay_total,
        essay_c1,
        essay_c2,
        essay_c3,
        essay_c4,
        essay_c5,
      },
      parts,
      allQuestions,
    };
  });

  // Ordena grupos pela data mais recente
  return grouped.sort((a, b) => b.date.localeCompare(a.date));
}
