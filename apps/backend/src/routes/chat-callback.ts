import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sendRouteError } from "../lib/reply.js";
import { RouteError } from "../lib/route-error.js";
import { chatEventBus } from "../services/chat-events.js";
import {
  appendChatMessage,
  getChatSessionOwnerUserId,
  isChatHistoryEnabled,
} from "../services/chat-history.js";

type ChatCallbackStatus = "buffering" | "processing" | "reply" | "error";

type ChatCallbackRequestBody = {
  sessionId?: string;
  status?: ChatCallbackStatus;
  reply?: string;
  message?: string;
  bufferWindowMs?: number;
  queuedMessages?: number;
};

const requireCallbackSecret = (callbackSecretHeader?: string) => {
  if (!env.n8nChatCallbackSecret) {
    throw new RouteError(
      500,
      "Missing server configuration. Configure N8N_CHAT_CALLBACK_SECRET.",
    );
  }

  if (callbackSecretHeader?.trim() !== env.n8nChatCallbackSecret) {
    throw new RouteError(401, "Invalid n8n callback secret.");
  }
};

const normalizeSecretHeader = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const registerChatCallbackRoute = (app: FastifyInstance) => {
  app.post<{ Body: ChatCallbackRequestBody }>(
      "/api/chat/callback",
    async (request, reply) => {
      try {
        requireCallbackSecret(
          normalizeSecretHeader(request.headers["x-n8n-callback-secret"]),
        );

        const sessionId = request.body.sessionId?.trim();
        const status = request.body.status;

        if (!sessionId) {
          throw new RouteError(400, "sessionId is required.");
        }

        if (!status) {
          throw new RouteError(400, "status is required.");
        }

        if (!chatEventBus.hasSession(sessionId)) {
          throw new RouteError(404, "Chat session not found.");
        }

        switch (status) {
          case "buffering": {
            const queuedMessages =
              typeof request.body.queuedMessages === "number" &&
              Number.isFinite(request.body.queuedMessages)
                ? request.body.queuedMessages
                : 1;
            const bufferWindowMs =
              typeof request.body.bufferWindowMs === "number" &&
              Number.isFinite(request.body.bufferWindowMs)
                ? request.body.bufferWindowMs
                : env.chatBufferWindowMs;

            chatEventBus.publishBuffering(sessionId, bufferWindowMs, queuedMessages);
            return reply.code(202).send({
              accepted: true,
              sessionId,
              status,
            });
          }

          case "processing":
            chatEventBus.publishProcessing(sessionId);
            return reply.code(202).send({
              accepted: true,
              sessionId,
              status,
            });

          case "reply": {
            const replyText = request.body.reply?.trim();

            if (!replyText) {
              throw new RouteError(400, "reply is required when status is reply.");
            }

            chatEventBus.publishReply(sessionId, replyText);

            if (isChatHistoryEnabled()) {
              try {
                const ownerUserId = await getChatSessionOwnerUserId(sessionId);

                if (!ownerUserId) {
                  console.error("chat-history-assistant-reply-missing-session-owner", {
                    sessionId,
                  });
                } else {
                  await appendChatMessage({
                    sessionId,
                    userId: ownerUserId,
                    role: "assistant",
                    content: replyText,
                    metadata: {
                      source: "n8n-callback",
                    },
                  });
                }
              } catch (historyError) {
                console.error("chat-history-assistant-reply-persist-error", {
                  sessionId,
                  error: historyError,
                });
              }
            }

            return reply.code(202).send({
              accepted: true,
              sessionId,
              status,
            });
          }

          case "error": {
            const errorMessage = request.body.message?.trim();

            if (!errorMessage) {
              throw new RouteError(400, "message is required when status is error.");
            }

            chatEventBus.publishError(sessionId, errorMessage);
            return reply.code(202).send({
              accepted: true,
              sessionId,
              status,
            });
          }
        }

        throw new RouteError(400, "Unsupported callback status.");
      } catch (error) {
        return sendRouteError(reply, error);
      }
    },
  );
};
