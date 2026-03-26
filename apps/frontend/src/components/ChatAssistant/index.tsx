import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { IoSend } from "react-icons/io5";
import { FiMinus } from "react-icons/fi";
import { sendMessageToAgent } from "../../services/chatAgent";
import { getUserProfile, saveUserProfilePatch, type UserProfile } from "../../services/userProfile";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./ChatAssistant.module.css";

interface ChatMessage {
  id: string;
  author: "assistant" | "user";
  text: string;
}

type ProfilePromptStep =
  | "origin_city"
  | "companions_summary"
  | "interests"
  | "budget_profile";

const initialAssistantText =
  "Olá, eu sou Lia, assistente digital. Entre na sua conta para manter o contexto do atendimento e receber respostas personalizadas.";

const SESSION_STORAGE_KEY = "concierge_chat_session_id";
const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}`;
};

const PROFILE_STEP_PROMPTS: Record<ProfilePromptStep, string> = {
  origin_city: "Antes de eu personalizar suas recomendações, me diga sua cidade de origem.",
  companions_summary:
    "Perfeito. Você costuma viajar sozinho, em casal, com família ou com amigos?",
  interests:
    "Ótimo. O que mais combina com você no litoral: praia, gastronomia, passeio de barco, aventura ou descanso? Pode citar mais de um.",
  budget_profile:
    "Para eu filtrar melhor as sugestões, seu orçamento costuma ser econômico, médio ou premium?",
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

  if (/(premium|alto padrao|luxo|sofisticado)/.test(normalized)) {
    return "premium";
  }

  return value.trim().toLowerCase();
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

const ChatAssistant = () => {
  const { accessToken, isAuthenticated, isConfigured, isLoading, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [profilePromptStep, setProfilePromptStep] = useState<ProfilePromptStep | null>(null);
  const [, setProfile] = useState<UserProfile | null>(null);
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
  const promptedProfileUserIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!isConfigured || !isAuthenticated || !user?.id) {
      setProfile(null);
      setProfilePromptStep(null);
      promptedProfileUserIdRef.current = null;
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
        if (!nextStep || promptedProfileUserIdRef.current === user.id) {
          return;
        }

        promptedProfileUserIdRef.current = user.id;
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
  }, [isAuthenticated, isConfigured, isOpen, user?.id]);

  const handleProfilePromptAnswer = async (text: string) => {
    if (!profilePromptStep || !user?.id) {
      return false;
    }

    const updatedProfile = await saveUserProfilePatch(user.id, buildProfilePatch(profilePromptStep, text));
    setProfile(updatedProfile);

    appendAssistantMessage(buildProfileAcknowledgement(profilePromptStep, text));

    const nextStep = getNextMissingProfileStep(updatedProfile);
    if (nextStep) {
      setProfilePromptStep(nextStep);
      appendAssistantMessage(PROFILE_STEP_PROMPTS[nextStep]);
      return true;
    }

    setProfilePromptStep(null);
    appendAssistantMessage(
      "Pronto. Já tenho o básico do seu perfil e minhas próximas recomendações serão mais contextualizadas.",
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
      if (profilePromptStep) {
        await handleProfilePromptAnswer(text);
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
            <span className={styles.launcherInnerGlow} aria-hidden="true" />
            <motion.svg
              className={styles.launcherSvg}
              viewBox="0 0 120 120"
              aria-hidden="true"
              animate={{ rotate: [0, 8, 0, -8, 0] }}
              transition={{
                duration: 7.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <defs>
                <filter id="lia-orb-blur" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="7.5" />
                </filter>
                <filter id="lia-orb-soft" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="5.5" />
                </filter>
                <radialGradient id="lia-orb-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="26%" stopColor="rgba(255, 236, 242, 0.94)" />
                  <stop offset="56%" stopColor="rgba(255, 142, 168, 0.58)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>

              <motion.g
                filter="url(#lia-orb-blur)"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "center" }}
              >
                <ellipse cx="60" cy="38" rx="18" ry="31" fill="rgba(255, 142, 168, 0.56)" transform="rotate(10 60 38)" />
                <ellipse cx="41" cy="61" rx="17" ry="31" fill="rgba(255, 79, 121, 0.42)" transform="rotate(-50 41 61)" />
                <ellipse cx="80" cy="61" rx="17" ry="31" fill="rgba(255, 162, 188, 0.34)" transform="rotate(52 80 61)" />
                <ellipse cx="60" cy="82" rx="16" ry="29" fill="rgba(239, 27, 79, 0.28)" transform="rotate(176 60 82)" />
              </motion.g>

              <motion.g
                filter="url(#lia-orb-soft)"
                animate={{ rotate: -360 }}
                transition={{ duration: 10.5, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "center" }}
              >
                <ellipse cx="58" cy="52" rx="22" ry="12" fill="rgba(255,255,255,0.24)" transform="rotate(22 58 52)" />
                <ellipse cx="66" cy="66" rx="20" ry="10" fill="rgba(255, 142, 168, 0.2)" transform="rotate(-38 66 66)" />
                <ellipse cx="52" cy="66" rx="18" ry="10" fill="rgba(255, 79, 121, 0.18)" transform="rotate(70 52 66)" />
              </motion.g>

              <motion.circle
                cx="60"
                cy="60"
                r="20"
                fill="url(#lia-orb-core)"
                animate={{
                  r: [19, 22, 19],
                  opacity: [0.9, 1, 0.9],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.svg>
          </motion.span>
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </motion.button>
      )}
    </div>
  );
};

export default ChatAssistant;
