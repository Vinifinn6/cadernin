"use client";

import React, { useRef, useState } from "react";
import {
  Check,
  DownloadSimple,
  FileCode,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  BACKUP_TABLE_LABELS,
  BACKUP_TABLES,
  type CaderninBackupFile,
  exportFullBackup,
  importFullBackup,
  triggerJsonDownload,
  validateBackupJson,
} from "@/lib/backup-service";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";

export function BackupTab() {
  const { profile, refreshProfile } = useProfileTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<CaderninBackupFile | null>(
    null
  );
  const [pendingFileName, setPendingFileName] = useState<string>("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const backup = await exportFullBackup(profile.app_name);
      const fileName = triggerJsonDownload(backup);
      const totalRows = BACKUP_TABLES.reduce(
        (acc, t) => acc + (backup.counts[t] ?? 0),
        0
      );
      setFeedback({
        type: "success",
        text: `Backup baixado (${fileName}) com ${totalRows} registros de todas as tabelas.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Não foi possível gerar o arquivo de backup.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFeedback(null);
    try {
      const text = await file.text();
      const { backup, error } = validateBackupJson(text);
      if (error || !backup) {
        setPendingBackup(null);
        setFeedback({
          type: "error",
          text: error ?? "Arquivo de backup inválido.",
        });
        return;
      }
      setPendingBackup(backup);
      setPendingFileName(file.name);
    } catch {
      setFeedback({
        type: "error",
        text: "Não foi possível ler o arquivo selecionado.",
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup) return;
    setImporting(true);
    setFeedback(null);
    try {
      const { importedTotal } = await importFullBackup(pendingBackup);
      await refreshProfile();
      setPendingBackup(null);
      setPendingFileName("");
      setFeedback({
        type: "success",
        text: `Backup restaurado com sucesso! ${importedTotal} registros sincronizados no Supabase.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Erro ao restaurar o backup.",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-[13px] flex items-center justify-between gap-3 ${
            feedback.type === "error"
              ? "bg-[var(--accent-terracotta-soft)] border-[var(--accent-terracotta)]/30 text-[var(--accent-terracotta)]"
              : "bg-[var(--accent-sage-soft)] border-[var(--accent-sage)]/30 text-[var(--accent-sage)]"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "error" ? (
              <WarningCircle size={17} weight="duotone" className="shrink-0" />
            ) : (
              <Check size={17} weight="bold" className="shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X size={15} weight="light" />
          </button>
        </div>
      )}

      {/* Exportar */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] flex items-center justify-center shrink-0">
            <DownloadSimple size={20} weight="duotone" />
          </span>
          <div className="space-y-1">
            <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
              Exportar Backup Completo (.json)
            </h2>
            <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
              Baixe um único arquivo contendo tudo o que está salvo no seu
              banco: perfil, pesos, matérias, assuntos, subtópicos, matriz ENEM,
              exercícios, simulados, sessões de estudo e planejador.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={exporting}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13.5px] font-medium transition-colors cursor-pointer disabled:opacity-60"
        >
          {exporting ? (
            <SpinnerGap size={16} weight="light" className="animate-spin" />
          ) : (
            <DownloadSimple size={16} weight="light" />
          )}
          <span>{exporting ? "Preparando arquivo..." : "Baixar backup JSON"}</span>
        </button>
      </section>

      {/* Importar / Restaurar */}
      <section className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-[var(--accent-slate-soft)] text-[var(--accent-slate)] flex items-center justify-center shrink-0">
            <UploadSimple size={20} weight="duotone" />
          </span>
          <div className="space-y-1">
            <h2 className="font-editorial text-[22px] text-[var(--text-primary)] leading-tight">
              Restaurar Backup (.json)
            </h2>
            <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
              Selecione um arquivo de backup gerado pelo {profile.app_name}. Os
              registros existentes com o mesmo identificador são atualizados e os
              novos são adicionados sem quebrar vínculos entre tabelas.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleSelectFile(e)}
        />

        {!pendingBackup ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)] text-[13.5px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <FileCode size={16} weight="light" />
            <span>Escolher arquivo de backup (.json)</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Arquivo pronto: {pendingFileName}
                </p>
                <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                  Exportado em{" "}
                  {new Date(pendingBackup.exported_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={16} weight="light" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BACKUP_TABLES.map((table) => (
                <div
                  key={table}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-hairline)] flex items-center justify-between gap-2"
                >
                  <span className="text-[12px] text-[var(--text-secondary)] truncate">
                    {BACKUP_TABLE_LABELS[table]}
                  </span>
                  <span className="font-mono-tabular text-[12px] font-medium text-[var(--text-primary)]">
                    {pendingBackup.counts[table]}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="px-3.5 py-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleConfirmImport()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-[#FAF8F5] text-[13px] font-medium cursor-pointer disabled:opacity-60"
              >
                {importing ? (
                  <SpinnerGap size={15} weight="light" className="animate-spin" />
                ) : (
                  <Check size={15} weight="light" />
                )}
                <span>
                  {importing
                    ? "Restaurando dados..."
                    : "Confirmar restauração"}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
