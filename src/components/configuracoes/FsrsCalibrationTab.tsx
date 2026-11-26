"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  Brain,
  Check,
  Info,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  FSRS_CALIBRATION_PRESETS,
  type FsrsCalibrationPreset,
} from "@/lib/fsrsEngine";
import { recalculateAllTopicsFsrs } from "@/lib/fsrs-service";

export function FsrsCalibrationTab() {
  const { profile, updateFsrsSettings } = useProfileTheme();
  const { showToast } = useToast();

  const [targetRetention, setTargetRetention] = useState<number>(
    profile.fsrs_target_retention
  );
  const [urgencyWeight, setUrgencyWeight] = useState<number>(
    profile.auto_mode_urgency_weight
  );

  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setTargetRetention(profile.fsrs_target_retention);
    setUrgencyWeight(profile.auto_mode_urgency_weight);
  }, [profile.fsrs_target_retention, profile.auto_mode_urgency_weight]);

  const retentionPct = Math.round(targetRetention * 100);
  const urgencyPct = Math.round(urgencyWeight * 100);
  const reviewPct = 100 - urgencyPct;

  const applyPreset = (preset: FsrsCalibrationPreset) => {
    setTargetRetention(preset.targetRetention);
    setUrgencyWeight(preset.urgencyWeight);
    setFeedback({
      type: "success",
      text: `Preset "${preset.label}" carregado. Clique em "Salvar calibragem" para gravar.`,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await updateFsrsSettings({
        fsrs_target_retention: targetRetention,
        auto_mode_urgency_weight: urgencyWeight,
      });

      if (res.ok) {
        showToast("Calibragem de revisões salva.");
        setFeedback({
          type: "success",
          text: "Preferências salvas no seu perfil.",
        });
      } else {
        setFeedback({
          type: "error",
          text:
            res.errorMessage ??
            "Não foi possível salvar no Supabase. Confira se já rodou a migração da Fase 6.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setFeedback(null);
    try {
      const summary = await recalculateAllTopicsFsrs(targetRetention);
      showToast(
        `Revisões recalculadas (${summary.practicedTopics} assuntos atualizados).`
      );
      setFeedback({
        type: "success",
        text: `Recálculo concluído: ${summary.practicedTopics} de ${summary.processedTopics} assuntos com histórico de prática processados (${summary.logsCreated} sessões analisadas).`,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro ao recalcular revisões a partir do histórico.";
      showToast(msg, "error");
      setFeedback({ type: "error", text: msg });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        {/* 1. Presets de 1 clique */}
        <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Brain
                size={19}
                weight="duotone"
                className="text-[var(--accent-sage)]"
              />
              <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
                Calibragem de Revisões Espaçadas (FSRS)
              </h2>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-[640px] leading-relaxed">
              O Cadernin usa o algoritmo científico <strong>FSRS</strong> por
              baixo dos panos para estimar sua curva de memória a cada lista de
              exercícios ou simulado Raio-X (contando apenas{" "}
              <strong>acertos reais</strong>, sem chutes). Escolha um perfil
              pronto abaixo ou ajuste os controles manualmente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FSRS_CALIBRATION_PRESETS.map((preset) => {
              const isSelected =
                Math.abs(targetRetention - preset.targetRetention) < 0.005 &&
                Math.abs(urgencyWeight - preset.urgencyWeight) < 0.005;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-4 rounded-xl border text-left space-y-1.5 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)]"
                      : "bg-[var(--bg-subtle)]/70 border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-editorial text-[18px] text-[var(--text-primary)]">
                      {preset.label}
                    </span>
                    <span className="font-mono-tabular text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-hairline)] text-[var(--accent-sage)] font-medium">
                      {Math.round(preset.targetRetention * 100)}%
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Sliders manuais */}
        <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-5">
          <h3 className="font-editorial text-[20px] text-[var(--text-primary)]">
            Ajuste Manual Fino
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Retenção Alvo (80% - 95%) */}
            <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-[var(--text-primary)]">
                  Retenção Alvo
                </span>
                <span className="font-mono-tabular text-[15px] font-semibold text-[var(--accent-sage)]">
                  {retentionPct}%
                </span>
              </div>

              <input
                type="range"
                min={80}
                max={95}
                step={1}
                value={retentionPct}
                onChange={(e) =>
                  setTargetRetention(Number.parseInt(e.target.value, 10) / 100)
                }
                aria-label="Retenção alvo de memória"
                className="w-full accent-[var(--accent-sage)] cursor-pointer"
              />

              <div className="flex justify-between font-mono-tabular text-[10.5px] text-[var(--text-muted)]">
                <span>80% (mais espaçado)</span>
                <span>95% (mais intenso)</span>
              </div>

              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-1.5">
                <Info
                  size={14}
                  weight="light"
                  className="shrink-0 mt-0.5 text-[var(--accent-slate)]"
                />
                <span>
                  Quando a memória estimada de um assunto cai abaixo de{" "}
                  <strong className="font-mono-tabular">{retentionPct}%</strong>,
                  ele aparece automaticamente na aba <strong>Revisões</strong> da
                  Home.
                </span>
              </p>
            </div>

            {/* Equilíbrio do Modo Automático */}
            <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-[var(--text-primary)]">
                  Equilíbrio do Modo Automático
                </span>
                <span className="font-mono-tabular text-[12.5px] font-medium text-[var(--text-primary)]">
                  {urgencyPct}% Lacunas / {reviewPct}% Revisões
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={urgencyPct}
                onChange={(e) =>
                  setUrgencyWeight(Number.parseInt(e.target.value, 10) / 100)
                }
                aria-label="Equilíbrio entre lacunas e revisões no modo automático"
                className="w-full accent-[var(--accent-sage)] cursor-pointer"
              />

              <div className="flex justify-between font-mono-tabular text-[10.5px] text-[var(--text-muted)]">
                <span>Foco em Revisões</span>
                <span>Foco em Lacunas</span>
              </div>

              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-1.5">
                <Info
                  size={14}
                  weight="light"
                  className="shrink-0 mt-0.5 text-[var(--accent-slate)]"
                />
                <span>
                  Controla como a aba <strong>Automático</strong> na Home
                  combina assuntos com muitos erros/chutes e assuntos prestes a
                  serem esquecidos.
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
            {feedback ? (
              <p
                className={`text-[13px] font-medium flex items-center gap-1.5 ${
                  feedback.type === "error"
                    ? "text-[var(--accent-terracotta)]"
                    : "text-[var(--accent-sage)]"
                }`}
              >
                {feedback.type === "error" && (
                  <WarningCircle size={15} weight="duotone" className="shrink-0" />
                )}
                <span>{feedback.text}</span>
              </p>
            ) : (
              <span className="text-[12px] text-[var(--text-muted)]">
                Padrão inicial: 86% de retenção e 65% lacunas / 35% revisões.
              </span>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <SpinnerGap size={15} weight="light" className="animate-spin" />
              ) : (
                <Check size={16} weight="light" />
              )}
              <span>{saving ? "Salvando..." : "Salvar calibragem"}</span>
            </button>
          </div>
        </section>
      </form>

      {/* 3. Recalcular histórico retroativamente */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-editorial text-[20px] text-[var(--text-primary)]">
              Recalcular revisões a partir do histórico
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-[560px] leading-relaxed">
              Reprocessa em ordem cronológica todas as listas de exercícios e
              questões de simulados já salvos no seu banco para calcular a
              memória atual e a próxima data de revisão de cada assunto. Não
              apaga nenhum exercício ou simulado.
            </p>
          </div>

          <button
            type="button"
            disabled={recalculating}
            onClick={() => void handleRecalculate()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[13px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-60 shrink-0"
          >
            {recalculating ? (
              <SpinnerGap size={15} weight="light" className="animate-spin" />
            ) : (
              <ArrowsClockwise size={15} weight="light" />
            )}
            <span>
              {recalculating
                ? "Recalculando..."
                : "Recalcular revisões a partir do histórico"}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
