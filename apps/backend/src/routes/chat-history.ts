import type { FastifyInstance } from "fastify";
import { sendRouteError } from "../lib/reply.js";
import { RouteError } from "../lib/route-error.js";
import {
  getAuthenticatedChatContext,
  requireAccessToken,
} from "../services/chat-auth.js";
import { isChatHistoryEnabled, listChatMessages } from "../services/chat-history.js";

type ChatHistoryParams = {
  sessionId: string;
};

export const registerChatHistoryRoute = (app: FastifyInstance) => {
  app.get<{ Params: ChatHistoryParams }>(
    "/api/chat/history/:sessionId",
    async (request, reply) => {
      try {
        if (!isChatHistoryEnabled()) {
          throw new RouteError(
            503,
            "Chat history persistence is not configured. Configure SUPABASE_SERVICE_ROLE_KEY.",
          );
        }

        const accessToken = requireAccessToken(request.headers.authorization);
        const chatContext = await getAuthenticatedChatContext(accessToken);
        const sessionId = request.params.sessionId?.trim();

        if (!sessionId) {
          throw new RouteError(400, "sessionId is required.");
        }

        const messages = await listChatMessages(sessionId, chatContext.userId);

        return reply.code(200).send({
          sessionId,
          messages,
        });
      } catch (error) {
        return sendRouteError(reply, error);
      }
    },
  );
};
