import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { RouteError } from "../lib/route-error.js";

type UserProfileRow = {
  full_name: string | null;
  preferred_language: string | null;
  origin_city: string | null;
  interests: string[] | null;
  travel_style: string[] | null;
  budget_profile: string | null;
  companions_summary: string | null;
  notes: string | null;
  updated_at: string | null;
};

export type ChatUserInfo = {
  id: string;
  email: string | null;
  fullName: string | null;
  preferredLanguage: string;
  originCity: string | null;
  interests: string[];
  travelStyle: string[];
  budgetProfile: string | null;
  companionsSummary: string | null;
  notes: string | null;
  updatedAt: string | null;
};

export type AuthenticatedChatContext = {
  accessToken: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  profileExists: boolean;
  userInfo: ChatUserInfo;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeStringArray = (value: string[] | null | undefined): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const pickMetadataString = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) return null;

  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
};

export const ensureChatConfig = () => {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.n8nChatWebhookUrl) {
    throw new RouteError(
      500,
      "Missing server configuration. Configure SUPABASE_URL, SUPABASE_ANON_KEY and N8N_CHAT_WEBHOOK_URL.",
    );
  }
};

export const requireAccessToken = (authorizationHeader?: string) => {
  const accessToken = authorizationHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";

  if (!accessToken) {
    throw new RouteError(401, "Authorization bearer token is required.");
  }

  return accessToken;
};

export const getAuthenticatedChatContext = async (
  accessToken: string,
): Promise<AuthenticatedChatContext> => {
  ensureChatConfig();

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    throw new RouteError(401, "Invalid or expired auth token.");
  }

  const authenticatedSupabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: profile, error: profileError } = await authenticatedSupabase
    .from("user_profiles")
    .select(
      "full_name, preferred_language, origin_city, interests, travel_style, budget_profile, companions_summary, notes, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle<UserProfileRow>();

  if (profileError) {
    console.error("profile-lookup-error", profileError);
  }

  const metadataFullName = pickMetadataString(user.user_metadata, "full_name");
  const fullName = profile?.full_name?.trim() || metadataFullName || null;

  return {
    accessToken,
    userId: user.id,
    email: user.email ?? null,
    fullName,
    profileExists: Boolean(profile),
    userInfo: {
      id: user.id,
      email: user.email ?? null,
      fullName,
      preferredLanguage: profile?.preferred_language ?? "pt-BR",
      originCity: profile?.origin_city ?? null,
      interests: normalizeStringArray(profile?.interests),
      travelStyle: normalizeStringArray(profile?.travel_style),
      budgetProfile: profile?.budget_profile ?? null,
      companionsSummary: profile?.companions_summary ?? null,
      notes: profile?.notes ?? null,
      updatedAt: profile?.updated_at ?? null,
    },
  };
};
