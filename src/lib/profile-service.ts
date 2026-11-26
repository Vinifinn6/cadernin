import {
  getSupabaseClient,
  isSupabaseConfigured,
  PROFILE_ASSETS_BUCKET,
  SINGLE_USER_PROFILE_ID,
} from "@/lib/supabase/client";
import type { ProfileImageKind } from "@/lib/image-compress";
import {
  DEFAULT_PRIORITY_WEIGHTS,
  type PriorityWeights,
  type ThemePreference,
  type UserProfile,
} from "@/types/database";

const LOCAL_PROFILE_STORAGE_KEY = "cadernin_profile_v2";
const LEGACY_PROFILE_STORAGE_KEY = "caderno_editorial_profile_v1";
export const LOCAL_THEME_STORAGE_KEY = "caderno_editorial_theme_v1";

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: SINGLE_USER_PROFILE_ID,
  app_name: "Cadernin",
  display_name: "Estudante",
  subtitle: "Rumo à aprovação",
  avatar_url: null,
  header_url: null,
  theme_preference: "light",
  priority_weights: { ...DEFAULT_PRIORITY_WEIGHTS },
  decay_half_life_days: 30,
  smoothing_c: 3,
  daily_goal_minutes: 240,
  fsrs_target_retention: 0.86,
  auto_mode_urgency_weight: 0.65,
};

export function normalizePriorityWeights(raw: unknown): PriorityWeights {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PRIORITY_WEIGHTS };
  }
  const obj = raw as Record<string, unknown>;
  const pick = (key: keyof PriorityWeights): number => {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === "string") {
      const parsed = Number.parseFloat(v);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return DEFAULT_PRIORITY_WEIGHTS[key];
  };

  return {
    real_correct: pick("real_correct"),
    error_attention: pick("error_attention"),
    guess_1: pick("guess_1"),
    guess_2: pick("guess_2"),
    guess_3: pick("guess_3"),
    error_gap: pick("error_gap"),
    error_other: pick("error_other"),
  };
}

function normalizeProfile(
  raw: Partial<UserProfile> & { priority_weights?: unknown },
  fallback?: UserProfile
): UserProfile {
  const base = fallback ?? DEFAULT_USER_PROFILE;
  const appNameFromRaw =
    typeof raw.app_name === "string" && raw.app_name.trim()
      ? raw.app_name.trim()
      : base.app_name;

  return {
    ...base,
    ...raw,
    id: SINGLE_USER_PROFILE_ID,
    app_name: appNameFromRaw,
    display_name:
      typeof raw.display_name === "string" && raw.display_name.trim()
        ? raw.display_name
        : base.display_name,
    subtitle:
      typeof raw.subtitle === "string" ? raw.subtitle : base.subtitle,
    priority_weights: normalizePriorityWeights(raw.priority_weights),
    decay_half_life_days:
      typeof raw.decay_half_life_days === "number" &&
      raw.decay_half_life_days > 0
        ? raw.decay_half_life_days
        : base.decay_half_life_days,
    smoothing_c:
      raw.smoothing_c !== undefined && raw.smoothing_c !== null
        ? Number(raw.smoothing_c)
        : base.smoothing_c,
    daily_goal_minutes:
      typeof raw.daily_goal_minutes === "number" && raw.daily_goal_minutes > 0
        ? raw.daily_goal_minutes
        : base.daily_goal_minutes,
    fsrs_target_retention:
      raw.fsrs_target_retention !== undefined &&
      raw.fsrs_target_retention !== null &&
      Number.isFinite(Number(raw.fsrs_target_retention))
        ? Math.min(0.95, Math.max(0.8, Number(raw.fsrs_target_retention)))
        : base.fsrs_target_retention,
    auto_mode_urgency_weight:
      raw.auto_mode_urgency_weight !== undefined &&
      raw.auto_mode_urgency_weight !== null &&
      Number.isFinite(Number(raw.auto_mode_urgency_weight))
        ? Math.min(1, Math.max(0, Number(raw.auto_mode_urgency_weight)))
        : base.auto_mode_urgency_weight,
  };
}

export function readLocalProfile(): UserProfile {
  if (typeof window === "undefined") {
    return DEFAULT_USER_PROFILE;
  }

  try {
    const raw =
      window.localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return normalizeProfile(parsed, DEFAULT_USER_PROFILE);
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function writeLocalProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_PROFILE_STORAGE_KEY,
      JSON.stringify(profile)
    );
    if (
      profile.theme_preference === "dark" ||
      profile.theme_preference === "light"
    ) {
      window.localStorage.setItem(
        LOCAL_THEME_STORAGE_KEY,
        profile.theme_preference
      );
    }
  } catch {
    // Ignora quota excedida no localStorage
  }
}

export interface LoadProfileResult {
  profile: UserProfile;
  source: "supabase" | "local";
  errorMessage?: string;
}

export async function fetchUserProfile(): Promise<LoadProfileResult> {
  const localFallback = readLocalProfile();

  if (!isSupabaseConfigured()) {
    return { profile: localFallback, source: "local" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { profile: localFallback, source: "local" };
  }

  try {
    const { data, error } = await supabase
      .from("user_profile")
      .select("*")
      .eq("id", SINGLE_USER_PROFILE_ID)
      .maybeSingle();

    if (error) {
      return {
        profile: localFallback,
        source: "local",
        errorMessage: error.message,
      };
    }

    if (!data) {
      const payload: Record<string, unknown> = {
        id: SINGLE_USER_PROFILE_ID,
        app_name: localFallback.app_name,
        display_name: localFallback.display_name,
        subtitle: localFallback.subtitle,
        theme_preference: localFallback.theme_preference,
        priority_weights: localFallback.priority_weights,
        decay_half_life_days: localFallback.decay_half_life_days,
        smoothing_c: localFallback.smoothing_c,
        daily_goal_minutes: localFallback.daily_goal_minutes,
      };

      let { data: inserted, error: insertError } = await supabase
        .from("user_profile")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      // Compatibilidade se a coluna app_name ainda não existir no banco do usuário
      if (insertError && insertError.message.includes("app_name")) {
        delete payload.app_name;
        const retry = await supabase
          .from("user_profile")
          .upsert(payload, { onConflict: "id" })
          .select("*")
          .single();
        inserted = retry.data;
        insertError = retry.error;
      }

      if (insertError || !inserted) {
        return {
          profile: localFallback,
          source: "local",
          errorMessage: insertError?.message,
        };
      }

      const normalized = normalizeProfile(inserted, localFallback);
      writeLocalProfile(normalized);
      return { profile: normalized, source: "supabase" };
    }

    // Se a coluna app_name ainda não existir no banco, preserva o app_name local (ou "Cadernin")
    const normalized = normalizeProfile(data, localFallback);
    writeLocalProfile(normalized);
    return { profile: normalized, source: "supabase" };
  } catch (err) {
    return {
      profile: localFallback,
      source: "local",
      errorMessage:
        err instanceof Error ? err.message : "Erro ao conectar ao Supabase.",
    };
  }
}

export interface SaveProfilePatch {
  app_name?: string;
  display_name?: string;
  subtitle?: string;
  avatar_url?: string | null;
  header_url?: string | null;
  theme_preference?: ThemePreference;
  priority_weights?: PriorityWeights;
  daily_goal_minutes?: number;
  decay_half_life_days?: number;
  smoothing_c?: number;
  fsrs_target_retention?: number;
  auto_mode_urgency_weight?: number;
}

export async function saveUserProfilePatch(
  current: UserProfile,
  patch: SaveProfilePatch
): Promise<{
  profile: UserProfile;
  synced: boolean;
  missingAppNameColumn?: boolean;
  errorMessage?: string;
}> {
  const updated: UserProfile = {
    ...current,
    ...patch,
    id: SINGLE_USER_PROFILE_ID,
  };

  writeLocalProfile(updated);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { profile: updated, synced: false };
  }

  try {
    const payload: Record<string, unknown> = {
      id: SINGLE_USER_PROFILE_ID,
      ...patch,
    };

    let { data, error } = await supabase
      .from("user_profile")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    let missingAppNameColumn = false;

    // Fallback elegante se colunas novas (app_name / fsrs_*) ainda não existirem no banco
    if (
      error &&
      (error.message.includes("app_name") ||
        error.message.includes("fsrs_target_retention") ||
        error.message.includes("auto_mode_urgency_weight"))
    ) {
      if (error.message.includes("app_name")) {
        missingAppNameColumn = true;
        delete payload.app_name;
      }
      if (error.message.includes("fsrs_target_retention")) {
        delete payload.fsrs_target_retention;
      }
      if (error.message.includes("auto_mode_urgency_weight")) {
        delete payload.auto_mode_urgency_weight;
      }

      if (Object.keys(payload).length > 1) {
        const retry = await supabase
          .from("user_profile")
          .upsert(payload, { onConflict: "id" })
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      } else {
        return {
          profile: updated,
          synced: false,
          missingAppNameColumn,
          errorMessage:
            "Execute a migração SQL da Fase 6 no Supabase para sincronizar este ajuste na nuvem.",
        };
      }
    }

    if (error || !data) {
      return {
        profile: updated,
        synced: false,
        errorMessage: error?.message ?? "Não foi possível salvar no Supabase.",
      };
    }

    const normalized = normalizeProfile(data, updated);
    writeLocalProfile(normalized);
    return { profile: normalized, synced: true, missingAppNameColumn };
  } catch (err) {
    return {
      profile: updated,
      synced: false,
      errorMessage:
        err instanceof Error ? err.message : "Falha na sincronização.",
    };
  }
}

/**
 * Envia estritamente `avatar.webp` ou `header.webp` para o bucket `profile-assets`
 * com `upsert: true`, garantindo no máximo 2 arquivos no Storage.
 */
export async function uploadProfileAsset(
  kind: ProfileImageKind,
  blob: Blob,
  fallbackDataUrl: string,
  currentProfile: UserProfile
): Promise<{
  url: string;
  profile: UserProfile;
  synced: boolean;
  errorMessage?: string;
}> {
  const fileName = kind === "avatar" ? "avatar.webp" : "header.webp";
  const fieldKey = kind === "avatar" ? "avatar_url" : "header_url";

  const supabase = getSupabaseClient();
  if (!supabase) {
    const localProfile: UserProfile = {
      ...currentProfile,
      [fieldKey]: fallbackDataUrl,
    };
    writeLocalProfile(localProfile);
    return {
      url: fallbackDataUrl,
      profile: localProfile,
      synced: false,
      errorMessage:
        "Supabase não configurado — imagem salva apenas neste navegador.",
    };
  }

  try {
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_ASSETS_BUCKET)
      .upload(fileName, blob, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "3600",
      });

    if (uploadError) {
      return {
        url: fallbackDataUrl,
        profile: { ...currentProfile, [fieldKey]: fallbackDataUrl },
        synced: false,
        errorMessage: `Upload bloqueado pelo Storage: ${uploadError.message}`,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_ASSETS_BUCKET)
      .getPublicUrl(fileName);

    const versionedUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const saved = await saveUserProfilePatch(currentProfile, {
      [fieldKey]: versionedUrl,
    });

    return {
      url: versionedUrl,
      profile: saved.profile,
      synced: saved.synced,
      errorMessage: saved.errorMessage,
    };
  } catch (err) {
    return {
      url: fallbackDataUrl,
      profile: { ...currentProfile, [fieldKey]: fallbackDataUrl },
      synced: false,
      errorMessage:
        err instanceof Error ? err.message : "Erro ao enviar imagem.",
    };
  }
}
