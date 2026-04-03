import { isSupabaseConfigured, supabase } from "../lib/supabase";

type ChatPayload = {
  message: string;
  sessionId: string;
};

export type ChatAccepted = {
  accepted: true;
  sessionId: string;
  status: "buffering";
  bufferWindowMs: number;
};

export type ChatReply = {
  reply: string;
  sessionId: string;
};

export type ChatHistoryMessage = {
  id: string;
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ChatStreamEvent =
  | {
      type: "connected";
      payload: {
        sessionId: string;
      };
    }
  | {
      type: "buffering";
      payload: {
        sessionId: string;
        status: "buffering";
        bufferWindowMs: number;
        queuedMessages: number;
      };
    }
  | {
      type: "processing";
      payload: {
        sessionId: string;
        status: "processing";
      };
    }
  | {
      type: "reply";
      payload: {
        sessionId: string;
        messageId: string;
        reply: string;
        createdAt: string;
      };
    }
  | {
      type: "error";
      payload: {
        sessionId: string;
        message: string;
      };
    }
  | {
      type: "ping";
      payload: {
        ts: string;
      };
    };

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim()?.replace(/\/+$/, "") ?? "";
export const isAsyncChatTransportEnabled = Boolean(apiBaseUrl);

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

const extractErrorMessage = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!isRecord(value)) return null;

  return (
    pickString(value, ["error", "message"]) ??
    extractErrorMessage(value.error) ??
    extractErrorMessage(value.message)
  );
};

const getAccessToken = async () => {
  if (!supabase) {
    throw new Error(
      "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();

  if (sessionError || !accessToken) {
    throw new Error("Sessao autenticada nao encontrada. Entre novamente para usar o concierge.");
  }

  return accessToken;
};

const invokeNodeBackend = async (payload: ChatPayload): Promise<ChatReply> => {
  const accessToken = await getAccessToken();

  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    let errorMessage = "Nao consegui falar com o agente agora. Tente novamente em instantes.";

    try {
      if (contentType.includes("application/json")) {
        const body = (await response.json()) as unknown;
        errorMessage = extractErrorMessage(body) || errorMessage;
      } else {
        const rawText = (await response.text()).trim();
        if (rawText) errorMessage = rawText;
      }
    } catch {
      // Keep default message when the backend error response is unreadable.
    }

    throw new Error(errorMessage);
  }

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
    "Recebi sua mensagem, mas o backend autenticado nao retornou um texto reconhecivel.";
  const sessionId = extractSessionId(body) || payload.sessionId;

  return { reply, sessionId };
};

export const enqueueMessageToAgent = async (
  payload: ChatPayload,
): Promise<ChatAccepted> => {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_URL nao configurado para o fluxo assincrono do concierge.");
  }

  const accessToken = await getAccessToken();

  const response = await fetch(`${apiBaseUrl}/api/chat/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    let errorMessage = "Nao consegui enfileirar sua mensagem agora. Tente novamente em instantes.";

    try {
      if (contentType.includes("application/json")) {
        const body = (await response.json()) as unknown;
        errorMessage = extractErrorMessage(body) || errorMessage;
      } else {
        const rawText = (await response.text()).trim();
        if (rawText) errorMessage = rawText;
      }
    } catch {
      // Keep default message when the backend error response is unreadable.
    }

    throw new Error(errorMessage);
  }

  const body = (await response.json()) as Partial<ChatAccepted> | null;

  return {
    accepted: true,
    sessionId: body?.sessionId?.trim() || payload.sessionId,
    status: "buffering",
    bufferWindowMs:
      typeof body?.bufferWindowMs === "number" && Number.isFinite(body.bufferWindowMs)
        ? body.bufferWindowMs
        : 4000,
  };
};

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const parseEventChunk = (chunk: string): ChatStreamEvent[] => {
  const events: ChatStreamEvent[] = [];
  const normalizedChunk = chunk.replace(/\r/g, "");

  for (const rawEvent of normalizedChunk.split("\n\n")) {
    const trimmedEvent = rawEvent.trim();
    if (!trimmedEvent) continue;

    let eventType = "message";
    const dataLines: string[] = [];

    for (const line of trimmedEvent.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice("event:".length).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }

    const payload = tryParseJson(dataLines.join("\n"));

    if (
      eventType === "connected" ||
      eventType === "buffering" ||
      eventType === "processing" ||
      eventType === "reply" ||
      eventType === "error" ||
      eventType === "ping"
    ) {
      events.push({
        type: eventType,
        payload,
      } as ChatStreamEvent);
    }
  }

  return events;
};

export const subscribeToAgentEvents = async ({
  sessionId,
  signal,
  onEvent,
}: {
  sessionId: string;
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}) => {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_URL nao configurado para o stream do concierge.");
  }

  const accessToken = await getAccessToken();

  const response = await fetch(
    `${apiBaseUrl}/api/chat/events/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    },
  );

  if (!response.ok) {
    let errorMessage =
      "Nao consegui abrir o stream de eventos do concierge. Tente novamente em instantes.";

    try {
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const body = (await response.json()) as unknown;
        errorMessage = extractErrorMessage(body) || errorMessage;
      } else {
        const rawText = (await response.text()).trim();
        if (rawText) errorMessage = rawText;
      }
    } catch {
      // Keep default message when the stream error response is unreadable.
    }

    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("O backend nao abriu um corpo de stream para o chat.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      for (const event of parseEventChunk(rawEvent)) {
        onEvent(event);
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) {
    for (const event of parseEventChunk(buffer)) {
      onEvent(event);
    }
  }
};

export const fetchChatHistory = async (
  sessionId: string,
): Promise<ChatHistoryMessage[]> => {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_URL nao configurado para o historico do concierge.");
  }

  const accessToken = await getAccessToken();

  const response = await fetch(
    `${apiBaseUrl}/api/chat/history/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    let errorMessage =
      "Nao consegui carregar o historico desta conversa agora. Tente novamente em instantes.";

    try {
      if (contentType.includes("application/json")) {
        const body = (await response.json()) as unknown;
        errorMessage = extractErrorMessage(body) || errorMessage;
      } else {
        const rawText = (await response.text()).trim();
        if (rawText) errorMessage = rawText;
      }
    } catch {
      // Keep default message when the backend error response is unreadable.
    }

    throw new Error(errorMessage);
  }

  const body = (await response.json()) as
    | {
        sessionId?: string;
        messages?: ChatHistoryMessage[];
      }
    | null;

  if (!Array.isArray(body?.messages)) {
    return [];
  }

  return body.messages.filter(
    (message): message is ChatHistoryMessage =>
      typeof message?.id === "string" &&
      (message?.role === "user" || message?.role === "assistant") &&
      typeof message?.content === "string",
  );
};

export const sendMessageToAgent = async (payload: ChatPayload): Promise<ChatReply> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  if (apiBaseUrl) {
    return invokeNodeBackend(payload);
  }

  const { data, error, response } = await supabase.functions.invoke("chat", {
    body: payload,
  });

  if (error) {
    let errorMessage = "Nao consegui falar com o agente agora. Tente novamente em instantes.";

    if (response) {
      const contentType = response.headers.get("content-type") ?? "";

      try {
        if (contentType.includes("application/json")) {
          const body = (await response.json()) as unknown;
          errorMessage = extractErrorMessage(body) || errorMessage;
        } else {
          const rawText = (await response.text()).trim();
          if (rawText) errorMessage = rawText;
        }
      } catch {
        // Keep the default message when the upstream error body is unreadable.
      }
    }

    throw new Error(errorMessage);
  }

  const contentType = response?.headers.get("content-type") ?? "application/json";

  if (!contentType.includes("application/json")) {
    const rawText = typeof data === "string" ? data.trim() : "";
    return {
      reply: rawText || "Mensagem recebida. Em breve retorno com mais detalhes.",
      sessionId: payload.sessionId,
    };
  }

  const body = data as unknown;
  const reply =
    extractReply(body) ||
    "Recebi sua mensagem, mas o fluxo autenticado nao retornou um texto reconhecivel.";
  const sessionId = extractSessionId(body) || payload.sessionId;

  return { reply, sessionId };
};
