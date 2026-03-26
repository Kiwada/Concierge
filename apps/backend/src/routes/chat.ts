import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { readJsonBody, sendJson } from "../lib/http.js";

type ChatRequest = {
  message?: string;
  sessionId?: string;
};

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

const CANDIDATE_REPLY_KEYS = [
  "reply",
  "response",
  "message",
  "output",
  "text",
  "answer",
] as const;

const CANDIDATE_SESSION_KEYS = [
  "sessionId",
  "session_id",
  "conversationId",
  "threadId",
  "chatId",
] as const;

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

const pickString = (
  object: Record<string, unknown>,
  keys: readonly string[],
): string | null => {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const extractReply = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const reply = extractReply(item);
      if (reply) return reply;
    }

    return null;
  }

  if (isRecord(value)) {
    const directReply = pickString(value, CANDIDATE_REPLY_KEYS);
    if (directReply) return directReply;

    return extractReply(value.data) ?? extractReply(value.json) ?? extractReply(value.body);
  }

  return null;
};

const extractSessionId = (value: unknown): string | null => {
  if (!isRecord(value)) return null;

  const directSession = pickString(value, CANDIDATE_SESSION_KEYS);
  if (directSession) return directSession;

  return (
    extractSessionId(value.data) ??
    extractSessionId(value.json) ??
    extractSessionId(value.body)
  );
};

export const handleChatRoute = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.n8nChatWebhookUrl) {
    sendJson(
      response,
      500,
      {
        error:
          "Missing server configuration. Configure SUPABASE_URL, SUPABASE_ANON_KEY and N8N_CHAT_WEBHOOK_URL.",
      },
      env.allowedOrigin,
    );
    return;
  }

  const authHeader = request.headers.authorization ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    sendJson(
      response,
      401,
      { error: "Authorization bearer token is required." },
      env.allowedOrigin,
    );
    return;
  }

  let body: ChatRequest;

  try {
    body = await readJsonBody<ChatRequest>(request);
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body." }, env.allowedOrigin);
    return;
  }

  const message = body.message?.trim();
  const sessionId = body.sessionId?.trim() || crypto.randomUUID();

  if (!message) {
    sendJson(response, 400, { error: "message is required." }, env.allowedOrigin);
    return;
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    sendJson(
      response,
      401,
      { error: "Invalid or expired auth token." },
      env.allowedOrigin,
    );
    return;
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

  const upstreamResponse = await fetch(env.n8nChatWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      sessionId,
      channel: env.n8nChatChannel,
      source: env.n8nChatSource,
      user: {
        id: user.id,
        email: user.email ?? null,
        fullName,
      },
      profile: {
        exists: Boolean(profile),
        preferredLanguage: profile?.preferred_language ?? "pt-BR",
        originCity: profile?.origin_city ?? null,
        interests: normalizeStringArray(profile?.interests),
        travelStyle: normalizeStringArray(profile?.travel_style),
        budgetProfile: profile?.budget_profile ?? null,
        companionsSummary: profile?.companions_summary ?? null,
        notes: profile?.notes ?? null,
        updatedAt: profile?.updated_at ?? null,
      },
    }),
  });

  if (!upstreamResponse.ok) {
    sendJson(
      response,
      502,
      {
        error: `Upstream n8n webhook failed with status ${upstreamResponse.status}.`,
      },
      env.allowedOrigin,
    );
    return;
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const rawText = (await upstreamResponse.text()).trim();

    sendJson(
      response,
      200,
      {
        reply: rawText || "Mensagem recebida. Em breve retorno com mais detalhes.",
        sessionId,
      },
      env.allowedOrigin,
    );
    return;
  }

  const upstreamBody = (await upstreamResponse.json()) as unknown;
  const reply =
    extractReply(upstreamBody) ||
    "Recebi sua mensagem, mas o backend nao recebeu um texto reconhecivel do n8n.";
  const nextSessionId = extractSessionId(upstreamBody) || sessionId;

  sendJson(
    response,
    200,
    {
      reply,
      sessionId: nextSessionId,
    },
    env.allowedOrigin,
  );
};
