import { useEffect, useMemo, useRef, useState } from "react";
import { IoSend } from "react-icons/io5";
import { FiMinus } from "react-icons/fi";
import { sendMessageToAgent } from "../../services/chatAgent";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./ChatAssistant.module.css";

interface ChatMessage {
  id: string;
  author: "assistant" | "user";
  text: string;
}

const initialAssistantText =
  "Olá, eu sou Lia, assistente digital. Entre na sua conta para manter o contexto do atendimento e receber respostas personalizadas.";

const SESSION_STORAGE_KEY = "concierge_chat_session_id";
const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}`;
};

const ChatAssistant = () => {
  const { accessToken, isAuthenticated, isConfigured, isLoading } = useAuth();
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
  const isOpenRef = useRef(isOpen);

  const canSend = useMemo(() => input.trim().length > 0, [input]);
  const connectionLabel = useMemo(() => {
    if (!isConfigured) return "autenticação indisponível";
    if (isLoading) return "verificando conexão";
    if (!isAuthenticated || !accessToken) return "login necessário";
    return "autenticado";
  }, [accessToken, isAuthenticated, isConfigured, isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenChat = () => {
      setIsOpen(true);
      setUnreadCount(0);
    };

    window.addEventListener("concierge:open-chat", handleOpenChat);

    return () => {
      window.removeEventListener("concierge:open-chat", handleOpenChat);
    };
  }, []);

  const appendAssistantMessage = (text: string) => {
    const assistantReply: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      author: "assistant",
      text,
    };

    setMessages((prev) => [...prev, assistantReply]);

    if (!isOpenRef.current) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    if (!isConfigured) {
      appendAssistantMessage(
        "O login ainda não foi configurado neste ambiente. Defina as variáveis do Supabase para usar o atendimento autenticado.",
      );
      return;
    }

    if (!isAuthenticated || !accessToken) {
      appendAssistantMessage(
        "Entre na sua conta para conversar com a Lia e manter o contexto do atendimento.",
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      author: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await sendMessageToAgent({
        message: text,
        sessionId,
      });

      if (response.sessionId !== sessionId) {
        setSessionId(response.sessionId);
      }

      appendAssistantMessage(response.reply);
    } catch (error) {
      appendAssistantMessage(
        error instanceof Error
          ? error.message
          : "Não consegui falar com o agente agora. Tente novamente em instantes.",
      );
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

          <div className={styles.messages} role="log" aria-live="polite" aria-busy={isSending}>
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
                Lia está digitando...
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
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={
                !isConfigured
                  ? "Configure o login para usar o atendimento"
                  : isAuthenticated
                    ? "Digite sua mensagem"
                    : "Entre para conversar com contexto"
              }
              className={styles.input}
              disabled={isSending}
              aria-label="Digite sua mensagem"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
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
