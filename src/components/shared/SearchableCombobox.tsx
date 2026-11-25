"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Check, MagnifyingGlass, X } from "@phosphor-icons/react";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  dotColor?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  label?: string;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Digite para buscar...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  allowClear = true,
  label,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <span className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </span>
      )}

      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full px-3 py-2 rounded-[10px] bg-[var(--bg-canvas)] border text-left flex items-center justify-between gap-2 text-[13.5px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            open
              ? "border-[var(--accent-slate)]"
              : "border-[var(--border-hairline)] hover:border-[var(--border-strong)]"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {selected?.dotColor && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: selected.dotColor }}
              />
            )}
            <span
              className={`truncate ${
                selected
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {selected ? selected.label : placeholder}
            </span>
          </span>

          <span className="flex items-center gap-1 shrink-0">
            {allowClear && selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpar seleção"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                <X size={12} weight="light" />
              </span>
            )}
            <CaretDown
              size={14}
              weight="light"
              className={`text-[var(--text-muted)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div
          className="absolute z-40 mt-1.5 w-full rounded-xl bg-[var(--bg-card)] border border-[var(--border-hairline)] overflow-hidden"
          style={{ boxShadow: "var(--shadow-tactile)" }}
        >
          <div className="p-2 border-b border-[var(--border-hairline)]">
            <div className="relative">
              <MagnifyingGlass
                size={14}
                weight="light"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--accent-slate)] focus:outline-none text-[12.5px] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-[var(--text-muted)]">
                {emptyText}
              </p>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start justify-between gap-2 text-[13px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-medium"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {opt.dotColor && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: opt.dotColor }}
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {opt.sublabel && (
                        <p className="text-[11.5px] text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-snug">
                          {opt.sublabel}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check
                        size={14}
                        weight="bold"
                        className="shrink-0 mt-0.5"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
