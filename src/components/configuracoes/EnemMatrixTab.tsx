"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SpinnerGap,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { ENEM_AREA_META } from "@/lib/enem-matrix-seed";
import {
  bulkUpsertEnemSkills,
  deleteEnemSkill,
  fetchEnemSkills,
  parseBatchEnemInput,
  seedBaseEnemMatrix,
  sortEnemSkills,
  upsertEnemSkill,
} from "@/lib/enem-service";
import type { EnemArea, EnemSkill } from "@/types/database";

const AREAS: EnemArea[] = ["linguagens", "humanas", "natureza", "matematica"];

export function EnemMatrixTab() {
  const [skills, setSkills] = useState<EnemSkill[]>([]);
  const [activeArea, setActiveArea] = useState<EnemArea>("linguagens");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Adicionar 1 habilidade
  const [newCode, setNewCode] = useState("");
  const [newComp, setNewComp] = useState("C1");
  const [newDesc, setNewDesc] = useState("");
  const [addingSingle, setAddingSingle] = useState(false);

  // Editar inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editComp, setEditComp] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Importação em lote
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [importingBatch, setImportingBatch] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchEnemSkills();
      setSkills(list);
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Erro ao carregar habilidades do ENEM.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const countsByArea = useMemo(() => {
    const counts: Record<EnemArea, number> = {
      linguagens: 0,
      humanas: 0,
      natureza: 0,
      matematica: 0,
    };
    for (const s of skills) {
      counts[s.area] = (counts[s.area] ?? 0) + 1;
    }
    return counts;
  }, [skills]);

  const visibleSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortEnemSkills(
      skills.filter((s) => {
        if (s.area !== activeArea) return false;
        if (!q) return true;
        return (
          s.code.toLowerCase().includes(q) ||
          s.competency.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        );
      })
    );
  }, [skills, activeArea, search]);

  const batchPreview = useMemo(() => {
    if (!batchText.trim()) return null;
    return parseBatchEnemInput(batchText, activeArea);
  }, [batchText, activeArea]);

  const handleSeedAll = async () => {
    setSeeding(true);
    setNotice(null);
    try {
      const count = await seedBaseEnemMatrix();
      await loadSkills();
      setNotice({
        type: "success",
        text: `Estrutura base carregada: ${count} habilidades (H1–H30 nas 4 áreas). Você pode editar qualquer descrição quando quiser.`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Erro ao carregar estrutura base.",
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDesc.trim()) return;
    setAddingSingle(true);
    setNotice(null);
    try {
      const saved = await upsertEnemSkill({
        area: activeArea,
        code: newCode,
        competency: newComp,
        description: newDesc,
      });
      setSkills((prev) => {
        const filtered = prev.filter((item) => item.id !== saved.id);
        return sortEnemSkills([...filtered, saved]);
      });
      setNewCode("");
      setNewDesc("");
      setNotice({
        type: "success",
        text: `Habilidade ${saved.code} salva em ${ENEM_AREA_META[activeArea].shortLabel}.`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Erro ao adicionar habilidade.",
      });
    } finally {
      setAddingSingle(false);
    }
  };

  const startEdit = (skill: EnemSkill) => {
    setEditingId(skill.id);
    setEditCode(skill.code);
    setEditComp(skill.competency);
    setEditDesc(skill.description);
  };

  const commitEdit = async (skill: EnemSkill) => {
    try {
      const updated = await upsertEnemSkill({
        id: skill.id,
        area: skill.area,
        code: editCode,
        competency: editComp,
        description: editDesc,
      });
      setSkills((prev) =>
        sortEnemSkills(prev.map((s) => (s.id === updated.id ? updated : s)))
      );
      setEditingId(null);
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Erro ao editar habilidade.",
      });
    }
  };

  const handleDelete = async (skill: EnemSkill) => {
    setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    try {
      await deleteEnemSkill(skill.id);
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Erro ao excluir habilidade.",
      });
      void loadSkills();
    }
  };

  const handleBatchImport = async () => {
    if (!batchPreview || batchPreview.items.length === 0) return;
    setImportingBatch(true);
    setNotice(null);
    try {
      const count = await bulkUpsertEnemSkills(batchPreview.items);
      await loadSkills();
      setBatchText("");
      setBatchOpen(false);
      setNotice({
        type: "success",
        text: `${count} habilidades importadas/atualizadas com sucesso.`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        text:
          err instanceof Error ? err.message : "Erro ao importar em lote.",
      });
    } finally {
      setImportingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Ações em Lote */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
              Matriz de Competências e Habilidades do ENEM
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-[560px] leading-relaxed">
              Cadastre ou personalize as habilidades (H1 a H30) usadas na
              correção de simulados. Você pode preencher tudo com 1 clique e
              editar qualquer texto depois.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeedAll()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[12.5px] font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {seeding ? (
                <SpinnerGap size={15} weight="light" className="animate-spin" />
              ) : (
                <DownloadSimple size={15} weight="light" />
              )}
              <span>
                {seeding
                  ? "Carregando 120 habilidades..."
                  : "Carregar estrutura base ENEM (H1–H30 por área)"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBatchOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[12.5px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <UploadSimple size={15} weight="light" />
              <span>Importar em lote</span>
            </button>
          </div>
        </div>

        {notice && (
          <div
            className={`px-3.5 py-2.5 rounded-xl text-[12.5px] flex items-center justify-between gap-3 ${
              notice.type === "error"
                ? "bg-[var(--accent-terracotta-soft)] text-[var(--accent-terracotta)]"
                : "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]"
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="cursor-pointer"
              aria-label="Fechar aviso"
            >
              <X size={14} weight="light" />
            </button>
          </div>
        )}

        {/* Painel de Importação em Lote */}
        {batchOpen && (
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                Importação rápida ({ENEM_AREA_META[activeArea].shortLabel} ou
                JSON multi-área)
              </p>
              <button
                type="button"
                onClick={() => setBatchOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={15} weight="light" />
              </button>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Cole uma lista no formato{" "}
              <code className="font-mono-tabular px-1 py-0.5 rounded bg-[var(--bg-card)]">
                H1 | C1 | Descrição da habilidade
              </code>{" "}
              (uma por linha) ou um array JSON com{" "}
              <code className="font-mono-tabular px-1 py-0.5 rounded bg-[var(--bg-card)]">
                {`[{"area":"matematica","code":"H1","competency":"C1","description":"..."}]`}
              </code>
              .
            </p>
            <textarea
              rows={5}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={`H1 | C1 | Reconhecer significados e representações dos números.\nH2 | C1 | Identificar padrões numéricos ou princípios de contagem.`}
              className="w-full p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[12px] text-[var(--text-primary)]"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px]">
                {batchPreview?.error ? (
                  <span className="text-[var(--accent-terracotta)]">
                    {batchPreview.error}
                  </span>
                ) : batchPreview && batchPreview.items.length > 0 ? (
                  <span className="text-[var(--accent-sage)] font-medium">
                    {batchPreview.items.length} habilidades prontas para
                    importar.
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">
                    Aguardando conteúdo...
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={
                  importingBatch ||
                  !batchPreview ||
                  batchPreview.items.length === 0
                }
                onClick={() => void handleBatchImport()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              >
                <Check size={14} weight="light" />
                <span>
                  {importingBatch ? "Importando..." : "Confirmar importação"}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Seletor das 4 Áreas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {AREAS.map((area) => {
          const meta = ENEM_AREA_META[area];
          const active = activeArea === area;
          return (
            <button
              key={area}
              type="button"
              onClick={() => setActiveArea(area)}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? "bg-[var(--bg-card)] border-[var(--accent-sage)]"
                  : "bg-[var(--bg-card)]/60 border-[var(--border-hairline)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  {meta.shortLabel}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: meta.accent }}
                />
              </div>
              <p className="font-mono-tabular text-[11.5px] text-[var(--text-muted)] mt-1">
                {countsByArea[area]} cadastradas
              </p>
            </button>
          );
        })}
      </div>

      {/* Área Ativa: Adicionar + Buscar + Lista */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-5 sm:p-6 border border-[var(--border-hairline)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-editorial text-[20px] text-[var(--text-primary)]">
              {ENEM_AREA_META[activeArea].label}
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <MagnifyingGlass
              size={15}
              weight="light"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar H1, C2 ou palavra..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[12.5px] text-[var(--text-primary)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] cursor-pointer"
              >
                <X size={13} weight="light" />
              </button>
            )}
          </div>
        </div>

        {/* Adicionar nova habilidade individual */}
        <form
          onSubmit={(e) => void handleAddSingle(e)}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]/70"
        >
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="H1"
            maxLength={10}
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13px] uppercase text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={newComp}
            onChange={(e) => setNewComp(e.target.value)}
            placeholder="C1"
            maxLength={12}
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13px] uppercase text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descrição da habilidade..."
            className="sm:col-span-6 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13px] text-[var(--text-primary)]"
          />
          <button
            type="submit"
            disabled={addingSingle || !newCode.trim() || !newDesc.trim()}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
          >
            <Plus size={14} weight="light" />
            <span>Salvar</span>
          </button>
        </form>

        {/* Tabela / Lista de habilidades */}
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <SpinnerGap size={16} weight="light" className="animate-spin" />
            <span>Carregando matriz...</span>
          </div>
        ) : visibleSkills.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-[14px] text-[var(--text-secondary)]">
              {countsByArea[activeArea] === 0
                ? `Nenhuma habilidade cadastrada em ${ENEM_AREA_META[activeArea].shortLabel} ainda.`
                : "Nenhuma habilidade encontrada para essa busca."}
            </p>
            {countsByArea[activeArea] === 0 && (
              <p className="text-[12.5px] text-[var(--text-muted)]">
                Clique em “Carregar estrutura base ENEM (H1–H30 por área)” acima
                para preencher automaticamente.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {visibleSkills.map((skill) => {
              const isEditing = editingId === skill.id;

              if (isEditing) {
                return (
                  <div
                    key={skill.id}
                    className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--accent-slate)] font-mono-tabular text-[12.5px] uppercase"
                    />
                    <input
                      type="text"
                      value={editComp}
                      onChange={(e) => setEditComp(e.target.value)}
                      className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--accent-slate)] font-mono-tabular text-[12.5px] uppercase"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="sm:col-span-6 px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--accent-slate)] text-[13px]"
                    />
                    <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void commitEdit(skill)}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-sage)] text-[#FAF8F5] text-[12px] font-medium cursor-pointer"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                      >
                        <X size={14} weight="light" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={skill.id}
                  className="py-3 flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="font-mono-tabular text-[11.5px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] shrink-0">
                      {skill.code}
                    </span>
                    <span className="font-mono-tabular text-[11px] px-1.5 py-0.5 rounded bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] shrink-0">
                      {skill.competency}
                    </span>
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                      {skill.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(skill)}
                      aria-label={`Editar ${skill.code}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <PencilSimple size={14} weight="light" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(skill)}
                      aria-label={`Excluir ${skill.code}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta-soft)] cursor-pointer"
                    >
                      <Trash size={14} weight="light" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
