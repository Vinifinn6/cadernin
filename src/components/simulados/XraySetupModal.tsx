"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, SpinnerGap, X } from "@phosphor-icons/react";
import type { EnemArea, MockTaggingMode } from "@/types/database";

export interface XrayGridConfig {
  slots: { questionNumber: number; area: EnemArea }[];
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

type PresetSize = "45" | "90" | "180" | "custom";
type DayPreset = "day1" | "day2";

const AREA_OPTIONS: { id: EnemArea; label: string; short: string }[] = [
  { id: "linguagens", label: "Linguagens (LC)", short: "LC" },
  { id: "humanas", label: "Humanas (CH)", short: "CH" },
  { id: "natureza", label: "Natureza (CN)", short: "CN" },
  { id: "matematica", label: "Matemática (MT)", short: "MT" },
];

export function buildXraySlots(params: {
  preset: PresetSize;
  singleArea: EnemArea;
  dayPreset: DayPreset;
  customTotal: number;
  customStartNumber: number;
  customAreas: EnemArea[];
}): XrayGridConfig {
  if (params.preset === "180") {
    const slots: { questionNumber: number; area: EnemArea }[] = [];
    for (let q = 1; q <= 45; q++) slots.push({ questionNumber: q, area: "linguagens" });
    for (let q = 46; q <= 90; q++) slots.push({ questionNumber: q, area: "humanas" });
    for (let q = 91; q <= 135; q++) slots.push({ questionNumber: q, area: "natureza" });
    for (let q = 136; q <= 180; q++) slots.push({ questionNumber: q, area: "matematica" });
    return { slots };
  }

  if (params.preset === "90") {
    const slots: { questionNumber: number; area: EnemArea }[] = [];
    if (params.dayPreset === "day1") {
      for (let q = 1; q <= 45; q++) slots.push({ questionNumber: q, area: "linguagens" });
      for (let q = 46; q <= 90; q++) slots.push({ questionNumber: q, area: "humanas" });
    } else {
      for (let q = 91; q <= 135; q++) slots.push({ questionNumber: q, area: "natureza" });
      for (let q = 136; q <= 180; q++) slots.push({ questionNumber: q, area: "matematica" });
    }
    return { slots };
  }

  if (params.preset === "45") {
    const startMap: Record<EnemArea, number> = {
      linguagens: 1,
      humanas: 46,
      natureza: 91,
      matematica: 136,
    };
    const start = startMap[params.singleArea];
    const slots = Array.from({ length: 45 }, (_, idx) => ({
      questionNumber: start + idx,
      area: params.singleArea,
    }));
    return { slots };
  }

  // Personalizado: divide igualmente entre as áreas selecionadas
  const total = Math.max(1, Math.min(250, Math.round(params.customTotal || 20)));
  const start = Math.max(1, Math.round(params.customStartNumber || 1));
  const areas =
    params.customAreas.length > 0 ? params.customAreas : (["matematica"] as EnemArea[]);
  const perArea = Math.ceil(total / areas.length);

  const slots = Array.from({ length: total }, (_, idx) => {
    const areaIdx = Math.min(areas.length - 1, Math.floor(idx / perArea));
    return {
      questionNumber: start + idx,
      area: areas[areaIdx],
    };
  });

  return { slots };
}

interface XraySetupModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (params: {
    title: string;
    date: string;
    tagging_mode: MockTaggingMode;
    gridConfig: XrayGridConfig;
  }) => Promise<void>;
}

export function XraySetupModal({
  open,
  onClose,
  onCreate,
}: XraySetupModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getTodayIso());
  const [preset, setPreset] = useState<PresetSize>("90");
  const [singleArea, setSingleArea] = useState<EnemArea>("natureza");
  const [dayPreset, setDayPreset] = useState<DayPreset>("day2");
  const [customTotal, setCustomTotal] = useState(30);
  const [customStartNumber, setCustomStartNumber] = useState(1);
  const [customAreas, setCustomAreas] = useState<EnemArea[]>(["matematica"]);
  const [taggingMode, setTaggingMode] = useState<MockTaggingMode>("both");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(getTodayIso());
    setPreset("90");
    setDayPreset("day2");
    setSingleArea("natureza");
    setCustomTotal(30);
    setCustomStartNumber(1);
    setCustomAreas(["matematica"]);
    setTaggingMode("both");
    setError(null);
  }, [open]);

  if (!open) return null;

  const toggleCustomArea = (area: EnemArea) => {
    setCustomAreas((prev) => {
      if (prev.includes(area)) {
        return prev.length > 1 ? prev.filter((a) => a !== area) : prev;
      }
      return [...prev, area];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Dê um nome ao simulado (ex: ENEM 2024 — Dia 2).");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const gridConfig = buildXraySlots({
        preset,
        singleArea,
        dayPreset,
        customTotal,
        customStartNumber,
        customAreas,
      });

      await onCreate({
        title: title.trim(),
        date,
        tagging_mode: taggingMode,
        gridConfig,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao criar simulado Raio-X."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-5"
        style={{ boxShadow: "var(--shadow-tactile)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.06em] text-[var(--accent-slate)]">
              Modo Raio-X · Cartão-Resposta
            </p>
            <h2 className="font-editorial text-[24px] leading-tight text-[var(--text-primary)]">
              Configurar novo simulado
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X size={18} weight="light" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Título e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <label className="sm:col-span-8 block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                Nome da prova
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: ENEM 2024 — Dia 2, Bernoulli #02..."
                autoFocus
                required
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[14px] text-[var(--text-primary)]"
              />
            </label>
            <label className="sm:col-span-4 block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                Data
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13.5px] text-[var(--text-primary)]"
              />
            </label>
          </div>

          {/* Total de questões */}
          <div className="space-y-2.5">
            <span className="block text-[12px] font-medium text-[var(--text-secondary)]">
              Total de questões
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: "45", label: "45 questões", sub: "1 área" },
                  { id: "90", label: "90 questões", sub: "1 dia ENEM" },
                  { id: "180", label: "180 questões", sub: "ENEM completo" },
                  { id: "custom", label: "Personalizado", sub: "Livre" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreset(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    preset === opt.id
                      ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)] text-[var(--accent-sage)]"
                      : "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <p className="font-mono-tabular text-[13px] font-medium">
                    {opt.label}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>

            {/* Sub-opções conforme o tamanho */}
            {preset === "90" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDayPreset("day1")}
                  className={`p-3 rounded-xl border text-left text-[12.5px] cursor-pointer ${
                    dayPreset === "day1"
                      ? "bg-[var(--bg-card)] border-[var(--accent-slate)] text-[var(--text-primary)] font-medium"
                      : "bg-[var(--bg-subtle)]/60 border-[var(--border-hairline)] text-[var(--text-secondary)]"
                  }`}
                >
                  Dia 1 · Linguagens (1–45) + Humanas (46–90)
                </button>
                <button
                  type="button"
                  onClick={() => setDayPreset("day2")}
                  className={`p-3 rounded-xl border text-left text-[12.5px] cursor-pointer ${
                    dayPreset === "day2"
                      ? "bg-[var(--bg-card)] border-[var(--accent-slate)] text-[var(--text-primary)] font-medium"
                      : "bg-[var(--bg-subtle)]/60 border-[var(--border-hairline)] text-[var(--text-secondary)]"
                  }`}
                >
                  Dia 2 · Natureza (91–135) + Matemática (136–180)
                </button>
              </div>
            )}

            {preset === "45" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {AREA_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSingleArea(a.id)}
                    className={`px-3 py-2 rounded-lg border text-[12px] cursor-pointer ${
                      singleArea === a.id
                        ? "bg-[var(--bg-card)] border-[var(--accent-slate)] text-[var(--text-primary)] font-medium"
                        : "bg-[var(--bg-subtle)]/60 border-[var(--border-hairline)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {preset === "custom" && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-[11.5px] text-[var(--text-secondary)]">
                      Quantidade de questões
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={250}
                      value={customTotal}
                      onChange={(e) =>
                        setCustomTotal(Number.parseInt(e.target.value, 10) || 1)
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] font-mono-tabular text-[13.5px]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11.5px] text-[var(--text-secondary)]">
                      Número inicial
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={customStartNumber}
                      onChange={(e) =>
                        setCustomStartNumber(
                          Number.parseInt(e.target.value, 10) || 1
                        )
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] font-mono-tabular text-[13.5px]"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11.5px] text-[var(--text-secondary)] block">
                    Áreas envolvidas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {AREA_OPTIONS.map((a) => {
                      const active = customAreas.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleCustomArea(a.id)}
                          className={`px-3 py-1 rounded-full text-[12px] border cursor-pointer ${
                            active
                              ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] border-transparent font-medium"
                              : "bg-[var(--bg-card)] border-[var(--border-hairline)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modo de Classificação */}
          <div className="space-y-2">
            <span className="block text-[12px] font-medium text-[var(--text-secondary)]">
              Como deseja classificar as questões?
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "topic",
                    label: "Matéria / Assunto",
                    desc: "Vincula ao seu Cronograma",
                  },
                  {
                    id: "enem_skill",
                    label: "Habilidade ENEM",
                    desc: "Vincula a H1–H30",
                  },
                  {
                    id: "both",
                    label: "Ambos",
                    desc: "Assunto + Habilidade ENEM",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTaggingMode(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    taggingMode === opt.id
                      ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)] text-[var(--accent-sage)]"
                      : "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <p className="text-[13px] font-medium">{opt.label}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[12.5px] text-[var(--accent-terracotta)]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-60"
            >
              {creating ? (
                <SpinnerGap size={15} weight="light" className="animate-spin" />
              ) : (
                <ArrowRight size={15} weight="light" />
              )}
              <span>
                {creating ? "Criando grade..." : "Abrir Cartão-Resposta"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
