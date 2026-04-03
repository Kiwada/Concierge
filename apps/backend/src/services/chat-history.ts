import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { RouteError } from "../lib/route-error.js";

type ChatMessageRole = "user" | "assistant";

type ChatHistoryMessageRow = {
  id: string;
  session_id: string;
  user_id: string;
  role: ChatMessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ChatHistoryMessage = {
  id: string;
  sessionId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type EnsureChatSessionInput = {
  sessionId: string;
  userId: string;
  title?: string | null;
};

type AppendChatMessageInput = {
  sessionId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
};

const CHAT_SESSION_COLUMNS =
  "id, user_id, title, created_at, updated_at, last_message_at";
const CHAT_MESSAGE_COLUMNS =
  "id, session_id, user_id, role, content, metadata, created_at";

export const isChatHistoryEnabled = () =>
  Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);

const ensureChatHistoryConfig = () => {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new RouteError(
      500,
      "Missing server configuration. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
};

const createAdminSupabase = () => {
  ensureChatHistoryConfig();

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const normalizeTitle = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

const mapChatMessageRow = (row: ChatHistoryMessageRow): ChatHistoryMessage => ({
  id: row.id,
  sessionId: row.session_id,
  userId: row.user_id,
  role: row.role,
  content: row.content,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
});

export const ensureChatSession = async ({
  sessionId,
  userId,
  title,
}: EnsureChatSessionInput) => {
  const supabase = createAdminSupabase();
  const timestamp = new Date().toISOString();

  const { error } = await supabase.from("chat_sessions").upsert(
    {
      id: sessionId,
      user_id: userId,
      title: normalizeTitle(title),
      updated_at: timestamp,
      last_message_at: timestamp,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw error;
  }
};

export const appendChatMessage = async ({
  sessionId,
  userId,
  role,
  content,
  metadata = {},
}: AppendChatMessageInput) => {
  const supabase = createAdminSupabase();
  const timestamp = new Date().toISOString();

  const { error: messageError } = await supabase.from("chat_messages").insert({
    id: crypto.randomUUID(),
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    metadata,
  });

  if (messageError) {
    throw messageError;
  }

  const { error: sessionError } = await supabase
    .from("chat_sessions")
    .update({
      updated_at: timestamp,
      last_message_at: timestamp,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (sessionError) {
    throw sessionError;
  }
};

export const getChatSessionOwnerUserId = async (sessionId: string) => {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle<{ user_id: string }>();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
};

export const listChatMessages = async (sessionId: string, userId: string) => {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<ChatHistoryMessageRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapChatMessageRow);
};

export const listChatSessions = async (userId: string) => {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("chat_sessions")
    .select(CHAT_SESSION_COLUMNS)
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};
