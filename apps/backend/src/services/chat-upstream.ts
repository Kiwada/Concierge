import { env } from "../config/env.js";
import { RouteError } from "../lib/route-error.js";
import type { ChatUserInfo } from "./chat-auth.js";

type LegacyChatPayload = {
  message: string;
  sessionId: string;
  channel: string;
  source: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
  };
  profile: {
    exists: boolean;
    preferredLanguage: string;
    originCity: string | null;
    interests: string[];
    travelStyle: string[];
    budgetProfile: string | null;
    companionsSummary: string | null;
    notes: string | null;
    updatedAt: string | null;
  };
};

type CleanChatPayload = {
  message: string;
  sessionId: string;
  channel: string;
  source: string;
  userInfo: ChatUserInfo;
};

type UpstreamChatPayload = LegacyChatPayload | CleanChatPayload;

type UpstreamChatResponse = {
  reply: string | null;
  sessionId: string;
  raw: unknown;
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

export const callChatWebhook = async (
  payload: UpstreamChatPayload,
): Promise<UpstreamChatResponse> => {
  if (!env.n8nChatWebhookUrl) {
    throw new RouteError(
      500,
      "Missing server configuration. Configure N8N_CHAT_WEBHOOK_URL.",
    );
  }

  const upstreamResponse = await fetch(env.n8nChatWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!upstreamResponse.ok) {
    throw new RouteError(
      502,
      `Upstream n8n webhook failed with status ${upstreamResponse.status}.`,
    );
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  const rawBody = await upstreamResponse.text();
  const trimmedBody = rawBody.trim();

  if (!trimmedBody) {
    return {
      reply: null,
      sessionId: payload.sessionId,
      raw: null,
    };
  }

  if (!contentType.includes("application/json")) {
    return {
      reply: trimmedBody,
      sessionId: payload.sessionId,
      raw: trimmedBody,
    };
  }

  let upstreamBody: unknown;

  try {
    upstreamBody = JSON.parse(trimmedBody) as unknown;
  } catch {
    throw new RouteError(502, "Upstream n8n webhook returned invalid JSON.");
  }

  return {
    reply: extractReply(upstreamBody),
    sessionId: extractSessionId(upstreamBody) || payload.sessionId,
    raw: upstreamBody,
  };
};
