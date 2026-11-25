import React from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

interface PhasePlaceholderProps {
  sectionLabel: string;
  title: string;
  description: string;
  tablesReady: string[];
}

export function PhasePlaceholder({
  sectionLabel,
  title,
  description,
  tablesReady,
}: PhasePlaceholderProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5 border-b border-[var(--border-hairline)] pb-5">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
          {sectionLabel}
        </p>
        <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] max-w-[640px] leading-relaxed">
          {description}
        </p>
      </header>

      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4 max-w-[720px]">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--accent-ochre-soft)] text-[var(--accent-ochre)] font-mono-tabular text-[11px] font-medium">
          Estrutura de dados pronta na Fase 1
        </div>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          As tabelas no Supabase e os tipos TypeScript para este módulo já foram
          criados no <code className="font-mono-tabular text-[12px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">supabase/schema.sql</code>.
          A interface interativa completa deste módulo será entregue nas próximas fases.
        </p>

        <div className="pt-2 space-y-2">
          <p className="text-[12px] font-medium text-[var(--text-primary)]">
            Tabelas relacionadas já modeladas:
          </p>
          <div className="flex flex-wrap gap-2">
            {tablesReady.map((table) => (
              <span
                key={table}
                className="font-mono-tabular text-[11.5px] px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
              >
                public.{table}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent-sage)] hover:underline underline-offset-4"
          >
            <ArrowLeft size={15} weight="light" />
            <span>Voltar para o Início</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
