"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Container fixo de Toasts (respeita bottom bar no mobile) */}
      <div
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-2 max-w-[340px] w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.variant === "error"
              ? WarningCircle
              : toast.variant === "info"
              ? Info
              : CheckCircle;

          const accentClass =
            toast.variant === "error"
              ? "text-[var(--accent-terracotta)] border-[var(--accent-terracotta)]/35"
              : toast.variant === "info"
              ? "text-[var(--accent-slate)] border-[var(--accent-slate)]/35"
              : "text-[var(--accent-sage)] border-[var(--accent-sage)]/35";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl bg-[var(--bg-card)] border px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-[13px] ${accentClass}`}
              style={{ boxShadow: "var(--shadow-tactile)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon size={17} weight="duotone" className="shrink-0" />
                <span className="text-[var(--text-primary)] leading-snug">
                  {toast.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar notificação"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer"
              >
                <X size={14} weight="light" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve ser utilizado dentro de ToastProvider.");
  }
  return ctx;
}
