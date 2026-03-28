import type { FastifyReply } from "fastify";
import { isRouteError } from "./route-error.js";

export const sendRouteError = (
  reply: FastifyReply,
  error: unknown,
  fallbackMessage = "Unexpected server error.",
) => {
  if (isRouteError(error)) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  console.error("backend-route-error", error);
  return reply.code(500).send({ error: fallbackMessage });
};
