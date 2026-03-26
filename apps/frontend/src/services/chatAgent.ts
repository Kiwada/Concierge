import { isSupabaseConfigured, supabase } from "../lib/supabase";

type ChatPayload = {
  message: string;
  sessionId: string;
};

export type ChatReply = {
  reply: string;
  sessionId: string;
};

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim()?.replace(/\/+$/, "") ?? "";

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

const invokeNodeBackend = async (payload: ChatPayload): Promise<ChatReply> => {
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
