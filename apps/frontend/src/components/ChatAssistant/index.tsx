import { useMemo, useState } from "react";
import { IoSend } from "react-icons/io5";
import { FiMinus } from "react-icons/fi";
import styles from "./ChatAssistant.module.css";

interface ChatMessage {
  id: string;
  author: "assistant" | "user";
  text: string;
}

const initialAssistantText =
  "Ola, eu sou Lia, assistente digital. Posso ajudar com reservas, eventos, informacoes do hotel, localizacao e pre-checkin.";

const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "a-1", author: "assistant", text: initialAssistantText },
  ]);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      author: "user",
      text,
    };

    const assistantReply: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      author: "assistant",
      text: "Recebi sua mensagem. Em breve vou integrar com o agente de IA via webhook/websocket.",
    };

    setMessages((prev) => [...prev, userMessage, assistantReply]);
    setInput("");
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
              <img src="/Logo.png" alt="Assistente Lia" className={styles.avatar} />
              <span className={styles.onlineDot} />
            </div>
            <strong className={styles.title}>Lia Concierge</strong>
            <span className={styles.subtitle}>online</span>
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
              disabled={!canSend}
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
          <img src="/Logo.png" alt="Abrir chat da Lia" className={styles.floatingAvatar} />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </button>
      )}
    </div>
  );
};

export default ChatAssistant;
