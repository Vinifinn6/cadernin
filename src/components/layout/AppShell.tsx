"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookBookmark,
  BookOpenText,
  CalendarBlank,
  ChartLineUp,
  CloudCheck,
  CloudSlash,
  GearSix,
  House,
  List,
  Moon,
  PencilLine,
  SidebarSimple,
  Sun,
  Timer,
  User,
  X,
} from "@phosphor-icons/react";
import { useProfileTheme } from "@/components/providers/ProfileThemeProvider";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{
    size?: number;
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
    className?: string;
  }>;
  mobilePrimary?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Início",
    shortLabel: "Início",
    icon: House,
    mobilePrimary: true,
  },
  {
    href: "/cronograma",
    label: "Cronograma",
    shortLabel: "Cronograma",
    icon: BookBookmark,
    mobilePrimary: true,
  },
  {
    href: "/exercicios",
    label: "Exercícios",
    shortLabel: "Exercícios",
    icon: PencilLine,
    mobilePrimary: true,
  },
  {
    href: "/simulados",
    label: "Simulados",
    shortLabel: "Simulados",
    icon: Timer,
    mobilePrimary: true,
  },
  {
    href: "/planejador",
    label: "Planejador",
    shortLabel: "Planejador",
    icon: CalendarBlank,
    mobilePrimary: true,
  },
  {
    href: "/estatisticas",
    label: "Estatísticas",
    shortLabel: "Estatíst.",
    icon: ChartLineUp,
    mobilePrimary: true,
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    shortLabel: "Config.",
    icon: GearSix,
  },
];

const SIDEBAR_STORAGE_KEY = "caderno_editorial_sidebar_collapsed_v1";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, theme, toggleTheme, supabaseStatus } = useProfileTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "true") setCollapsed(true);
    } catch {
      // noop
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // noop
      }
      return next;
    });
  };

  const currentNav =
    NAV_ITEMS.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) ?? NAV_ITEMS[0];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const initials = profile.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col md:flex-row">
      {/* =====================================================================
          SIDEBAR DESKTOP COLAPSÁVEL (Estilo Índice de Caderno)
         ===================================================================== */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-[var(--bg-card)] border-r border-[var(--border-hairline)] transition-[width] duration-200 ease-out z-30 ${
          collapsed ? "w-[76px]" : "w-[248px]"
        }`}
      >
        {/* Topo da Sidebar: Marca + Botão Recolher */}
        <div
          className={`h-16 px-4 border-b border-[var(--border-hairline)] flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <Link
              href="/"
              className="flex items-center gap-2.5 min-w-0 group"
              title={profile.app_name}
            >
              <span className="w-8 h-8 rounded-lg bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] flex items-center justify-center shrink-0">
                <BookOpenText size={19} weight="duotone" />
              </span>
              <div className="min-w-0">
                <p className="font-editorial text-[18px] leading-tight text-[var(--text-primary)] truncate">
                  {profile.app_name}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  Organização de estudos
                </p>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors shrink-0"
          >
            <SidebarSimple size={18} weight="light" />
          </button>
        </div>

        {/* Navegação Principal */}
        <nav
          aria-label="Navegação principal"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
        >
          {!collapsed && (
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Índice
            </p>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-[13.5px] transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <Icon
                  size={20}
                  weight={active ? "duotone" : "light"}
                  className="shrink-0"
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar: Tema + Mini Perfil + Status Supabase */}
        <div className="p-3 border-t border-[var(--border-hairline)] space-y-2">
          <button
            type="button"
            onClick={() => void toggleTheme()}
            title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            className={`w-full flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {theme === "dark" ? (
                <Sun size={18} weight="light" className="shrink-0 text-[var(--accent-ochre)]" />
              ) : (
                <Moon size={18} weight="light" className="shrink-0" />
              )}
              {!collapsed && (
                <span className="truncate">
                  {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                </span>
              )}
            </span>
            {!collapsed && (
              <span className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                {theme === "dark" ? "NOTURNO" : "CLARO"}
              </span>
            )}
          </button>

          <Link
            href="/configuracoes"
            title={collapsed ? `${profile.display_name} · Configurações` : undefined}
            className={`flex items-center gap-2.5 rounded-[10px] p-2 hover:bg-[var(--bg-subtle)] transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-8 h-8 rounded-full object-cover border border-[var(--border-hairline)] shrink-0"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] text-[11px] font-medium flex items-center justify-center shrink-0">
                {initials || <User size={15} weight="light" />}
              </span>
            )}

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">
                  {profile.display_name}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                  {supabaseStatus === "connected" ? (
                    <>
                      <CloudCheck
                        size={12}
                        weight="duotone"
                        className="text-[var(--accent-sage)] shrink-0"
                      />
                      <span className="truncate">Supabase ativo</span>
                    </>
                  ) : (
                    <>
                      <CloudSlash
                        size={12}
                        weight="light"
                        className="text-[var(--accent-ochre)] shrink-0"
                      />
                      <span className="truncate">Modo local</span>
                    </>
                  )}
                </p>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* =====================================================================
          HEADER MOBILE FIXO (Inspirado no design-ref/screen.png)
         ===================================================================== */}
      <header className="md:hidden sticky top-0 z-40 h-15 px-4 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-hairline)] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            className="w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <List size={20} weight="light" />
          </button>
          <span className="w-7 h-7 rounded-lg bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] flex items-center justify-center shrink-0">
            <BookOpenText size={16} weight="duotone" />
          </span>
          <div className="min-w-0">
            <p className="font-editorial text-[18px] leading-none text-[var(--text-primary)] truncate">
              {profile.app_name}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {currentNav.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void toggleTheme()}
            aria-label="Alternar tema claro e escuro"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            {theme === "dark" ? (
              <Sun size={19} weight="light" className="text-[var(--accent-ochre)]" />
            ) : (
              <Moon size={19} weight="light" />
            )}
          </button>
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <GearSix size={19} weight="light" />
          </Link>
          <Link href="/" aria-label="Perfil" className="ml-1">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-8 h-8 rounded-full object-cover border border-[var(--border-hairline)]"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] text-[11px] font-medium flex items-center justify-center">
                {initials || <User size={14} weight="light" />}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* =====================================================================
          DRAWER MOBILE (Acesso completo aos 7 itens)
         ===================================================================== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-[272px] max-w-[82vw] h-full bg-[var(--bg-card)] border-r border-[var(--border-hairline)] flex flex-col">
            <div className="h-15 px-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] flex items-center justify-center">
                  <BookOpenText size={16} weight="duotone" />
                </span>
                <span className="font-editorial text-[18px] text-[var(--text-primary)]">
                  {profile.app_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <X size={18} weight="light" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors ${
                      active
                        ? "bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <Icon size={20} weight={active ? "duotone" : "light"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONTEÚDO PRINCIPAL (Largura máxima editorial 1120px)
         ===================================================================== */}
      <main className="flex-1 min-w-0 pb-24 md:pb-12">
        <div className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7">
          {children}
        </div>
      </main>

      {/* =====================================================================
          BARRA INFERIOR MOBILE (6 abas principais: inclui Planejador)
         ===================================================================== */}
      <nav
        aria-label="Atalhos inferiores"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe bg-[var(--bg-canvas)]/92 backdrop-blur-md border-t border-[var(--border-hairline)]"
      >
        <div className="grid grid-cols-6 h-16 px-0.5">
          {NAV_ITEMS.filter((item) => item.mobilePrimary).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] tracking-tight transition-colors ${
                  active
                    ? "text-[var(--accent-sage)] font-medium"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <Icon size={20} weight={active ? "duotone" : "light"} />
                <span className="truncate max-w-full px-0.5">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
