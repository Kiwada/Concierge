import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sendRouteError } from "../lib/reply.js";
import { RouteError } from "../lib/route-error.js";
import {
  getAuthenticatedChatContext,
  requireAccessToken,
} from "../services/chat-auth.js";
import {
  chatEventBus,
  type ChatConnectedEvent,
  type ChatPingEvent,
  type ChatStreamEvent,
} from "../services/chat-events.js";

type ChatEventsParams = {
  sessionId: string;
};

const formatSseEvent = (
  event: ChatConnectedEvent | ChatPingEvent | ChatStreamEvent,
) => `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;

export const registerChatEventsRoute = (app: FastifyInstance) => {
  app.get<{ Params: ChatEventsParams }>(
    "/api/chat/events/:sessionId",
    async (request, reply) => {
      try {
        const accessToken = requireAccessToken(request.headers.authorization);
        const chatContext = await getAuthenticatedChatContext(accessToken);
        const sessionId = request.params.sessionId?.trim();

        if (!sessionId) {
          throw new RouteError(400, "sessionId is required.");
        }

        const snapshot = chatEventBus.getSnapshot(sessionId, chatContext.userId);

        if (!snapshot) {
          throw new RouteError(404, "Chat session not found.");
        }

        reply.hijack();
        request.raw.socket?.setKeepAlive(true, 15_000);
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": env.allowedOrigin,
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        });

        reply.raw.write(
          formatSseEvent({
            type: "connected",
            payload: {
              sessionId,
            },
          }),
        );

        if (snapshot.lastEvent) {
          reply.raw.write(formatSseEvent(snapshot.lastEvent));
        }

        const unsubscribe = chatEventBus.subscribe(
          sessionId,
          chatContext.userId,
          (event) => {
            reply.raw.write(formatSseEvent(event));
          },
        );

        if (!unsubscribe) {
          reply.raw.end();
          return;
        }

        const pingInterval = setInterval(() => {
          reply.raw.write(
            formatSseEvent({
              type: "ping",
              payload: {
                ts: new Date().toISOString(),
              },
            }),
          );
        }, 15_000);

        const cleanup = () => {
          clearInterval(pingInterval);
          unsubscribe();
        };

        request.raw.on("close", cleanup);
        request.raw.on("error", cleanup);
      } catch (error) {
        if (!reply.sent) {
          return sendRouteError(reply, error);
        }
      }
    },
  );
};
