import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { motion } from "motion/react";
import { IoSend } from "react-icons/io5";
import { FiMinus } from "react-icons/fi";
import {
  enqueueMessageToAgent,
  fetchChatHistory,
  isAsyncChatTransportEnabled,
  sendMessageToAgent,
  subscribeToAgentEvents,
  type ChatHistoryMessage,
  type ChatStreamEvent,
} from "../../services/chatAgent";
import { getUserProfile, saveUserProfilePatch, type UserProfile } from "../../services/userProfile";
import { useAuth } from "../../contexts/useAuth";
import styles from "./ChatAssistant.module.css";

interface ChatMessage {
  id: string;
  author: "assistant" | "user";
  text: string;
}

type AgentStreamStatus =
  | {
      status: "buffering";
      queuedMessages: number;
      bufferWindowMs: number;
    }
  | {
      status: "processing";
    }
  | null;

type ProfilePromptStep =
  | "origin_city"
  | "companions_summary"
  | "interests"
  | "budget_profile";

const SESSION_STORAGE_KEY = "concierge_chat_session_id";
const MESSAGE_STORAGE_KEY_PREFIX = "concierge_chat_messages:";
const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}`;
};

const getMessageStorageKey = (sessionId: string) => `${MESSAGE_STORAGE_KEY_PREFIX}${sessionId}`;

const isChatMessage = (value: unknown): value is ChatMessage =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ChatMessage).id === "string" &&
  ((value as ChatMessage).author === "assistant" || (value as ChatMessage).author === "user") &&
  typeof (value as ChatMessage).text === "string";

const readCachedMessages = (sessionId: string): ChatMessage[] | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(getMessageStorageKey(sessionId));
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) return null;

    const messages = parsedValue.filter(isChatMessage);
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
};

const getPreferredDisplayName = (profile: UserProfile | null, user: { email?: string | null; user_metadata?: { full_name?: string | null } | null } | null) => {
  const candidateName =
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    null;

  if (candidateName) {
    return candidateName.split(/\s+/)[0] ?? candidateName;
  }

  const emailPrefix = user?.email?.split("@")[0]?.trim();
  return emailPrefix || null;
};

const buildInitialAssistantText = ({
  isConfigured,
  isAuthenticated,
  displayName,
}: {
  isConfigured: boolean;
  isAuthenticated: boolean;
  displayName: string | null;
}) => {
  if (isConfigured && isAuthenticated) {
    const greetingName = displayName ? `${displayName}, ` : "";

    return `${greetingName}seja muito bem-vindo. Sou Lia, sua concierge digital. Estou pronta para ajudar com hospedagem, roteiros, experiências e recomendações personalizadas no litoral do Piauí.`;
  }

  return "Olá, eu sou Lia, assistente digital. Entre na sua conta para manter o contexto do atendimento e receber respostas personalizadas.";
};

const PROFILE_STEP_PROMPTS: Record<ProfilePromptStep, string> = {
  origin_city: "Antes de eu personalizar suas recomendações, me diga sua cidade de origem.",
  companions_summary:
    "Perfeito. Você costuma viajar sozinho, em casal, com família ou com amigos?",
  interests:
    "Ótimo. O que mais combina com você no litoral: praia, gastronomia, passeio de barco, aventura ou descanso? Pode citar mais de um.",
  budget_profile:
    "Para eu filtrar melhor as sugestões, seu orçamento costuma ser econômico, médio, alto padrão ou luxo?",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const normalizeInterestList = (value: string): string[] => {
  const normalized = normalizeText(value);
  const detectedInterests = new Set<string>();

  const keywordMap: Array<[string, string[]]> = [
    ["praia", ["praia", "mar"]],
    ["gastronomia", ["gastronomia", "comida", "restaurante"]],
    ["passeio de barco", ["barco", "lancha", "delta", "passeio de barco"]],
    ["aventura", ["aventura", "trilha", "kitesurf", "esporte"]],
    ["descanso", ["descanso", "tranquilidade", "relax", "sossego"]],
    ["natureza", ["natureza", "ecoturismo"]],
    ["cultura", ["cultura", "historia", "centro historico"]],
  ];

  keywordMap.forEach(([interest, keywords]) => {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      detectedInterests.add(interest);
    }
  });

  if (detectedInterests.size > 0) {
    return Array.from(detectedInterests);
  }

  return value
    .split(/,|;|\/|\be\b/gi)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
};

const deriveTravelStyle = (value: string): string[] => {
  const normalized = normalizeText(value);
  const styles = new Set<string>();

  if (/(sozinho|solo|sozinh[ao])/.test(normalized)) styles.add("solo");
  if (/(casal|esposa|marido|namorad|companheir)/.test(normalized)) styles.add("casal");
  if (/(familia|filh|crianca|parent)/.test(normalized)) styles.add("familia");
  if (/(amigos|grupo|turma)/.test(normalized)) styles.add("amigos");

  return Array.from(styles);
};

const normalizeBudgetProfile = (value: string): string => {
  const normalized = normalizeText(value);

  if (/(economico|economica|baixo custo|barato|enxuto)/.test(normalized)) {
    return "economico";
  }

  if (/(medio|media|intermediario|moderado)/.test(normalized)) {
    return "medio";
  }

  if (/(premium|alto padrao|sofisticado)/.test(normalized)) {
    return "alto";
  }

  if (/(luxo|luxuoso|luxuosa)/.test(normalized)) {
    return "luxo";
  }

  return value.trim().toLowerCase();
};

const formatList = (items: string[]) => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
};

const formatBudgetLabel = (budgetProfile: string | null) => {
  if (!budgetProfile) return null;

  switch (budgetProfile) {
    case "economico":
      return "orçamento econômico";
    case "medio":
      return "orçamento médio";
    case "alto":
      return "orçamento de alto padrão";
    case "luxo":
      return "orçamento de luxo";
    case "premium":
      return "orçamento premium";
    default:
      return `orçamento ${budgetProfile}`;
  }
};

const buildProfileSummary = (profile: UserProfile) => {
  const summaryParts: string[] = [];

  if (profile.origin_city?.trim()) {
    summaryParts.push(`vem de ${profile.origin_city.trim()}`);
  }

  if (profile.companions_summary?.trim()) {
    summaryParts.push(`costuma viajar ${profile.companions_summary.trim()}`);
  } else if (Array.isArray(profile.travel_style) && profile.travel_style.length > 0) {
    summaryParts.push(`tem perfil de viagem ${formatList(profile.travel_style)}`);
  }

  if (Array.isArray(profile.interests) && profile.interests.length > 0) {
    summaryParts.push(`busca ${formatList(profile.interests)}`);
  }

  const budgetLabel = formatBudgetLabel(profile.budget_profile);
  if (budgetLabel) {
    summaryParts.push(`prefere ${budgetLabel}`);
  }

  if (summaryParts.length === 0) {
    return "Resumo do seu perfil: já tenho o contexto básico para personalizar melhor suas recomendações.";
  }

  return `Resumo do seu perfil: você ${summaryParts.join(", ")}.`;
};

const getNextMissingProfileStep = (profile: UserProfile | null): ProfilePromptStep | null => {
  if (!profile?.origin_city?.trim()) return "origin_city";
  if (!profile?.companions_summary?.trim()) return "companions_summary";
  if (!Array.isArray(profile?.interests) || profile.interests.length === 0) return "interests";
  if (!profile?.budget_profile?.trim()) return "budget_profile";
  return null;
};

const buildProfilePatch = (step: ProfilePromptStep, value: string) => {
  switch (step) {
    case "origin_city":
      return { origin_city: value.trim() };
    case "companions_summary":
      return {
        companions_summary: value.trim(),
        travel_style: deriveTravelStyle(value),
      };
    case "interests":
      return {
        interests: normalizeInterestList(value),
      };
    case "budget_profile":
      return {
        budget_profile: normalizeBudgetProfile(value),
      };
  }
};

const buildProfileAcknowledgement = (step: ProfilePromptStep, value: string) => {
  switch (step) {
    case "origin_city":
      return `Perfeito, vou considerar ${value.trim()} como sua cidade de origem.`;
    case "companions_summary":
      return "Entendi com quem você costuma viajar. Isso já melhora bastante minhas sugestões.";
    case "interests":
      return "Ótimo, já entendi melhor o tipo de experiência que combina com você.";
    case "budget_profile":
      return "Perfeito. Agora já tenho o contexto básico para personalizar melhor suas recomendações.";
  }
};

const mapHistoryMessagesToChatMessages = (historyMessages: ChatHistoryMessage[]): ChatMessage[] =>
  historyMessages.map((message) => ({
    id: message.id,
    author: message.role === "assistant" ? "assistant" : "user",
    text: message.content,
  }));

const ChatAssistant = () => {
  const { accessToken, isAuthenticated, isConfigured, isLoading, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [agentStreamStatus, setAgentStreamStatus] = useState<AgentStreamStatus>(null);
  const [profilePromptStep, setProfilePromptStep] = useState<ProfilePromptStep | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") return createSessionId();
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  });
  const [messages, setMessages] = useState<ChatMessage[]>(
    () =>
      readCachedMessages(sessionId) ?? [
        {
          id: "a-1",
          author: "assistant",
          text: buildInitialAssistantText({
            isConfigured: false,
            isAuthenticated: false,
            displayName: null,
          }),
        },
      ],
  );
  const endRef = useRef<HTMLDivElement | null>(null);
  const isOpenRef = useRef(isOpen);
  const promptedProfileStepRef = useRef<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamedSessionIdRef = useRef<string | null>(null);
  const loadedHistoryKeyRef = useRef<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0, [input]);
  const displayName = useMemo(
    () => getPreferredDisplayName(profile, user),
    [profile, user],
  );
  const initialAssistantText = useMemo(
    () =>
      buildInitialAssistantText({
        isConfigured,
        isAuthenticated,
        displayName,
      }),
    [displayName, isAuthenticated, isConfigured],
  );
  const statusText = useMemo(() => {
    if (!agentStreamStatus) return null;

    if (agentStreamStatus.status === "buffering") {
      return agentStreamStatus.queuedMessages > 1
        ? "Lia está organizando suas mensagens..."
        : "Lia está organizando sua mensagem...";
    }

    return "Lia está preparando sua resposta...";
  }, [agentStreamStatus]);
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
    if (typeof window === "undefined") return;

    window.localStorage.setItem(getMessageStorageKey(sessionId), JSON.stringify(messages));
  }, [messages, sessionId]);

  useEffect(() => {
    setMessages((currentMessages) => {
      if (
        currentMessages.length !== 1 ||
        currentMessages[0]?.id !== "a-1" ||
        currentMessages[0]?.author !== "assistant" ||
        currentMessages[0]?.text === initialAssistantText
      ) {
        return currentMessages;
      }

      return [{ id: "a-1", author: "assistant", text: initialAssistantText }];
    });
  }, [initialAssistantText]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, statusText, isOpen]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenChat = () => {
      if (isAuthModalOpen) return;
      setIsOpen(true);
      setUnreadCount(0);
    };

    window.addEventListener("concierge:open-chat", handleOpenChat);

    return () => {
      window.removeEventListener("concierge:open-chat", handleOpenChat);
    };
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAuthModalState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      const nextOpen = Boolean(customEvent.detail?.open);
      setIsAuthModalOpen(nextOpen);

      if (nextOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("concierge:auth-modal-state", handleAuthModalState as EventListener);

    return () => {
      window.removeEventListener(
        "concierge:auth-modal-state",
        handleAuthModalState as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("concierge:chat-state", {
        detail: { open: isOpen },
      }),
    );
  }, [isOpen]);

  useEffect(() => {
    if (!isConfigured || !isAuthenticated || !user?.id) {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      streamedSessionIdRef.current = null;
      loadedHistoryKeyRef.current = null;
      setAgentStreamStatus(null);
      setProfile(null);
      setProfilePromptStep(null);
      promptedProfileStepRef.current = null;
      return;
    }

    if (!isOpen) return;

    let isCancelled = false;

    const loadProfile = async () => {
      try {
        const currentProfile = await getUserProfile(user.id);
        if (isCancelled) return;

        setProfile(currentProfile);

        const nextStep = getNextMissingProfileStep(currentProfile);
        if (!nextStep) {
          promptedProfileStepRef.current = null;
          return;
        }

        const promptKey = `${user.id}:${nextStep}`;
        if (promptedProfileStepRef.current === promptKey && profilePromptStep === nextStep) {
          return;
        }

        promptedProfileStepRef.current = promptKey;
        setProfilePromptStep(nextStep);
        appendAssistantMessage(
          "Antes de eu montar recomendações realmente úteis, quero entender seu perfil com 4 perguntas rápidas.",
        );
        appendAssistantMessage(PROFILE_STEP_PROMPTS[nextStep]);
      } catch (error) {
        console.error("user-profile-load-error", error);
      }
    };

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isConfigured, isOpen, profilePromptStep, user?.id]);

  useEffect(() => {
    const cachedMessages = readCachedMessages(sessionId);
    if (!cachedMessages) {
      setMessages([{ id: "a-1", author: "assistant", text: initialAssistantText }]);
      return;
    }

    setMessages(cachedMessages);
  }, [sessionId]);

  useEffect(() => {
    if (!isAsyncChatTransportEnabled) return;
    if (!isConfigured || !isAuthenticated || !accessToken || !user?.id) return;
    if (!isOpen) return;

    const historyKey = `${user.id}:${sessionId}`;
    if (loadedHistoryKeyRef.current === historyKey) return;

    let isCancelled = false;

    const loadChatHistory = async () => {
      try {
        const historyMessages = await fetchChatHistory(sessionId);
        if (isCancelled) return;

        loadedHistoryKeyRef.current = historyKey;

        if (historyMessages.length === 0) {
          return;
        }

        setMessages(mapHistoryMessagesToChatMessages(historyMessages));
      } catch (error) {
        if (isCancelled) return;

        console.error("chat-history-load-error", error);
      }
    };

    void loadChatHistory();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, isAuthenticated, isConfigured, isOpen, sessionId, user?.id]);

  const handleProfilePromptAnswer = async (text: string) => {
    if (!profilePromptStep || !user?.id) {
      return false;
    }

    const updatedProfile = await saveUserProfilePatch(user.id, buildProfilePatch(profilePromptStep, text));
    setProfile(updatedProfile);

    appendAssistantMessage(buildProfileAcknowledgement(profilePromptStep, text));

    const nextStep = getNextMissingProfileStep(updatedProfile);
    if (nextStep) {
      promptedProfileStepRef.current = `${user.id}:${nextStep}`;
      setProfilePromptStep(nextStep);
      appendAssistantMessage(PROFILE_STEP_PROMPTS[nextStep]);
      return true;
    }

    promptedProfileStepRef.current = null;
    setProfilePromptStep(null);
    appendAssistantMessage(buildProfileSummary(updatedProfile));
    appendAssistantMessage(
      "Pronto. Agora me diga o que você quer organizar e eu sigo com recomendações personalizadas.",
    );

    return true;
  };

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

  const handleAgentStreamEvent = useCallback((event: ChatStreamEvent) => {
    switch (event.type) {
      case "connected":
      case "ping":
        return;
      case "buffering":
        setAgentStreamStatus({
          status: "buffering",
          queuedMessages: event.payload.queuedMessages,
          bufferWindowMs: event.payload.bufferWindowMs,
        });
        return;
      case "processing":
        setAgentStreamStatus({
          status: "processing",
        });
        return;
      case "reply":
        setAgentStreamStatus(null);
        appendAssistantMessage(event.payload.reply);
        return;
      case "error":
        setAgentStreamStatus(null);
        appendAssistantMessage(event.payload.message);
        return;
    }
  }, []);

  const ensureAgentStream = useCallback(
    (targetSessionId: string) => {
      if (!isAsyncChatTransportEnabled) return;
      if (!isAuthenticated || !accessToken) return;
      if (streamedSessionIdRef.current === targetSessionId && streamAbortRef.current) return;

      streamAbortRef.current?.abort();

      const nextAbortController = new AbortController();
      streamAbortRef.current = nextAbortController;
      streamedSessionIdRef.current = targetSessionId;

      void subscribeToAgentEvents({
        sessionId: targetSessionId,
        signal: nextAbortController.signal,
        onEvent: handleAgentStreamEvent,
      }).catch((error) => {
        if (nextAbortController.signal.aborted) return;

        setAgentStreamStatus(null);
        appendAssistantMessage(
          error instanceof Error
            ? error.message
            : "Nao consegui acompanhar o status do atendimento agora.",
        );
        console.error("chat-agent-events-error", error);
      });
    },
    [accessToken, handleAgentStreamEvent, isAuthenticated],
  );

  const toggleOpen = () => {
    if (isAuthModalOpen) return;

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
    setIsSending(true);

    try {
      if (profilePromptStep) {
        await handleProfilePromptAnswer(text);
        return;
      }

      if (isAsyncChatTransportEnabled) {
        const accepted = await enqueueMessageToAgent({
          message: text,
          sessionId,
        });

        if (accepted.sessionId !== sessionId) {
          setSessionId(accepted.sessionId);
        }

        setAgentStreamStatus({
          status: "buffering",
          queuedMessages: 1,
          bufferWindowMs: accepted.bufferWindowMs,
        });
        ensureAgentStream(accepted.sessionId);
        return;
      }

      const response = await sendMessageToAgent({
        message: text,
        sessionId,
      });

      if (response.sessionId !== sessionId) {
        setSessionId(response.sessionId);
      }

      appendAssistantMessage(response.reply);
    } catch (error) {
      setAgentStreamStatus(null);
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
    <div
      className={`${styles.chatRoot} ${isAuthModalOpen ? styles.chatRootLocked : ""}`}
      aria-hidden={isAuthModalOpen && !isOpen}
    >
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
              <DotLottieReact
                className={styles.avatarPlayer}
                src="/lottie/assistant-concierge.lottie"
                loop
                autoplay
              />
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
                <p className={styles.messageText}>{message.text}</p>
              </article>
            ))}
            {statusText && (
              <article className={`${styles.message} ${styles.assistant} ${styles.typing}`}>
                <p className={styles.messageText}>{statusText}</p>
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
                    ? "Escreva sua mensagem para a Lia"
                    : "Entre para conversar com contexto"
              }
              className={styles.input}
              disabled={isSending && Boolean(profilePromptStep)}
              aria-label="Digite sua mensagem"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              className={styles.sendButton}
              disabled={!canSend || (isSending && Boolean(profilePromptStep))}
              aria-label="Enviar mensagem"
            >
              <IoSend />
            </button>
          </footer>
        </section>
      )}

      {!isOpen && (
        <motion.button
          type="button"
          className={styles.floatingButton}
          onClick={toggleOpen}
          aria-label="Abrir assistente"
          initial={false}
          animate={{ scale: [1, 1.024, 1] }}
          transition={{
            duration: 5.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          whileHover={{ scale: 1.045 }}
          whileTap={{ scale: 0.96 }}
        >
          <motion.span
            className={styles.launcherCore}
            aria-hidden="true"
            animate={{
              scale: [1, 1.012, 1],
            }}
            transition={{
              duration: 5.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <DotLottieReact
              className={styles.launcherPlayer}
              src="/lottie/assistant-concierge.lottie"
              loop
              autoplay
            />
          </motion.span>
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </motion.button>
      )}
    </div>
  );
};

export default ChatAssistant;
