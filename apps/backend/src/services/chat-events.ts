export type ChatConnectedEvent = {
  type: "connected";
  payload: {
    sessionId: string;
  };
};

export type ChatBufferingEvent = {
  type: "buffering";
  payload: {
    sessionId: string;
    status: "buffering";
    bufferWindowMs: number;
    queuedMessages: number;
  };
};

export type ChatProcessingEvent = {
  type: "processing";
  payload: {
    sessionId: string;
    status: "processing";
  };
};

export type ChatReplyEvent = {
  type: "reply";
  payload: {
    sessionId: string;
    messageId: string;
    reply: string;
    createdAt: string;
  };
};

export type ChatErrorEvent = {
  type: "error";
  payload: {
    sessionId: string;
    message: string;
  };
};

export type ChatPingEvent = {
  type: "ping";
  payload: {
    ts: string;
  };
};

export type ChatStreamEvent =
  | ChatBufferingEvent
  | ChatProcessingEvent
  | ChatReplyEvent
  | ChatErrorEvent;

type ChatEventListener = (event: ChatStreamEvent) => void;

type ChatSessionState = {
  ownerUserId: string;
  queuedMessages: number;
  lastEvent: ChatStreamEvent | null;
  listeners: Set<ChatEventListener>;
};

class ChatEventBus {
  private sessions = new Map<string, ChatSessionState>();

  private getOrCreateSession(sessionId: string, ownerUserId: string) {
    const existingSession = this.sessions.get(sessionId);

    if (existingSession) {
      if (existingSession.ownerUserId !== ownerUserId) {
        throw new Error("chat-session-owner-mismatch");
      }

      return existingSession;
    }

    const session: ChatSessionState = {
      ownerUserId,
      queuedMessages: 0,
      lastEvent: null,
      listeners: new Set(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private publish(sessionId: string, event: ChatStreamEvent) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastEvent = event;

    for (const listener of session.listeners) {
      listener(event);
    }

    return true;
  }

  registerQueuedMessage(sessionId: string, ownerUserId: string, bufferWindowMs: number) {
    const session = this.getOrCreateSession(sessionId, ownerUserId);
    session.queuedMessages += 1;

    return this.publish(sessionId, {
      type: "buffering",
      payload: {
        sessionId,
        status: "buffering",
        bufferWindowMs,
        queuedMessages: session.queuedMessages,
      },
    });
  }

  publishBuffering(sessionId: string, bufferWindowMs: number, queuedMessages = 1) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.queuedMessages = Math.max(queuedMessages, 1);

    return this.publish(sessionId, {
      type: "buffering",
      payload: {
        sessionId,
        status: "buffering",
        bufferWindowMs,
        queuedMessages: session.queuedMessages,
      },
    });
  }

  publishProcessing(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return this.publish(sessionId, {
      type: "processing",
      payload: {
        sessionId,
        status: "processing",
      },
    });
  }

  publishReply(sessionId: string, reply: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.queuedMessages = 0;

    return this.publish(sessionId, {
      type: "reply",
      payload: {
        sessionId,
        messageId: crypto.randomUUID(),
        reply,
        createdAt: new Date().toISOString(),
      },
    });
  }

  publishError(sessionId: string, message: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.queuedMessages = 0;

    return this.publish(sessionId, {
      type: "error",
      payload: {
        sessionId,
        message,
      },
    });
  }

  getSnapshot(sessionId: string, ownerUserId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.ownerUserId !== ownerUserId) {
      return null;
    }

    return {
      queuedMessages: session.queuedMessages,
      lastEvent: session.lastEvent,
    };
  }

  subscribe(sessionId: string, ownerUserId: string, listener: ChatEventListener) {
    const session = this.sessions.get(sessionId);
    if (!session || session.ownerUserId !== ownerUserId) {
      return null;
    }

    session.listeners.add(listener);

    return () => {
      session.listeners.delete(listener);
    };
  }

  hasSession(sessionId: string) {
    return this.sessions.has(sessionId);
  }
}

export const chatEventBus = new ChatEventBus();
