"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  CloudCheck,
  Info,
  PencilSimple,
  SpinnerGap,
  User,
  X,
} from "@phosphor-icons/react";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import type { CropAreaPixels, ProfileImageKind } from "@/lib/image-compress";

function getGreetingPtBr(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getFormattedDateWithoutYearPtBr(): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function ProfileHeroBanner() {
  const {
    profile,
    updateDisplayName,
    updateSubtitle,
    uploadCroppedProfileImage,
    uploadFeedback,
    clearUploadFeedback,
  } = useProfileTheme();

  const headerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [savingSubtitle, setSavingSubtitle] = useState(false);

  // Estado do Modal Interativo de Recorte (Crop/Zoom)
  const [cropState, setCropState] = useState<{
    open: boolean;
    kind: ProfileImageKind;
    imageSrc: string | null;
    originalSizeBytes: number;
  }>({
    open: false,
    kind: "avatar",
    imageSrc: null,
    originalSizeBytes: 0,
  });

  const greeting = useMemo(() => getGreetingPtBr(), []);
  const formattedDate = useMemo(() => getFormattedDateWithoutYearPtBr(), []);

  const hasHeader = Boolean(profile.header_url);
  const hasAvatar = Boolean(profile.avatar_url);

  const isUploadingHeader =
    uploadFeedback?.kind === "header" &&
    (uploadFeedback.status === "compressing" ||
      uploadFeedback.status === "uploading");

  const isUploadingAvatar =
    uploadFeedback?.kind === "avatar" &&
    (uploadFeedback.status === "compressing" ||
      uploadFeedback.status === "uploading");

  const startEditName = () => {
    setNameDraft(profile.display_name);
    setEditingName(true);
  };

  const commitName = async () => {
    if (!nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    await updateDisplayName(nameDraft);
    setSavingName(false);
    setEditingName(false);
  };

  const startEditSubtitle = () => {
    setSubtitleDraft(profile.subtitle);
    setEditingSubtitle(true);
  };

  const commitSubtitle = async () => {
    setSavingSubtitle(true);
    await updateSubtitle(subtitleDraft);
    setSavingSubtitle(false);
    setEditingSubtitle(false);
  };

  const handleSelectFileForCrop = (
    kind: ProfileImageKind,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    const objectUrl = URL.createObjectURL(file);
    setCropState({
      open: true,
      kind,
      imageSrc: objectUrl,
      originalSizeBytes: file.size,
    });
  };

  const closeCropModal = () => {
    if (cropState.imageSrc) {
      URL.revokeObjectURL(cropState.imageSrc);
    }
    setCropState({
      open: false,
      kind: "avatar",
      imageSrc: null,
      originalSizeBytes: 0,
    });
  };

  const handleConfirmCrop = async (croppedAreaPixels: CropAreaPixels) => {
    if (!cropState.imageSrc) return;
    await uploadCroppedProfileImage(
      cropState.kind,
      cropState.imageSrc,
      croppedAreaPixels,
      cropState.originalSizeBytes
    );
    closeCropModal();
  };

  const initials = profile.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <section
        aria-label="Cabeçalho do caderno e perfil"
        className="relative w-full rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-hairline)]"
      >
        {/* Inputs ocultos para primeiro upload com crop interativo */}
        <input
          ref={headerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => handleSelectFileForCrop("header", e)}
        />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => handleSelectFileForCrop("avatar", e)}
        />

        {/* ===================================================================
            BANNER DE HEADER COM FADE SUAVE NOS 50% INFERIORES (SEM CORTE DURO)
           =================================================================== */}
        <div
          className={`relative h-40 sm:h-52 w-full overflow-hidden ${
            hasHeader ? "bg-[var(--bg-subtle)]" : "editorial-paper-banner"
          }`}
        >
          {profile.header_url ? (
            <img
              src={profile.header_url}
              alt="Capa do caderno de estudos"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="font-editorial italic text-[14px] text-[var(--text-muted)] tracking-wide">
                Personalize a capa do seu caderno
              </span>
            </div>
          )}

          {/* Degradê orgânico cobrindo os 50% inferiores até a cor exata do card */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--bg-card) 35%, transparent) 55%, color-mix(in srgb, var(--bg-card) 85%, transparent) 85%, var(--bg-card) 100%)",
            }}
          />

          {/* Regra inteligente: só exibe na Home enquanto nenhuma capa foi adicionada */}
          {!hasHeader && (
            <button
              type="button"
              onClick={() => headerInputRef.current?.click()}
              disabled={isUploadingHeader}
              className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-card)]/90 backdrop-blur-md border border-[var(--border-hairline)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isUploadingHeader ? (
                <SpinnerGap size={14} weight="light" className="animate-spin" />
              ) : (
                <Camera size={14} weight="light" />
              )}
              <span>{isUploadingHeader ? "Otimizando..." : "Adicionar capa"}</span>
            </button>
          )}
        </div>

        {/* ===================================================================
            IDENTIDADE E AVATAR (80px mobile / 96px desktop) ACIMA DO FADE
           =================================================================== */}
        <div className="relative z-10 px-5 sm:px-6 pb-5 -mt-10 sm:-mt-12">
          <div className="flex items-end justify-between gap-3">
            {/* Avatar Circular (w-20 h-20 mobile / w-24 h-24 desktop) */}
            <div className="relative z-10 shrink-0">
              {hasAvatar ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[var(--bg-subtle)] border border-[var(--border-hairline)] ring-4 ring-[var(--bg-card)] flex items-center justify-center">
                  <img
                    src={profile.avatar_url ?? undefined}
                    alt={profile.display_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    aria-label="Adicionar foto de perfil"
                    title="Adicionar foto de perfil"
                    className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[var(--bg-subtle)] border border-[var(--border-hairline)] ring-4 ring-[var(--bg-card)] flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-slate)]"
                  >
                    <span className="font-editorial text-[26px] sm:text-[30px] text-[var(--text-secondary)]">
                      {initials || <User size={28} weight="light" />}
                    </span>
                    <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      {isUploadingAvatar ? (
                        <SpinnerGap
                          size={20}
                          weight="light"
                          className="animate-spin"
                        />
                      ) : (
                        <Camera size={20} weight="light" />
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="Adicionar foto de perfil"
                    className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-[var(--accent-sage)] text-[#FAF8F5] ring-2 ring-[var(--bg-card)] flex items-center justify-center hover:bg-[var(--accent-sage-hover)] transition-colors cursor-pointer"
                  >
                    <Camera size={13} weight="light" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Saudação Editorial (cor suave APENAS no nome do usuário) */}
          <div className="mt-3.5 space-y-1">
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void commitName();
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="font-editorial text-[24px] sm:text-[26px] text-[var(--text-secondary)] leading-tight">
                  {greeting},
                </span>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  autoFocus
                  maxLength={48}
                  placeholder="Seu nome"
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--accent-slate)] text-[18px] font-editorial text-[var(--text-primary)] focus:outline-none w-52 sm:w-64"
                />
                <button
                  type="submit"
                  disabled={savingName}
                  aria-label="Salvar nome"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[12px] font-medium transition-colors cursor-pointer"
                >
                  <Check size={14} weight="light" />
                  <span>Salvar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  aria-label="Cancelar edição do nome"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                >
                  <X size={14} weight="light" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-[27px] sm:text-[31px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
                  {greeting},{" "}
                  <em className="italic font-normal text-[#557057] dark:text-[#86A688]">
                    {profile.display_name}
                  </em>
                </h1>
                <button
                  type="button"
                  onClick={startEditName}
                  aria-label="Editar nome de exibição"
                  title="Editar nome"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                >
                  <PencilSimple size={15} weight="light" />
                </button>
              </div>
            )}

            {/* Data sem ano + Subtítulo editável */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--text-secondary)]">
              <span>{formattedDate}</span>
              <span className="text-[var(--text-muted)]">•</span>
              {editingSubtitle ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void commitSubtitle();
                  }}
                  className="inline-flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={subtitleDraft}
                    onChange={(e) => setSubtitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingSubtitle(false);
                    }}
                    autoFocus
                    maxLength={60}
                    placeholder="Ex: Rumo à Medicina"
                    className="px-2 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--accent-slate)] text-[13px] text-[var(--text-primary)] focus:outline-none w-48"
                  />
                  <button
                    type="submit"
                    disabled={savingSubtitle}
                    className="text-[var(--accent-sage)] hover:underline text-[12px] font-medium cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSubtitle(false)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px] cursor-pointer"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={startEditSubtitle}
                  title="Clique para editar seu objetivo"
                  className="inline-flex items-center gap-1 text-[var(--accent-sage)] font-medium hover:underline underline-offset-4 cursor-pointer"
                >
                  <span>{profile.subtitle}</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback de compressão WebP e upload */}
          {uploadFeedback && (
            <div
              className={`mt-4 px-3.5 py-2.5 rounded-xl border text-[12px] flex items-center justify-between gap-3 ${
                uploadFeedback.status === "error"
                  ? "bg-[var(--accent-terracotta-soft)] border-[var(--accent-terracotta)]/30 text-[var(--accent-terracotta)]"
                  : uploadFeedback.status === "warning"
                  ? "bg-[var(--accent-ochre-soft)] border-[var(--accent-ochre)]/30 text-[var(--text-primary)]"
                  : uploadFeedback.status === "success"
                  ? "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)]/30 text-[var(--accent-sage)]"
                  : "bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {uploadFeedback.status === "compressing" ||
                uploadFeedback.status === "uploading" ? (
                  <SpinnerGap
                    size={15}
                    weight="light"
                    className="animate-spin shrink-0"
                  />
                ) : uploadFeedback.status === "success" ? (
                  <CloudCheck size={15} weight="duotone" className="shrink-0" />
                ) : (
                  <Info size={15} weight="light" className="shrink-0" />
                )}
                <span className="font-mono-tabular text-[11.5px] leading-snug">
                  {uploadFeedback.message}
                </span>
              </div>
              <button
                type="button"
                onClick={clearUploadFeedback}
                aria-label="Dispensar aviso"
                className="shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={14} weight="light" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modal Interativo de Recorte (Crop & Zoom) */}
      <ImageCropModal
        open={cropState.open}
        kind={cropState.kind}
        imageSrc={cropState.imageSrc}
        onCancel={closeCropModal}
        onConfirm={handleConfirmCrop}
      />
    </>
  );
}
