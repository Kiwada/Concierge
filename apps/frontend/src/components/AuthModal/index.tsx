import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FiX } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./AuthModal.module.css";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "sign-in" | "sign-up";
};

type FeedbackState = {
  message: string;
  type: "error" | "success";
};

const initialForm = {
  fullName: "",
  email: "",
  password: "",
};

const AuthModal = ({ isOpen, onClose, initialMode = "sign-in" }: AuthModalProps) => {
  const { isConfigured, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleModeChange = useCallback((nextMode: "sign-in" | "sign-up") => {
    setMode(nextMode);
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMode("sign-in");
      setForm(initialForm);
      setFeedback(null);
      setIsSubmitting(false);
      return;
    }

    handleModeChange(initialMode);
  }, [handleModeChange, initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const title = useMemo(
    () => (mode === "sign-in" ? "Entrar na sua conta" : "Criar conta"),
    [mode],
  );

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!isConfigured) {
      setFeedback({
        message:
          "Supabase ainda não foi configurado no frontend. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "sign-in") {
        await signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        onClose();
        return;
      }

      await signUpWithPassword({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      setFeedback({
        message:
          "Conta criada. Se a confirmação por e-mail estiver habilitada no Supabase, valide seu e-mail antes de entrar.",
        type: "success",
      });
      setMode("sign-in");
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao autenticar.";
      setFeedback({ message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        aria-modal="true"
        role="dialog"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Fechar login"
        >
          <FiX />
        </button>

        <div className={styles.header}>
          <span className={styles.eyebrow}>ConciergeHub Account</span>
          <h2 id="auth-modal-title" className={styles.title}>
            {title}
          </h2>
          <p className={styles.description}>
            Entre para salvar preferências, manter contexto do atendimento e personalizar as
            recomendações turísticas.
          </p>
        </div>

        <div className={styles.modeSwitch}>
          <button
            type="button"
            onClick={() => handleModeChange("sign-in")}
            className={`${styles.modeButton} ${
              mode === "sign-in" ? styles.modeButtonActive : ""
            }`}
            aria-pressed={mode === "sign-in"}
            disabled={isSubmitting}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("sign-up")}
            className={`${styles.modeButton} ${
              mode === "sign-up" ? styles.modeButtonActive : ""
            }`}
            aria-pressed={mode === "sign-up"}
            disabled={isSubmitting}
          >
            Criar conta
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {mode === "sign-up" && (
            <label className={styles.field}>
              <span>Nome</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Seu nome"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className={styles.field}>
            <span>E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Mínimo de 6 caracteres"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {feedback && (
            <p
              className={`${styles.feedback} ${
                feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError
              }`}
              role={feedback.type === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {feedback.message}
            </p>
          )}

          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting
              ? "Processando..."
              : mode === "sign-in"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AuthModal;
