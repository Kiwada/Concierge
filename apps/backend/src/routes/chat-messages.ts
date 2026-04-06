import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sendRouteError } from "../lib/reply.js";
import { RouteError } from "../lib/route-error.js";
import {
  getAuthenticatedChatContext,
  requireAccessToken,
} from "../services/chat-auth.js";
import { chatEventBus } from "../services/chat-events.js";
import {
  appendChatMessage,
  ensureChatSession,
  isChatHistoryEnabled,
} from "../services/chat-history.js";
import { callChatWebhook } from "../services/chat-upstream.js";

type ChatMessagesRequestBody = {
  message?: string;
  sessionId?: string;
};

export const registerChatMessagesRoute = (app: FastifyInstance) => {
  app.post<{ Body: ChatMessagesRequestBody }>(
    "/api/chat/messages",
    async (request, reply) => {
      let stage = "start";
      let sessionId: string | null = null;

      try {
        stage = "require-access-token";
        const accessToken = requireAccessToken(request.headers.authorization);
        stage = "parse-body";
        const message = request.body.message?.trim();
        sessionId = request.body.sessionId?.trim() || crypto.randomUUID();
        let activeSessionId = sessionId;

        if (!message) {
          throw new RouteError(400, "message is required.");
        }

        stage = "load-chat-context";
        const chatContext = await getAuthenticatedChatContext(accessToken);

        stage = "register-queued-message";
        try {
          chatEventBus.registerQueuedMessage(
            activeSessionId,
            chatContext.userId,
            env.chatBufferWindowMs,
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "chat-session-owner-mismatch"
          ) {
            console.warn("chat-session-owner-mismatch-reset", {
              previousSessionId: activeSessionId,
              userId: chatContext.userId,
            });

            activeSessionId = crypto.randomUUID();
            sessionId = activeSessionId;

            chatEventBus.registerQueuedMessage(
              activeSessionId,
              chatContext.userId,
              env.chatBufferWindowMs,
            );
          } else {
            throw error;
          }
        }

        if (isChatHistoryEnabled()) {
          stage = "persist-user-message";

          try {
            await ensureChatSession({
              sessionId: activeSessionId,
              userId: chatContext.userId,
              title: message,
            });

            await appendChatMessage({
              sessionId: activeSessionId,
              userId: chatContext.userId,
              role: "user",
              content: message,
              metadata: {
                channel: env.n8nChatChannel,
                source: env.n8nChatSource,
              },
            });
          } catch (historyError) {
            console.error("chat-history-user-message-persist-error", {
              sessionId: activeSessionId,
              error: historyError,
            });
          }
        }

        stage = "dispatch-upstream";
        void callChatWebhook({
          message,
          sessionId: activeSessionId,
          channel: env.n8nChatChannel,
          source: env.n8nChatSource,
          userInfo: chatContext.userInfo,
        })
          .then((upstream) => {
            if (upstream.reply) {
              chatEventBus.publishReply(activeSessionId, upstream.reply);
            }
          })
          .catch((error) => {
            const fallbackMessage =
              error instanceof Error
                ? error.message
                : "Nao foi possivel concluir a resposta da Lia.";

            console.error("chat-messages-upstream-error", {
              sessionId: activeSessionId,
              error,
            });
            chatEventBus.publishError(activeSessionId, fallbackMessage);
          });

        stage = "send-accepted";
        return reply.code(202).send({
          accepted: true,
          sessionId: activeSessionId,
          status: "buffering",
          bufferWindowMs: env.chatBufferWindowMs,
        });
      } catch (error) {
        console.error("chat-messages-route-error", {
          stage,
          sessionId,
          hasAuthorizationHeader: Boolean(request.headers.authorization),
          hasMessage: Boolean(request.body.message?.trim()),
          error,
        });
        return sendRouteError(reply, error);
      }
    },
  );
};
