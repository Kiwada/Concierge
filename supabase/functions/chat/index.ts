import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
const N8N_CHAT_WEBHOOK_URL = Deno.env.get("N8N_CHAT_WEBHOOK_URL")?.trim();
const N8N_CHAT_CHANNEL = Deno.env.get("N8N_CHAT_CHANNEL")?.trim() || "web";
const N8N_CHAT_SOURCE = Deno.env.get("N8N_CHAT_SOURCE")?.trim() || "concierge-web";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN")?.trim() || "*";

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

const buildCorsHeaders = () => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
});

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(),
      "Content-Type": "application/json",
    },
  });

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

    return (
      extractReply(value.data) ??
      extractReply(value.json) ??
      extractReply(value.body)
    );
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders() });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !N8N_CHAT_WEBHOOK_URL) {
    return jsonResponse(
      {
        error:
          "Missing server configuration. Configure SUPABASE_URL, SUPABASE_ANON_KEY and N8N_CHAT_WEBHOOK_URL.",
      },
      500,
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return jsonResponse({ error: "Authorization bearer token is required." }, 401);
  }

  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const message = body.message?.trim();
  const sessionId = body.sessionId?.trim() || crypto.randomUUID();

  if (!message) {
    return jsonResponse({ error: "message is required." }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse({ error: "Invalid or expired auth token." }, 401);
  }

  const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  const upstreamResponse = await fetch(N8N_CHAT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      sessionId,
      channel: N8N_CHAT_CHANNEL,
      source: N8N_CHAT_SOURCE,
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
    return jsonResponse(
      {
        error: `Upstream n8n webhook failed with status ${upstreamResponse.status}.`,
      },
      502,
    );
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const rawText = (await upstreamResponse.text()).trim();

    return jsonResponse({
      reply: rawText || "Mensagem recebida. Em breve retorno com mais detalhes.",
      sessionId,
    });
  }

  const upstreamBody = (await upstreamResponse.json()) as unknown;
  const reply =
    extractReply(upstreamBody) ||
    "Recebi sua mensagem, mas o n8n nao retornou um texto reconhecivel.";
  const nextSessionId = extractSessionId(upstreamBody) || sessionId;

  return jsonResponse({
    reply,
    sessionId: nextSessionId,
  });
});
