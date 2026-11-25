"use client";

import React, { useEffect, useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import {
  getSubjectIcon,
  SUBJECT_COLOR_OPTIONS,
  SUBJECT_ICON_OPTIONS,
} from "@/lib/subject-icons";
import type { Subject } from "@/types/database";

interface SubjectFormModalProps {
  open: boolean;
  editingSubject: Subject | null;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    color: string;
    icon_name: string;
  }) => Promise<void>;
}

export function SubjectFormModal({
  open,
  editingSubject,
  onClose,
  onSubmit,
}: SubjectFormModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUBJECT_COLOR_OPTIONS[0].hex);
  const [iconName, setIconName] = useState("BookOpen");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingSubject) {
      setName(editingSubject.name);
      setColor(editingSubject.color || SUBJECT_COLOR_OPTIONS[0].hex);
      setIconName(editingSubject.icon_name || "BookOpen");
    } else {
      setName("");
      setColor(SUBJECT_COLOR_OPTIONS[0].hex);
      setIconName("BookOpen");
    }
    setError(null);
  }, [open, editingSubject]);

  if (!open) return null;

  const PreviewIcon = getSubjectIcon(iconName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Digite o nome da matéria.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        color,
        icon_name: iconName,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar a matéria."
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
      aria-labelledby="subject-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-[540px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] p-6 space-y-5"
        style={{ boxShadow: "var(--shadow-tactile)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <h2
            id="subject-modal-title"
            className="font-editorial text-[24px] leading-tight text-[var(--text-primary)]"
          >
            {editingSubject ? "Editar matéria" : "Nova matéria"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X size={18} weight="light" />
          </button>
        </div>

        {/* Prévia Editorial */}
        <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center gap-3.5">
          <span
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${color}1F`,
              color,
            }}
          >
            <PreviewIcon size={23} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-editorial text-[20px] leading-tight text-[var(--text-primary)] truncate">
              {name.trim() || "Nome da matéria"}
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border-hairline)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: "42%", backgroundColor: color }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Nome */}
          <label className="block space-y-1.5">
            <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
              Nome da matéria
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Química, Física, História do Brasil..."
              autoFocus
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[14px] text-[var(--text-primary)]"
            />
          </label>

          {/* Cor Fosca */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                Cor da matéria (pigmentos foscos)
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] uppercase">
                {color}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {SUBJECT_COLOR_OPTIONS.map((opt) => {
                const selected =
                  color.toLowerCase() === opt.hex.toLowerCase();
                return (
                  <button
                    key={opt.hex}
                    type="button"
                    onClick={() => setColor(opt.hex)}
                    title={opt.label}
                    aria-label={opt.label}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                      selected
                        ? "ring-2 ring-offset-2 ring-offset-[var(--bg-card)] ring-[var(--text-primary)] scale-105"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: opt.hex }}
                  >
                    {selected && (
                      <Check size={14} weight="bold" className="text-white" />
                    )}
                  </button>
                );
              })}

              {/* Cor personalizada opcional */}
              <label
                title="Escolher outra cor"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[11.5px] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
                />
                <span>Outra</span>
              </label>
            </div>
          </div>

          {/* Seletor de Ícones Phosphor */}
          <div className="space-y-2">
            <span className="text-[12.5px] font-medium text-[var(--text-secondary)] block">
              Ícone da matéria
            </span>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {SUBJECT_ICON_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = iconName === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setIconName(opt.name)}
                    title={opt.label}
                    aria-label={opt.label}
                    className={`h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                      active
                        ? "border-transparent"
                        : "border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: `${color}1F`,
                            color,
                            borderColor: `${color}66`,
                          }
                        : undefined
                    }
                  >
                    <Icon size={20} weight={active ? "duotone" : "light"} />
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-[12.5px] text-[var(--accent-terracotta)]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving
                ? "Salvando..."
                : editingSubject
                ? "Salvar alterações"
                : "Criar matéria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
