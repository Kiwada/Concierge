import { useEffect, useMemo, useRef, useState } from "react";
import { IoSend } from "react-icons/io5";
import { FiMinus } from "react-icons/fi";
import { sendMessageToAgent } from "../../services/chatAgent";
import styles from "./ChatAssistant.module.css";

interface ChatMessage {
  id: string;
  author: "assistant" | "user";
  text: string;
}

const initialAssistantText =
  "Ola, eu sou Lia, assistente digital. Posso ajudar com reservas, eventos, informacoes do hotel, localizacao e pre-checkin.";

const SESSION_STORAGE_KEY = "concierge_chat_session_id";
const CHAT_WEBHOOK_URL = import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL?.trim() ?? "";
const CHAT_CHANNEL = import.meta.env.VITE_CHAT_CHANNEL?.trim() || "web";

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}`;
};

const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") return createSessionId();
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "a-1", author: "assistant", text: initialAssistantText },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0, [input]);
  const connectionLabel = CHAT_WEBHOOK_URL ? "online" : "modo demo";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending, isOpen]);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      author: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    if (!CHAT_WEBHOOK_URL) {
      const fallbackReply: ChatMessage = {
        id: `a-${Date.now() + 1}`,
        author: "assistant",
        text: "Fluxo n8n nao configurado. Defina VITE_N8N_CHAT_WEBHOOK_URL no ambiente para conectar o agente real.",
      };
      setMessages((prev) => [...prev, fallbackReply]);
      setIsSending(false);
      return;
    }

    try {
      const response = await sendMessageToAgent(CHAT_WEBHOOK_URL, {
        message: text,
        sessionId,
        channel: CHAT_CHANNEL,
        source: "concierge-web",
      });

      if (response.sessionId !== sessionId) {
        setSessionId(response.sessionId);
      }

      const assistantReply: ChatMessage = {
        id: `a-${Date.now() + 1}`,
        author: "assistant",
        text: response.reply,
      };

      setMessages((prev) => [...prev, assistantReply]);
    } catch (error) {
      const assistantReply: ChatMessage = {
        id: `a-${Date.now() + 1}`,
        author: "assistant",
        text: "Nao consegui falar com o agente agora. Tente novamente em instantes.",
      };
      setMessages((prev) => [...prev, assistantReply]);
      console.error("chat-agent-error", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.chatRoot}>
      {isOpen && (
        <section className={styles.chatPanel} aria-label="Assistente virtual Lia">
          <header className={styles.header}>
            <button
              type="button"
              className={styles.minimizeButton}
              onClick={toggleOpen}
              aria-label="Minimizar chat"
            >
              <FiMinus />
            </button>
            <div className={styles.avatarWrap}>
              <img src="/loira.png" alt="Assistente Lia" className={styles.avatar} />
              <span className={styles.onlineDot} />
            </div>
            <strong className={styles.title}>Lia Concierge</strong>
            <span className={styles.subtitle}>{connectionLabel}</span>
          </header>

          <div className={styles.messages}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`${styles.message} ${
                  message.author === "assistant" ? styles.assistant : styles.user
                }`}
              >
                {message.text}
              </article>
            ))}
            {isSending && (
              <article className={`${styles.message} ${styles.assistant} ${styles.typing}`}>
                Lia esta digitando...
              </article>
            )}
            <div ref={endRef} />
          </div>

          <footer className={styles.inputBar}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              placeholder="Digite sua mensagem"
              className={styles.input}
            />
            <button
              type="button"
              onClick={sendMessage}
              className={styles.sendButton}
              disabled={!canSend || isSending}
              aria-label="Enviar mensagem"
            >
              <IoSend />
            </button>
          </footer>
        </section>
      )}

      {!isOpen && (
        <button
          type="button"
          className={styles.floatingButton}
          onClick={toggleOpen}
          aria-label="Abrir assistente"
        >
          <img src="/loira.png" alt="Abrir chat da Lia" className={styles.floatingAvatar} />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </button>
      )}
    </div>
  );
};

export default ChatAssistant;
