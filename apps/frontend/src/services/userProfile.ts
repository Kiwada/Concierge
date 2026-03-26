import { supabase } from "../lib/supabase";

export type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  preferred_language: string | null;
  origin_city: string | null;
  interests: string[] | null;
  travel_style: string[] | null;
  budget_profile: string | null;
  companions_summary: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UserProfilePatch = Partial<
  Pick<
    UserProfile,
    | "full_name"
    | "preferred_language"
    | "origin_city"
    | "interests"
    | "travel_style"
    | "budget_profile"
    | "companions_summary"
    | "notes"
  >
>;

const USER_PROFILE_COLUMNS =
  "id, user_id, full_name, preferred_language, origin_city, interests, travel_style, budget_profile, companions_summary, notes, created_at, updated_at";

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!supabase) {
    throw new Error(
      "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(USER_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<UserProfile>();

  if (error) {
    throw error;
  }

  return data;
};

export const saveUserProfilePatch = async (
  userId: string,
  patch: UserProfilePatch,
): Promise<UserProfile> => {
  if (!supabase) {
    throw new Error(
      "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  const existingProfile = await getUserProfile(userId);

  if (existingProfile) {
    const { data, error } = await supabase
      .from("user_profiles")
      .update(patch)
      .eq("user_id", userId)
      .select(USER_PROFILE_COLUMNS)
      .single<UserProfile>();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      preferred_language: "pt-BR",
      ...patch,
    })
    .select(USER_PROFILE_COLUMNS)
    .single<UserProfile>();

  if (error) {
    throw error;
  }

  return data;
};
