import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type AuthCredentials = {
  email: string;
  password: string;
};

type SignUpPayload = AuthCredentials & {
  fullName?: string;
};

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  signInWithPassword: (credentials: AuthCredentials) => Promise<void>;
  signUpWithPassword: (payload: SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!isMounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((error: unknown) => {
        console.error("auth-session-error", error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async ({ email, password }: AuthCredentials) => {
    if (!supabase) {
      throw new Error(
        "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async ({ email, password, fullName }: SignUpPayload) => {
    if (!supabase) {
      throw new Error(
        "Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName?.trim() || undefined,
        },
      },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      isAuthenticated: Boolean(user),
      user,
      session,
      accessToken: session?.access_token ?? null,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [isLoading, session, signInWithPassword, signOut, signUpWithPassword, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
