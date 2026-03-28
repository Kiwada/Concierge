import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sendRouteError } from "../lib/reply.js";
import { RouteError } from "../lib/route-error.js";
import {
  getAuthenticatedChatContext,
  requireAccessToken,
} from "../services/chat-auth.js";
import { chatEventBus } from "../services/chat-events.js";
import { callChatWebhook } from "../services/chat-upstream.js";

type ChatMessagesRequestBody = {
  message?: string;
  sessionId?: string;
};

export const registerChatMessagesRoute = (app: FastifyInstance) => {
  app.post<{ Body: ChatMessagesRequestBody }>(
    "/api/chat/messages",
    async (request, reply) => {
      try {
        const accessToken = requireAccessToken(request.headers.authorization);
        const message = request.body.message?.trim();
        const sessionId = request.body.sessionId?.trim() || crypto.randomUUID();

        if (!message) {
          throw new RouteError(400, "message is required.");
        }

        const chatContext = await getAuthenticatedChatContext(accessToken);

        chatEventBus.registerQueuedMessage(
          sessionId,
          chatContext.userId,
          env.chatBufferWindowMs,
        );

        void callChatWebhook({
          message,
          sessionId,
          channel: env.n8nChatChannel,
          source: env.n8nChatSource,
          userInfo: chatContext.userInfo,
        })
          .then((upstream) => {
            if (upstream.reply) {
              chatEventBus.publishReply(sessionId, upstream.reply);
            }
          })
          .catch((error) => {
            const fallbackMessage =
              error instanceof Error
                ? error.message
                : "Nao foi possivel concluir a resposta da Lia.";

            chatEventBus.publishError(sessionId, fallbackMessage);
          });

        return reply.code(202).send({
          accepted: true,
          sessionId,
          status: "buffering",
          bufferWindowMs: env.chatBufferWindowMs,
        });
      } catch (error) {
        return sendRouteError(reply, error);
      }
    },
  );
};
