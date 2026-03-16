/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_CHAT_WEBHOOK_URL?: string;
  readonly VITE_CHAT_CHANNEL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
