"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
  Info,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import {
  DEFAULT_PRIORITY_WEIGHTS,
  type PriorityWeights,
} from "@/types/database";

interface WeightFieldMeta {
  key: keyof PriorityWeights;
  label: string;
  hint: string;
  accent: string;
}

const WEIGHT_FIELDS: WeightFieldMeta[] = [
  {
    key: "real_correct",
    label: "Acerto Real",
    hint: "Questão que você sabia de verdade e acertou com segurança.",
    accent: "var(--accent-sage)",
  },
  {
    key: "error_attention",
    label: "Erro por Falta de Atenção",
    hint: "Por padrão vale 0 para não poluir a urgência de conteúdo, mas você pode ajustar se quiser.",
    accent: "var(--accent-ochre)",
  },
  {
    key: "guess_1",
    label: "Chute Nível 1 (dúvida leve)",
    hint: "Acertou, mas ficou inseguro em um detalhe do enunciado ou conceito.",
    accent: "var(--accent-slate)",
  },
  {
    key: "guess_2",
    label: "Chute Nível 2 (entre 2 opções)",
    hint: "Eliminou alternativas, mas decidiu na sorte entre duas opções finais.",
    accent: "var(--accent-ochre)",
  },
  {
    key: "guess_3",
    label: "Chute Nível 3 (chute total)",
    hint: "Não sabia o conteúdo e acertou no escuro — alto risco de errar na prova real.",
    accent: "var(--accent-terracotta)",
  },
  {
    key: "error_gap",
    label: "Erro por Lacuna de Conteúdo",
    hint: "Errou porque não dominava a teoria, fórmula ou interpretação necessária.",
    accent: "var(--accent-terracotta)",
  },
  {
    key: "error_other",
    label: "Outro Erro",
    hint: "Tempo esgotado, pegadinha específica ou outro motivo fora dos anteriores.",
    accent: "var(--text-secondary)",
  },
];

export function PriorityWeightsTab() {
  const { profile, updatePrioritySettings } = useProfileTheme();

  const [weights, setWeights] = useState<PriorityWeights>(
    profile.priority_weights
  );
  const [halfLifeDays, setHalfLifeDays] = useState<number>(
    profile.decay_half_life_days
  );
  const [smoothingC, setSmoothingC] = useState<number>(profile.smoothing_c);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setWeights(profile.priority_weights);
    setHalfLifeDays(profile.decay_half_life_days);
    setSmoothingC(profile.smoothing_c);
  }, [
    profile.priority_weights,
    profile.decay_half_life_days,
    profile.smoothing_c,
  ]);

  const setWeight = (key: keyof PriorityWeights, rawValue: number) => {
    const clamped = Math.max(0, Math.min(10, Math.round(rawValue * 10) / 10));
    setWeights((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleRestoreDefaults = () => {
    setWeights({ ...DEFAULT_PRIORITY_WEIGHTS });
    setHalfLifeDays(30);
    setSmoothingC(3);
    setFeedback({
      type: "success",
      text: "Padrões carregados na tela. Clique em “Salvar pesos” para gravar no banco.",
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await updatePrioritySettings({
        priority_weights: weights,
        decay_half_life_days: Math.max(1, Math.round(halfLifeDays)),
        smoothing_c: Math.max(0, Number(smoothingC)),
      });

      if (res.ok) {
        setFeedback({
          type: "success",
          text: "Pesos e parâmetros de prioridade salvos no seu perfil.",
        });
      } else {
        setFeedback({
          type: "error",
          text:
            res.errorMessage ??
            "Não foi possível salvar os parâmetros no Supabase.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
      {/* 1. Pesos por categoria de resultado */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal
                size={19}
                weight="duotone"
                className="text-[var(--accent-sage)]"
              />
              <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
                Pesos de Urgência por Resultado
              </h2>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-[580px] leading-relaxed">
              Defina o quanto cada tipo de acerto, chute ou erro puxa um assunto
              para o topo da sua lista de prioridades. Quanto maior o peso, mais
              urgente fica revisar aquele conteúdo.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
          >
            <ArrowCounterClockwise size={14} weight="light" />
            <span>Restaurar padrões</span>
          </button>
        </div>

        <div className="divide-y divide-[var(--border-hairline)]">
          {WEIGHT_FIELDS.map((field) => {
            const val = weights[field.key];
            const defaultVal = DEFAULT_PRIORITY_WEIGHTS[field.key];

            return (
              <div
                key={field.key}
                className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: field.accent }}
                    />
                    <span className="text-[14px] font-medium text-[var(--text-primary)]">
                      {field.label}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      (padrão {defaultVal.toFixed(1)})
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[var(--text-secondary)] pl-4">
                    {field.hint}
                  </p>
                </div>

                <div className="flex items-center gap-3 pl-4 sm:pl-0 shrink-0">
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={Math.min(6, val)}
                    onChange={(e) =>
                      setWeight(field.key, Number.parseFloat(e.target.value))
                    }
                    aria-label={`Slider de peso para ${field.label}`}
                    className="w-32 sm:w-36 accent-[var(--accent-sage)] cursor-pointer"
                  />
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={val}
                    onChange={(e) => {
                      const parsed = Number.parseFloat(e.target.value);
                      setWeight(field.key, Number.isFinite(parsed) ? parsed : 0);
                    }}
                    aria-label={`Peso numérico para ${field.label}`}
                    className="w-18 px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13.5px] text-center text-[var(--text-primary)]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Meia-vida temporal & Amortecimento de volume C */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-5">
        <div>
          <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
            Tempo e Volume de Questões
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Ajustes finos para equilibrar erros recentes e evitar falsos alertas
            em assuntos com poucas questões feitas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Meia-vida temporal */}
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="half-life-input"
                className="text-[14px] font-medium text-[var(--text-primary)]"
              >
                Meia-vida temporal (dias)
              </label>
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                padrão 30 dias
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={7}
                max={90}
                step={1}
                value={Math.min(90, Math.max(7, halfLifeDays))}
                onChange={(e) =>
                  setHalfLifeDays(Number.parseInt(e.target.value, 10))
                }
                className="flex-1 accent-[var(--accent-sage)] cursor-pointer"
              />
              <input
                id="half-life-input"
                type="number"
                min={1}
                max={365}
                value={halfLifeDays}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  setHalfLifeDays(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
                }}
                className="w-20 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13.5px] text-center text-[var(--text-primary)]"
              />
            </div>

            <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-1.5">
              <Info
                size={14}
                weight="light"
                className="shrink-0 mt-0.5 text-[var(--accent-slate)]"
              />
              <span>
                A cada <strong className="font-mono-tabular">{halfLifeDays}</strong>{" "}
                dias, um erro antigo passa a pesar metade do que pesava no dia em
                que ocorreu. Assim seus tropeços mais recentes ganham destaque.
              </span>
            </p>
          </div>

          {/* Constante C */}
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="smoothing-c-input"
                className="text-[14px] font-medium text-[var(--text-primary)]"
              >
                Amortecimento de volume (C)
              </label>
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                padrão 3
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={Math.min(15, Math.max(0, smoothingC))}
                onChange={(e) =>
                  setSmoothingC(Number.parseFloat(e.target.value))
                }
                className="flex-1 accent-[var(--accent-sage)] cursor-pointer"
              />
              <input
                id="smoothing-c-input"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={smoothingC}
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value);
                  setSmoothingC(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
                }}
                className="w-20 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[13.5px] text-center text-[var(--text-primary)]"
              />
            </div>

            <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-1.5">
              <Info
                size={14}
                weight="light"
                className="shrink-0 mt-0.5 text-[var(--accent-slate)]"
              />
              <span>
                Impede que um assunto onde você fez apenas 1 questão e errou
                salte na frente de outro onde você errou 8 de 10. Quanto maior o{" "}
                <strong className="font-mono-tabular">C</strong>, mais questões
                são necessárias para confirmar uma urgência alta.
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
          {feedback ? (
            <p
              className={`text-[13px] font-medium ${
                feedback.type === "error"
                  ? "text-[var(--accent-terracotta)]"
                  : "text-[var(--accent-sage)]"
              }`}
            >
              {feedback.text}
            </p>
          ) : (
            <span className="text-[12px] text-[var(--text-muted)]">
              Esses pesos serão usados automaticamente no painel de Prioridade e
              Estatísticas.
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer disabled:opacity-60"
          >
            <Check size={16} weight="light" />
            <span>{saving ? "Salvando..." : "Salvar pesos"}</span>
          </button>
        </div>
      </section>
    </form>
  );
}
