const readEnv = (key: string) => process.env[key]?.trim() ?? "";

const normalizePort = (value: string) => {
  const parsedPort = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    return 3000;
  }

  return parsedPort;
};

const normalizePositiveInteger = (value: string, fallback: number) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

export const env = {
  port: normalizePort(readEnv("PORT")),
  allowedOrigin: readEnv("ALLOWED_ORIGIN") || "*",
  supabaseUrl: readEnv("SUPABASE_URL"),
  supabaseAnonKey: readEnv("SUPABASE_ANON_KEY"),
  n8nChatWebhookUrl: readEnv("N8N_CHAT_WEBHOOK_URL"),
  n8nChatCallbackSecret: readEnv("N8N_CHAT_CALLBACK_SECRET"),
  n8nChatChannel: readEnv("N8N_CHAT_CHANNEL") || "web",
  n8nChatSource: readEnv("N8N_CHAT_SOURCE") || "concierge-web",
  chatBufferWindowMs: normalizePositiveInteger(readEnv("CHAT_BUFFER_WINDOW_MS"), 4000),
};
