import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpPayload = AuthCredentials & {
  fullName?: string;
};

export type AuthContextValue = {
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

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
