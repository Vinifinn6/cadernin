"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  compressCroppedProfileImage,
  compressProfileImage,
  formatFileSize,
  type CropAreaPixels,
  type ProfileImageKind,
} from "@/lib/image-compress";
import {
  DEFAULT_USER_PROFILE,
  fetchUserProfile,
  LOCAL_THEME_STORAGE_KEY,
  readLocalProfile,
  saveUserProfilePatch,
  uploadProfileAsset,
} from "@/lib/profile-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { PriorityWeights, UserProfile } from "@/types/database";

export type ResolvedTheme = "light" | "dark";
export type SupabaseConnectionStatus =
  | "checking"
  | "connected"
  | "unconfigured"
  | "error";

export interface ImageUploadFeedback {
  kind: ProfileImageKind;
  status:
    | "idle"
    | "compressing"
    | "uploading"
    | "success"
    | "warning"
    | "error";
  message: string;
}

interface ProfileThemeContextValue {
  profile: UserProfile;
  theme: ResolvedTheme;
  isHydrated: boolean;
  supabaseStatus: SupabaseConnectionStatus;
  supabaseMessage: string | null;
  uploadFeedback: ImageUploadFeedback | null;
  clearUploadFeedback: () => void;
  setTheme: (next: ResolvedTheme) => Promise<void>;
  toggleTheme: () => Promise<void>;
  updateAppName: (appName: string) => Promise<{ ok: boolean; missingColumn?: boolean }>;
  updateDisplayName: (name: string) => Promise<boolean>;
  updateSubtitle: (subtitle: string) => Promise<boolean>;
  updateDailyGoalMinutes: (minutes: number) => Promise<boolean>;
  updatePrioritySettings: (params: {
    priority_weights: PriorityWeights;
    decay_half_life_days: number;
    smoothing_c: number;
  }) => Promise<{ ok: boolean; errorMessage?: string }>;
  updateFsrsSettings: (params: {
    fsrs_target_retention: number;
    auto_mode_urgency_weight: number;
  }) => Promise<{ ok: boolean; errorMessage?: string }>;
  uploadProfileImage: (kind: ProfileImageKind, file: File) => Promise<void>;
  uploadCroppedProfileImage: (
    kind: ProfileImageKind,
    imageSrc: string,
    croppedAreaPixels: CropAreaPixels,
    originalSizeBytes?: number
  ) => Promise<void>;
  removeProfileImage: (kind: ProfileImageKind) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileThemeContext = createContext<ProfileThemeContextValue | null>(
  null
);

function applyThemeClass(mode: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Atualiza a cor da barra de status no celular (PWA Android/iOS)
  const themeColor = mode === "dark" ? "#181715" : "#FAF8F5";
  let metaTheme = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])'
  );
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = themeColor;

  try {
    window.localStorage.setItem(LOCAL_THEME_STORAGE_KEY, mode);
  } catch {
    // noop
  }
}

function resolveInitialTheme(
  pref?: UserProfile["theme_preference"]
): ResolvedTheme {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(LOCAL_THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
}

export function ProfileThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [theme, setThemeState] = useState<ResolvedTheme>("light");
  const [isHydrated, setIsHydrated] = useState(false);
  const [supabaseStatus, setSupabaseStatus] =
    useState<SupabaseConnectionStatus>("checking");
  const [supabaseMessage, setSupabaseMessage] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] =
    useState<ImageUploadFeedback | null>(null);

  // Atualiza o título da aba do navegador sempre que o nome do app mudar
  useEffect(() => {
    if (typeof document !== "undefined" && profile.app_name) {
      document.title = `${profile.app_name} — Organização de Estudos`;
    }
  }, [profile.app_name]);

  const refreshProfile = useCallback(async () => {
    const local = readLocalProfile();
    setProfile(local);

    const initialTheme = resolveInitialTheme(local.theme_preference);
    setThemeState(initialTheme);
    applyThemeClass(initialTheme);

    if (!isSupabaseConfigured()) {
      setSupabaseStatus("unconfigured");
      setSupabaseMessage(
        "Configure as chaves do Supabase no .env.local para sincronizar com o banco."
      );
      setIsHydrated(true);
      return;
    }

    setSupabaseStatus("checking");
    const result = await fetchUserProfile();
    setProfile(result.profile);

    const syncedTheme = resolveInitialTheme(result.profile.theme_preference);
    setThemeState(syncedTheme);
    applyThemeClass(syncedTheme);

    if (result.source === "supabase") {
      setSupabaseStatus("connected");
      setSupabaseMessage("Conectado ao Supabase");
    } else {
      setSupabaseStatus("error");
      setSupabaseMessage(
        result.errorMessage ??
          "Não foi possível consultar o Supabase. Verifique a conexão."
      );
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const setTheme = useCallback(
    async (next: ResolvedTheme) => {
      setThemeState(next);
      applyThemeClass(next);
      setProfile((prev) => ({ ...prev, theme_preference: next }));

      const res = await saveUserProfilePatch(profile, {
        theme_preference: next,
      });
      setProfile(res.profile);
      if (isSupabaseConfigured()) {
        setSupabaseStatus(res.synced ? "connected" : "error");
        if (res.errorMessage) setSupabaseMessage(res.errorMessage);
      }
    },
    [profile]
  );

  const toggleTheme = useCallback(async () => {
    const next: ResolvedTheme = theme === "dark" ? "light" : "dark";
    await setTheme(next);
  }, [theme, setTheme]);

  const updateAppName = useCallback(
    async (rawAppName: string) => {
      const cleaned = rawAppName.trim() || "Cadernin";
      const res = await saveUserProfilePatch(profile, { app_name: cleaned });
      setProfile(res.profile);
      if (isSupabaseConfigured()) {
        setSupabaseStatus(res.synced ? "connected" : "error");
        if (res.errorMessage) setSupabaseMessage(res.errorMessage);
      }
      return {
        ok: true,
        missingColumn: res.missingAppNameColumn,
      };
    },
    [profile]
  );

  const updateDisplayName = useCallback(
    async (rawName: string): Promise<boolean> => {
      const cleaned = rawName.trim();
      if (!cleaned) return false;
      const res = await saveUserProfilePatch(profile, {
        display_name: cleaned,
      });
      setProfile(res.profile);
      if (isSupabaseConfigured()) {
        setSupabaseStatus(res.synced ? "connected" : "error");
        if (res.errorMessage) setSupabaseMessage(res.errorMessage);
      }
      return true;
    },
    [profile]
  );

  const updateSubtitle = useCallback(
    async (rawSubtitle: string): Promise<boolean> => {
      const cleaned = rawSubtitle.trim() || "Rumo à aprovação";
      const res = await saveUserProfilePatch(profile, { subtitle: cleaned });
      setProfile(res.profile);
      if (isSupabaseConfigured()) {
        setSupabaseStatus(res.synced ? "connected" : "error");
        if (res.errorMessage) setSupabaseMessage(res.errorMessage);
      }
      return true;
    },
    [profile]
  );

  const updateDailyGoalMinutes = useCallback(
    async (minutes: number): Promise<boolean> => {
      if (!Number.isFinite(minutes) || minutes <= 0) return false;
      const rounded = Math.round(minutes);
      const res = await saveUserProfilePatch(profile, {
        daily_goal_minutes: rounded,
      });
      setProfile(res.profile);
      return true;
    },
    [profile]
  );

  const updatePrioritySettings = useCallback(
    async (params: {
      priority_weights: PriorityWeights;
      decay_half_life_days: number;
      smoothing_c: number;
    }) => {
      const res = await saveUserProfilePatch(profile, {
        priority_weights: params.priority_weights,
        decay_half_life_days: Math.max(1, Math.round(params.decay_half_life_days)),
        smoothing_c: Math.max(0, Number(params.smoothing_c)),
      });
      setProfile(res.profile);
      if (isSupabaseConfigured()) {
        setSupabaseStatus(res.synced ? "connected" : "error");
        if (res.errorMessage) setSupabaseMessage(res.errorMessage);
      }
      return {
        ok: res.synced || !isSupabaseConfigured(),
        errorMessage: res.errorMessage,
      };
    },
    [profile]
  );

  const updateFsrsSettings = useCallback(
    async (params: {
      fsrs_target_retention: number;
      auto_mode_urgency_weight: number;
    }) => {
      const res = await saveUserProfilePatch(profile, {
        fsrs_target_retention: Math.min(
          0.95,
          Math.max(0.8, Math.round(params.fsrs_target_retention * 100) / 100)
        ),
        auto_mode_urgency_weight: Math.min(
          1,
          Math.max(0, Math.round(params.auto_mode_urgency_weight * 100) / 100)
        ),
      });
      setProfile(res.profile);
      return {
        ok: res.synced || !isSupabaseConfigured(),
        errorMessage: res.errorMessage,
      };
    },
    [profile]
  );

  const uploadProfileImage = useCallback(
    async (kind: ProfileImageKind, file: File) => {
      const label = kind === "avatar" ? "Foto de perfil" : "Capa do cabeçalho";

      try {
        setUploadFeedback({
          kind,
          status: "compressing",
          message: `Comprimindo ${label.toLowerCase()} para WebP...`,
        });

        const compressed = await compressProfileImage(file, kind);

        setProfile((prev) => ({
          ...prev,
          [kind === "avatar" ? "avatar_url" : "header_url"]: compressed.dataUrl,
        }));

        setUploadFeedback({
          kind,
          status: "uploading",
          message: `Enviando ${
            kind === "avatar" ? "avatar.webp" : "header.webp"
          } (${formatFileSize(compressed.sizeBytes)}, ${compressed.width}×${
            compressed.height
          }px)...`,
        });

        const result = await uploadProfileAsset(
          kind,
          compressed.blob,
          compressed.dataUrl,
          profile
        );

        setProfile(result.profile);

        if (result.synced) {
          setSupabaseStatus("connected");
          setUploadFeedback({
            kind,
            status: "success",
            message: `${label} salva em WebP · ${formatFileSize(
              compressed.sizeBytes
            )} (${compressed.width}×${compressed.height}px)`,
          });
        } else {
          setUploadFeedback({
            kind,
            status: "warning",
            message: `${label} comprimida (${formatFileSize(
              compressed.sizeBytes
            )}, ${compressed.width}×${
              compressed.height
            }px) em preview local. ${result.errorMessage ?? ""}`.trim(),
          });
        }
      } catch (err) {
        setUploadFeedback({
          kind,
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Não foi possível processar a imagem selecionada.",
        });
      }
    },
    [profile]
  );

  const uploadCroppedProfileImage = useCallback(
    async (
      kind: ProfileImageKind,
      imageSrc: string,
      croppedAreaPixels: CropAreaPixels,
      originalSizeBytes = 0
    ) => {
      const label = kind === "avatar" ? "Foto de perfil" : "Capa do cabeçalho";

      try {
        setUploadFeedback({
          kind,
          status: "compressing",
          message: `Recortando e comprimindo ${label.toLowerCase()} para WebP...`,
        });

        const compressed = await compressCroppedProfileImage(
          imageSrc,
          croppedAreaPixels,
          kind,
          originalSizeBytes
        );

        setProfile((prev) => ({
          ...prev,
          [kind === "avatar" ? "avatar_url" : "header_url"]: compressed.dataUrl,
        }));

        setUploadFeedback({
          kind,
          status: "uploading",
          message: `Enviando ${
            kind === "avatar" ? "avatar.webp" : "header.webp"
          } (${formatFileSize(compressed.sizeBytes)}, ${compressed.width}×${
            compressed.height
          }px)...`,
        });

        const result = await uploadProfileAsset(
          kind,
          compressed.blob,
          compressed.dataUrl,
          profile
        );

        setProfile(result.profile);

        if (result.synced) {
          setSupabaseStatus("connected");
          setUploadFeedback({
            kind,
            status: "success",
            message: `${label} salva em WebP · ${formatFileSize(
              compressed.sizeBytes
            )} (${compressed.width}×${compressed.height}px)`,
          });
        } else {
          setUploadFeedback({
            kind,
            status: "warning",
            message: `${label} recortada (${formatFileSize(
              compressed.sizeBytes
            )}) em preview local. ${result.errorMessage ?? ""}`.trim(),
          });
        }
      } catch (err) {
        setUploadFeedback({
          kind,
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Não foi possível processar a imagem recortada.",
        });
      }
    },
    [profile]
  );

  const removeProfileImage = useCallback(
    async (kind: ProfileImageKind) => {
      const fieldKey = kind === "avatar" ? "avatar_url" : "header_url";
      const res = await saveUserProfilePatch(profile, { [fieldKey]: null });
      setProfile(res.profile);
    },
    [profile]
  );

  const clearUploadFeedback = useCallback(() => {
    setUploadFeedback(null);
  }, []);

  const value = useMemo<ProfileThemeContextValue>(
    () => ({
      profile,
      theme,
      isHydrated,
      supabaseStatus,
      supabaseMessage,
      uploadFeedback,
      clearUploadFeedback,
      setTheme,
      toggleTheme,
      updateAppName,
      updateDisplayName,
      updateSubtitle,
      updateDailyGoalMinutes,
      updatePrioritySettings,
      updateFsrsSettings,
      uploadProfileImage,
      uploadCroppedProfileImage,
      removeProfileImage,
      refreshProfile,
    }),
    [
      profile,
      theme,
      isHydrated,
      supabaseStatus,
      supabaseMessage,
      uploadFeedback,
      clearUploadFeedback,
      setTheme,
      toggleTheme,
      updateAppName,
      updateDisplayName,
      updateSubtitle,
      updateDailyGoalMinutes,
      updatePrioritySettings,
      updateFsrsSettings,
      uploadProfileImage,
      uploadCroppedProfileImage,
      removeProfileImage,
      refreshProfile,
    ]
  );

  return (
    <ProfileThemeContext.Provider value={value}>
      {children}
    </ProfileThemeContext.Provider>
  );
}

export function useProfileTheme(): ProfileThemeContextValue {
  const ctx = useContext(ProfileThemeContext);
  if (!ctx) {
    throw new Error(
      "useProfileTheme deve ser utilizado dentro de ProfileThemeProvider."
    );
  }
  return ctx;
}
