"use client";

import React, { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import type { CropAreaPixels, ProfileImageKind } from "@/lib/image-compress";

interface ImageCropModalProps {
  open: boolean;
  kind: ProfileImageKind;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (croppedAreaPixels: CropAreaPixels) => Promise<void>;
}

export function ImageCropModal({
  open,
  kind,
  imageSrc,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<CropAreaPixels | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedPixels(null);
      setSaving(false);
    }
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedPixels({
      x: areaPixels.x,
      y: areaPixels.y,
      width: areaPixels.width,
      height: areaPixels.height,
    });
  }, []);

  const handleApply = async () => {
    if (!croppedPixels) return;
    setSaving(true);
    try {
      await onConfirm(croppedPixels);
    } finally {
      setSaving(false);
    }
  };

  const isAvatar = kind === "avatar";

  return (
    <AnimatePresence>
      {open && imageSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => !saving && onCancel()}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[560px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-hairline)] overflow-hidden"
            style={{ boxShadow: "var(--shadow-tactile)" }}
          >
            {/* Cabeçalho */}
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3">
              <div>
                <p className="font-mono-tabular text-[10.5px] uppercase tracking-[0.12em] text-[var(--accent-sage)]">
                  Enquadramento &amp; Zoom
                </p>
                <h2
                  id="crop-modal-title"
                  className="font-editorial text-[22px] leading-tight text-[var(--text-primary)]"
                >
                  {isAvatar ? (
                    <>
                      Ajustar foto de <em className="italic">perfil</em>
                    </>
                  ) : (
                    <>
                      Enquadrar <em className="italic">capa</em> do caderno
                    </>
                  )}
                </h2>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={onCancel}
                aria-label="Fechar"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer disabled:opacity-40"
              >
                <X size={18} weight="light" />
              </button>
            </div>

            {/* Área Interativa de Recorte */}
            <div className="relative w-full h-[300px] sm:h-[340px] bg-[#141311]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={isAvatar ? 1 : 3.6 / 1}
                cropShape={isAvatar ? "round" : "rect"}
                showGrid={!isAvatar}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            {/* Controles de Zoom + Ações */}
            <div className="p-5 space-y-4 bg-[var(--bg-card)]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
                  aria-label="Diminuir zoom"
                  className="w-8 h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <MagnifyingGlassMinus size={15} weight="light" />
                </button>

                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number.parseFloat(e.target.value))}
                  aria-label="Nível de zoom"
                  className="flex-1 accent-[var(--accent-sage)] cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                  aria-label="Aumentar zoom"
                  className="w-8 h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <MagnifyingGlassPlus size={15} weight="light" />
                </button>

                <span className="font-mono-tabular text-[12px] text-[var(--text-muted)] w-11 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
                <span className="text-[11.5px] text-[var(--text-muted)]">
                  Arraste a imagem para posicionar · WebP &lt; 200 KB
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onCancel}
                    className="px-4 py-2 rounded-[10px] border border-[var(--border-hairline)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={saving || !croppedPixels}
                    onClick={() => void handleApply()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <SpinnerGap
                        size={15}
                        weight="light"
                        className="animate-spin"
                      />
                    ) : (
                      <Check size={15} weight="light" />
                    )}
                    <span>{saving ? "Salvando..." : "Aplicar e Salvar"}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
