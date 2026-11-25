"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowsClockwise,
  Camera,
  Check,
  CloudCheck,
  CloudSlash,
  HardDrives,
  Moon,
  SpinnerGap,
  Sun,
  User,
} from "@phosphor-icons/react";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";

export function ProfileAppearanceTab() {
  const {
    profile,
    theme,
    setTheme,
    supabaseStatus,
    supabaseMessage,
    uploadFeedback,
    updateAppName,
    updateDisplayName,
    updateSubtitle,
    updateDailyGoalMinutes,
    uploadProfileImage,
    refreshProfile,
  } = useProfileTheme();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  const [appNameInput, setAppNameInput] = useState(profile.app_name);
  const [nameInput, setNameInput] = useState(profile.display_name);
  const [subtitleInput, setSubtitleInput] = useState(profile.subtitle);
  const [goalHoursInput, setGoalHoursInput] = useState(
    String((profile.daily_goal_minutes / 60).toFixed(1))
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setAppNameInput(profile.app_name);
    setNameInput(profile.display_name);
    setSubtitleInput(profile.subtitle);
    setGoalHoursInput(String((profile.daily_goal_minutes / 60).toFixed(1)));
  }, [
    profile.app_name,
    profile.display_name,
    profile.subtitle,
    profile.daily_goal_minutes,
  ]);

  const isUploadingAvatar =
    uploadFeedback?.kind === "avatar" &&
    (uploadFeedback.status === "compressing" ||
      uploadFeedback.status === "uploading");

  const isUploadingHeader =
    uploadFeedback?.kind === "header" &&
    (uploadFeedback.status === "compressing" ||
      uploadFeedback.status === "uploading");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);

    try {
      const appRes = await updateAppName(appNameInput);
      await updateDisplayName(nameInput);
      await updateSubtitle(subtitleInput);
      const parsedHours = Number.parseFloat(goalHoursInput.replace(",", "."));
      if (Number.isFinite(parsedHours) && parsedHours > 0) {
        await updateDailyGoalMinutes(Math.round(parsedHours * 60));
      }

      if (appRes.missingColumn) {
        setSavedNotice(
          "Salvo! Para sincronizar o nome do app entre dispositivos, rode o comando de 1 linha no SQL Editor."
        );
      } else {
        setSavedNotice("Alterações salvas com sucesso.");
      }
      setTimeout(() => setSavedNotice(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (
    kind: "avatar" | "header",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadProfileImage(kind, file);
  };

  const initials = profile.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="space-y-6">
      {/* 1. Identidade & Nome do Aplicativo */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-5">
        <div>
          <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
            Identidade do Caderno
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Personalize o nome do aplicativo, seu nome de exibição e sua meta
            diária de estudos.
          </p>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                Nome do aplicativo
              </span>
              <input
                type="text"
                value={appNameInput}
                onChange={(e) => setAppNameInput(e.target.value)}
                placeholder="Cadernin"
                maxLength={40}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[14px] text-[var(--text-primary)]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                Seu nome de exibição
              </span>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={48}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[14px] text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                Objetivo / Subtítulo
              </span>
              <input
                type="text"
                value={subtitleInput}
                onChange={(e) => setSubtitleInput(e.target.value)}
                maxLength={60}
                placeholder="Ex: Rumo à Medicina"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[14px] text-[var(--text-primary)]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                Meta diária de estudo (horas)
              </span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="16"
                value={goalHoursInput}
                onChange={(e) => setGoalHoursInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none font-mono-tabular text-[14px] text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              <Check size={16} weight="light" />
              <span>{saving ? "Salvando..." : "Salvar perfil"}</span>
            </button>

            {savedNotice && (
              <span className="text-[12.5px] text-[var(--accent-sage)] font-medium">
                {savedNotice}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* 2. Foto de Perfil e Capa do Cabeçalho (WebP < 200KB) */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-5">
        <div>
          <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
            Foto de Perfil &amp; Capa do Cabeçalho
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            As imagens são comprimidas automaticamente no navegador para WebP
            (&lt; 200 KB) e substituem o arquivo anterior sem acumular espaço.
          </p>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => void handleFileChange("avatar", e)}
        />
        <input
          ref={headerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => void handleFileChange("header", e)}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Avatar */}
          <div className="md:col-span-5 p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--bg-card)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-editorial text-[20px] text-[var(--text-secondary)]">
                  {initials || <User size={22} weight="light" />}
                </span>
              )}
            </div>
            <div className="space-y-2 min-w-0">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Foto de perfil
                </p>
                <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                  avatar.webp · máx. 300×300px
                </p>
              </div>
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[12px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-60"
              >
                {isUploadingAvatar ? (
                  <SpinnerGap size={13} weight="light" className="animate-spin" />
                ) : (
                  <Camera size={13} weight="light" />
                )}
                <span>
                  {isUploadingAvatar ? "Enviando..." : "Trocar foto"}
                </span>
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="md:col-span-7 p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div
              className={`h-20 w-full rounded-lg overflow-hidden border border-[var(--border-hairline)] ${
                profile.header_url ? "bg-[var(--bg-card)]" : "editorial-paper-banner"
              }`}
            >
              {profile.header_url && (
                <img
                  src={profile.header_url}
                  alt="Capa atual"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Capa do cabeçalho
                </p>
                <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                  header.webp · máx. 1600×500px
                </p>
              </div>
              <button
                type="button"
                disabled={isUploadingHeader}
                onClick={() => headerInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[12px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-60 shrink-0"
              >
                {isUploadingHeader ? (
                  <SpinnerGap size={13} weight="light" className="animate-spin" />
                ) : (
                  <Camera size={13} weight="light" />
                )}
                <span>
                  {isUploadingHeader ? "Enviando..." : "Trocar capa"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {uploadFeedback && (
          <p className="font-mono-tabular text-[11.5px] text-[var(--accent-sage)]">
            {uploadFeedback.message}
          </p>
        )}
      </section>

      {/* 3. Tema Claro / Escuro */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4">
        <h2 className="font-editorial text-[22px] text-[var(--text-primary)]">
          Tema Visual
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void setTheme("light")}
            className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
              theme === "light"
                ? "border-[var(--accent-sage)] bg-[var(--accent-sage-soft)]"
                : "border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <Sun
              size={22}
              weight={theme === "light" ? "duotone" : "light"}
              className="text-[var(--accent-ochre)] shrink-0"
            />
            <div>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                Modo Claro
              </p>
              <p className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                Papel quente #FAF8F5
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void setTheme("dark")}
            className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-[var(--accent-sage)] bg-[var(--accent-sage-soft)]"
                : "border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <Moon
              size={22}
              weight={theme === "dark" ? "duotone" : "light"}
              className="text-[var(--accent-slate)] shrink-0"
            />
            <div>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                Modo Escuro
              </p>
              <p className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                Carvão quente #181715
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* 4. Status de Conexão */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {supabaseStatus === "connected" ? (
              <CloudCheck
                size={20}
                weight="duotone"
                className="text-[var(--accent-sage)]"
              />
            ) : (
              <CloudSlash
                size={20}
                weight="duotone"
                className="text-[var(--accent-ochre)]"
              />
            )}
            <div>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                {supabaseStatus === "connected"
                  ? "Conectado ao Supabase"
                  : "Verifique a conexão com o Supabase"}
              </p>
              <p className="text-[12px] text-[var(--text-secondary)]">
                {supabaseMessage ?? "Banco em nuvem sincronizado."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
          >
            <ArrowsClockwise size={14} weight="light" />
            <span>Testar</span>
          </button>
        </div>

        <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          <HardDrives size={15} weight="light" className="shrink-0" />
          <span>
            Storage econômico ativo: no máximo 2 arquivos WebP no bucket{" "}
            <code className="font-mono-tabular">profile-assets</code>.
          </span>
        </div>
      </section>
    </div>
  );
}
