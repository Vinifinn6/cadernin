"use client";

import React, { useState } from "react";
import {
  Brain,
  Database,
  GraduationCap,
  SlidersHorizontal,
  UserCircle,
} from "@phosphor-icons/react";
import { ProfileAppearanceTab } from "@/components/configuracoes/ProfileAppearanceTab";
import { PriorityWeightsTab } from "@/components/configuracoes/PriorityWeightsTab";
import { FsrsCalibrationTab } from "@/components/configuracoes/FsrsCalibrationTab";
import { EnemMatrixTab } from "@/components/configuracoes/EnemMatrixTab";
import { BackupTab } from "@/components/configuracoes/BackupTab";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";

type SettingsTabId = "profile" | "weights" | "reviews" | "enem" | "backup";

const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  }>;
}[] = [
  { id: "profile", label: "Perfil & Aparência", icon: UserCircle },
  { id: "weights", label: "Pesos de Prioridade", icon: SlidersHorizontal },
  { id: "reviews", label: "Revisões Espaçadas", icon: Brain },
  { id: "enem", label: "Matriz ENEM", icon: GraduationCap },
  { id: "backup", label: "Backup JSON", icon: Database },
];

export default function ConfiguracoesPage() {
  const { profile } = useProfileTheme();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("profile");

  return (
    <div className="space-y-6 max-w-[920px]">
      <header className="space-y-1.5 border-b border-[var(--border-hairline)] pb-5">
        <p className="font-mono-tabular text-[11px] uppercase tracking-[0.08em] text-[var(--accent-sage)]">
          Personalização Total
        </p>
        <h1 className="font-editorial text-[30px] sm:text-[34px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
          Configurações do {profile.app_name}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Ajuste nome do app, perfil, fotos, tema, fórmula de prioridade,
          habilidades do ENEM e backup dos seus dados.
        </p>
      </header>

      {/* Abas estilo índice editorial */}
      <nav
        aria-label="Seções de configurações"
        className="flex flex-wrap gap-2"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] transition-colors cursor-pointer ${
                active
                  ? "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-medium border border-[var(--accent-sage)]/30"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              <Icon size={17} weight={active ? "duotone" : "light"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Conteúdo da Aba Selecionada */}
      <div>
        {activeTab === "profile" && <ProfileAppearanceTab />}
        {activeTab === "weights" && <PriorityWeightsTab />}
        {activeTab === "reviews" && <FsrsCalibrationTab />}
        {activeTab === "enem" && <EnemMatrixTab />}
        {activeTab === "backup" && <BackupTab />}
      </div>
    </div>
  );
}
