"use client";

import React, { useEffect, useState } from "react";
import { Check, SpinnerGap, X } from "@phosphor-icons/react";
import {
  ExamMetaFormFields,
  parseNullableFloat,
  parseNullableInt,
  type TriAndEssayValues,
} from "@/components/simulados/ExamMetaFormFields";
import type { MockExamInput } from "@/lib/mock-exams-service";
import type { MockExam } from "@/types/database";

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

interface ExpressExamModalProps {
  open: boolean;
  editingExam: MockExam | null;
  onClose: () => void;
  onSave: (payload: MockExamInput, existingId?: string) => Promise<void>;
}

export function ExpressExamModal({
  open,
  editingExam,
  onClose,
  onSave,
}: ExpressExamModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getTodayIso());
  const [scoreLc, setScoreLc] = useState("");
  const [scoreCh, setScoreCh] = useState("");
  const [scoreCn, setScoreCn] = useState("");
  const [scoreMt, setScoreMt] = useState("");
  const [meta, setMeta] = useState<TriAndEssayValues>({
    tri_lc: "",
    tri_ch: "",
    tri_cn: "",
    tri_mt: "",
    essay_c1: "",
    essay_c2: "",
    essay_c3: "",
    essay_c4: "",
    essay_c5: "",
    essay_total: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingExam) {
      setTitle(editingExam.title);
      setDate(editingExam.date);
      setScoreLc(editingExam.score_lc !== null ? String(editingExam.score_lc) : "");
      setScoreCh(editingExam.score_ch !== null ? String(editingExam.score_ch) : "");
      setScoreCn(editingExam.score_cn !== null ? String(editingExam.score_cn) : "");
      setScoreMt(editingExam.score_mt !== null ? String(editingExam.score_mt) : "");
      setMeta({
        tri_lc: editingExam.tri_lc !== null ? String(editingExam.tri_lc) : "",
        tri_ch: editingExam.tri_ch !== null ? String(editingExam.tri_ch) : "",
        tri_cn: editingExam.tri_cn !== null ? String(editingExam.tri_cn) : "",
        tri_mt: editingExam.tri_mt !== null ? String(editingExam.tri_mt) : "",
        essay_c1: editingExam.essay_c1 !== null ? String(editingExam.essay_c1) : "",
        essay_c2: editingExam.essay_c2 !== null ? String(editingExam.essay_c2) : "",
        essay_c3: editingExam.essay_c3 !== null ? String(editingExam.essay_c3) : "",
        essay_c4: editingExam.essay_c4 !== null ? String(editingExam.essay_c4) : "",
        essay_c5: editingExam.essay_c5 !== null ? String(editingExam.essay_c5) : "",
        essay_total:
          editingExam.essay_total !== null ? String(editingExam.essay_total) : "",
        notes: editingExam.notes ?? "",
      });
    } else {
      setTitle("");
      setDate(getTodayIso());
      setScoreLc("");
      setScoreCh("");
      setScoreCn("");
      setScoreMt("");
      setMeta({
        tri_lc: "",
        tri_ch: "",
        tri_cn: "",
        tri_mt: "",
        essay_c1: "",
        essay_c2: "",
        essay_c3: "",
        essay_c4: "",
        essay_c5: "",
        essay_total: "",
        notes: "",
      });
    }
    setError(null);
  }, [open, editingExam]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Digite o nome da prova ou simulado.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          date,
          mode: editingExam?.mode ?? "express",
          tagging_mode: editingExam?.tagging_mode ?? "topic",
          score_lc: parseNullableInt(scoreLc),
          score_ch: parseNullableInt(scoreCh),
          score_cn: parseNullableInt(scoreCn),
          score_mt: parseNullableInt(scoreMt),
          tri_lc: parseNullableFloat(meta.tri_lc),
          tri_ch: parseNullableFloat(meta.tri_ch),
          tri_cn: parseNullableFloat(meta.tri_cn),
          tri_mt: parseNullableFloat(meta.tri_mt),
          essay_c1: parseNullableInt(meta.essay_c1),
          essay_c2: parseNullableInt(meta.essay_c2),
          essay_c3: parseNullableInt(meta.essay_c3),
          essay_c4: parseNullableInt(meta.essay_c4),
          essay_c5: parseNullableInt(meta.essay_c5),
          essay_total: parseNullableInt(meta.essay_total),
          notes: meta.notes.trim() || null,
        },
        editingExam?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar simulado."
      );
    } finally {
      setSaving(false);
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
        className="relative z-10 w-full max-w-[680px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-5"
        style={{ boxShadow: "var(--shadow-tactile)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.06em] text-[var(--accent-sage)]">
              Modo Express
            </p>
            <h2 className="font-editorial text-[24px] leading-tight text-[var(--text-primary)]">
              {editingExam ? "Editar simulado" : "Novo simulado rápido"}
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
                Nome da prova / simulado
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: ENEM 2024 Oficial, SAS Simulado #03..."
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

          {/* Acertos por Área */}
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)]/70 border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                Acertos brutos por área
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                Deixe em branco as áreas que não fez
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Linguagens (LC)", value: scoreLc, set: setScoreLc },
                { label: "Humanas (CH)", value: scoreCh, set: setScoreCh },
                { label: "Natureza (CN)", value: scoreCn, set: setScoreCn },
                { label: "Matemática (MT)", value: scoreMt, set: setScoreMt },
              ].map((area) => (
                <label key={area.label} className="block space-y-1">
                  <span className="text-[11.5px] text-[var(--text-secondary)] block">
                    {area.label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={area.value}
                    onChange={(e) => area.set(e.target.value)}
                    placeholder="0–45"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[14px] text-[var(--text-primary)]"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* TRI + Redação C1–C5 + Notas */}
          <ExamMetaFormFields values={meta} onChange={setMeta} />

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
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <SpinnerGap size={15} weight="light" className="animate-spin" />
              ) : (
                <Check size={15} weight="light" />
              )}
              <span>
                {saving
                  ? "Salvando..."
                  : editingExam
                  ? "Salvar alterações"
                  : "Salvar simulado"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
