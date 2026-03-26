import "dotenv/config";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import { buildCorsHeaders, sendJson } from "./lib/http.js";
import { handleChatRoute } from "./routes/chat.js";

const server = createServer(async (request, response) => {
  const baseUrl = `http://${request.headers.host ?? "localhost"}`;
  const url = new URL(request.url ?? "/", baseUrl);

  if (request.method === "OPTIONS") {
    response.writeHead(204, buildCorsHeaders(env.allowedOrigin));
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, { status: "ok" }, env.allowedOrigin);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
    await handleChatRoute(request, response);
    return;
  }

  sendJson(response, 404, { error: "Route not found." }, env.allowedOrigin);
});

server.listen(env.port, () => {
  console.info(`Concierge backend listening on http://localhost:${env.port}`);
});
