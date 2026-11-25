"use client";

import React from "react";

export interface TriAndEssayValues {
  tri_lc: string;
  tri_ch: string;
  tri_cn: string;
  tri_mt: string;
  essay_c1: string;
  essay_c2: string;
  essay_c3: string;
  essay_c4: string;
  essay_c5: string;
  essay_total: string;
  notes: string;
}

export function parseNullableFloat(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseNullableInt(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

interface ExamMetaFormFieldsProps {
  values: TriAndEssayValues;
  onChange: (next: TriAndEssayValues) => void;
}

export function ExamMetaFormFields({
  values,
  onChange,
}: ExamMetaFormFieldsProps) {
  const setField = (key: keyof TriAndEssayValues, val: string) => {
    const next = { ...values, [key]: val };

    // Se o usuário editou alguma competência C1–C5, soma automaticamente no total da redação
    if (
      key === "essay_c1" ||
      key === "essay_c2" ||
      key === "essay_c3" ||
      key === "essay_c4" ||
      key === "essay_c5"
    ) {
      const comps = [
        next.essay_c1,
        next.essay_c2,
        next.essay_c3,
        next.essay_c4,
        next.essay_c5,
      ].map(parseNullableInt);
      const hasAny = comps.some((c) => c !== null);
      if (hasAny) {
        const sum = comps.reduce<number>(
          (acc, c) => acc + Math.min(200, Math.max(0, c ?? 0)),
          0
        );
        next.essay_total = String(Math.min(1000, sum));
      }
    }

    onChange(next);
  };

  return (
    <div className="space-y-5">
      {/* Notas TRI Opcionais */}
      <div className="p-4 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            Notas TRI (opcional — pode preencher depois)
          </span>
          <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
            Ex: 684.5
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { key: "tri_lc", label: "TRI Linguagens" },
              { key: "tri_ch", label: "TRI Humanas" },
              { key: "tri_cn", label: "TRI Natureza" },
              { key: "tri_mt", label: "TRI Matemática" },
            ] as const
          ).map((item) => (
            <label key={item.key} className="block space-y-1">
              <span className="text-[11.5px] text-[var(--text-secondary)] block">
                {item.label}
              </span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={1200}
                value={values[item.key]}
                onChange={(e) => setField(item.key, e.target.value)}
                placeholder="Pendente"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13.5px] text-[var(--text-primary)]"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Redação — Total + 5 Competências ENEM */}
      <div className="p-4 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            Redação ENEM (opcional)
          </span>
          <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
            C1 a C5 (0–200) somam automaticamente
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {(
            [
              { key: "essay_c1", label: "C1" },
              { key: "essay_c2", label: "C2" },
              { key: "essay_c3", label: "C3" },
              { key: "essay_c4", label: "C4" },
              { key: "essay_c5", label: "C5" },
            ] as const
          ).map((comp) => (
            <label key={comp.key} className="block space-y-1">
              <span className="font-mono-tabular text-[11px] text-[var(--text-secondary)] block">
                {comp.label}
              </span>
              <input
                type="number"
                step={20}
                min={0}
                max={200}
                value={values[comp.key]}
                onChange={(e) => setField(comp.key, e.target.value)}
                placeholder="0–200"
                className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13px] text-[var(--text-primary)]"
              />
            </label>
          ))}

          <label className="block space-y-1">
            <span className="font-mono-tabular text-[11px] font-medium text-[var(--accent-sage)] block">
              Total
            </span>
            <input
              type="number"
              step={20}
              min={0}
              max={1000}
              value={values.essay_total}
              onChange={(e) => setField("essay_total", e.target.value)}
              placeholder="0–1000"
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--accent-sage-soft)] border border-[var(--accent-sage)]/35 focus:border-[var(--accent-sage)] focus:outline-none font-mono-tabular text-[13.5px] font-semibold text-[var(--accent-sage)]"
            />
          </label>
        </div>
      </div>

      {/* Observações */}
      <label className="block space-y-1.5">
        <span className="text-[12px] font-medium text-[var(--text-secondary)]">
          Observações sobre a prova (opcional)
        </span>
        <textarea
          rows={2}
          value={values.notes}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="Ex: Tempo apertado em Natureza, boa gestão em Humanas..."
          className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[13.5px] text-[var(--text-primary)]"
        />
      </label>
    </div>
  );
}
