import type { IncomingMessage, ServerResponse } from "node:http";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export const buildCorsHeaders = (allowedOrigin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
});

export const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: JsonValue,
  allowedOrigin: string,
) => {
  response.writeHead(statusCode, {
    ...buildCorsHeaders(allowedOrigin),
    "Content-Type": "application/json",
  });

  response.end(JSON.stringify(body));
};

export const readJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(rawBody) as T;
};
