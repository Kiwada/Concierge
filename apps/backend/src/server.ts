import "dotenv/config";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { registerChatCallbackRoute } from "./routes/chat-callback.js";
import { registerChatEventsRoute } from "./routes/chat-events.js";
import { registerChatHistoryRoute } from "./routes/chat-history.js";
import { registerChatMessagesRoute } from "./routes/chat-messages.js";
import { registerChatRoute } from "./routes/chat.js";

const app = Fastify({
  logger: true,
});

app.addHook("onRequest", async (_request, reply) => {
  reply.header("Access-Control-Allow-Origin", env.allowedOrigin);
  reply.header(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type",
  );
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  reply.header("Cache-Control", "no-store");
});

app.options("/*", async (_request, reply) => {
  reply.code(204).send();
});

app.get("/healthz", async () => ({
  status: "ok",
}));

registerChatRoute(app);
registerChatMessagesRoute(app);
registerChatHistoryRoute(app);
registerChatEventsRoute(app);
registerChatCallbackRoute(app);

app.setNotFoundHandler(async (_request, reply) => {
  reply.code(404).send({ error: "Route not found." });
});

const start = async () => {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: env.port,
    });

    console.info(`Concierge backend listening on http://localhost:${env.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
