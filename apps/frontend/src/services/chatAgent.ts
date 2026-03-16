type ChatPayload = {
  message: string;
  sessionId: string;
  channel: string;
  source: string;
};

export type ChatReply = {
  reply: string;
  sessionId: string;
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

    const nestedReply =
      extractReply(value.data) ??
      extractReply(value.json) ??
      extractReply(value.body);

    if (nestedReply) return nestedReply;
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

export const sendMessageToAgent = async (
  webhookUrl: string,
  payload: ChatPayload,
): Promise<ChatReply> => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Falha ao chamar agente (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const rawText = (await response.text()).trim();
    return {
      reply: rawText || "Mensagem recebida. Em breve retorno com mais detalhes.",
      sessionId: payload.sessionId,
    };
  }

  const body = (await response.json()) as unknown;
  const reply =
    extractReply(body) ||
    "Recebi sua mensagem, mas o fluxo do n8n nao retornou um texto reconhecivel.";
  const sessionId = extractSessionId(body) || payload.sessionId;

  return { reply, sessionId };
};
