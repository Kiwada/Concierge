import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sendRouteError } from "../lib/reply.js";
import { RouteError } from "../lib/route-error.js";
import {
  getAuthenticatedChatContext,
  requireAccessToken,
} from "../services/chat-auth.js";
import { callChatWebhook } from "../services/chat-upstream.js";

type ChatRequestBody = {
  message?: string;
  sessionId?: string;
};

export const registerChatRoute = (app: FastifyInstance) => {
  app.post<{ Body: ChatRequestBody }>("/api/chat", async (request, reply) => {
    try {
      const accessToken = requireAccessToken(request.headers.authorization);
      const message = request.body.message?.trim();
      const sessionId = request.body.sessionId?.trim() || crypto.randomUUID();

      if (!message) {
        throw new RouteError(400, "message is required.");
      }

      const chatContext = await getAuthenticatedChatContext(accessToken);
      const upstream = await callChatWebhook({
        message,
        sessionId,
        channel: env.n8nChatChannel,
        source: env.n8nChatSource,
        user: {
          id: chatContext.userId,
          email: chatContext.email,
          fullName: chatContext.fullName,
        },
        profile: {
          exists: chatContext.profileExists,
          preferredLanguage: chatContext.userInfo.preferredLanguage,
          originCity: chatContext.userInfo.originCity,
          interests: chatContext.userInfo.interests,
          travelStyle: chatContext.userInfo.travelStyle,
          budgetProfile: chatContext.userInfo.budgetProfile,
          companionsSummary: chatContext.userInfo.companionsSummary,
          notes: chatContext.userInfo.notes,
          updatedAt: chatContext.userInfo.updatedAt,
        },
      });

      return reply.code(200).send({
        reply:
          upstream.reply ||
          "Recebi sua mensagem, mas o backend nao recebeu um texto reconhecivel do n8n.",
        sessionId: upstream.sessionId,
      });
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });
};
