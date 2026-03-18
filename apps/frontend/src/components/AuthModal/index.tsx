import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FiX } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./AuthModal.module.css";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const initialForm = {
  fullName: "",
  email: "",
  password: "",
};

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const { isConfigured, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMode("sign-in");
      setForm(initialForm);
      setFeedback(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const title = useMemo(
    () => (mode === "sign-in" ? "Entrar na sua conta" : "Criar conta"),
    [mode],
  );

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!isConfigured) {
      setFeedback(
        "Supabase ainda nao foi configurado no frontend. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
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

      setFeedback(
        "Conta criada. Se a confirmacao por e-mail estiver habilitada no Supabase, valide seu e-mail antes de entrar.",
      );
      setMode("sign-in");
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao autenticar.";
      setFeedback(message);
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
        aria-label="Autenticacao ConciergeHub"
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
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>
            Entre para salvar preferencias, manter contexto do atendimento e personalizar as
            recomendacoes turisticas.
          </p>
        </div>

        <div className={styles.modeSwitch}>
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className={`${styles.modeButton} ${mode === "sign-in" ? styles.modeButtonActive : ""
              }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className={`${styles.modeButton} ${mode === "sign-up" ? styles.modeButtonActive : ""
              }`}
          >
            Criar conta
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
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
              placeholder="Minimo de 6 caracteres"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {feedback && <p className={styles.feedback}>{feedback}</p>}

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
