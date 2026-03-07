// @MX:ANCHOR: AuthProvider / useAuth - mobile auth context wrapping Supabase session
// @MX:REASON: [AUTO] fan_in >= 3: used by root layout, tab layout guard, ProfileScreen, and auth forms
// @MX:SPEC: SPEC-MOBILE-002 - mobile AuthContext with AppState management and PKCE OAuth
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { router } from "expo-router";
import {
  User,
  AuthChangeEvent,
  Session,
  Provider,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { appStore } from "@/lib/stores";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: (
    provider: "google" | "github" | "kakao" | "azure",
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user with exponential backoff retry (ported from web AuthContext)
  const fetchUser = useCallback(async (retryCount = 0): Promise<void> => {
    const maxRetries = 3;
    const retryDelay = 1000 * Math.pow(2, retryCount);

    try {
      const {
        data: { user: fetchedUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      setUser(fetchedUser);
      setError(null);
    } catch (err) {
      console.error(
        `[AuthContext] Failed to fetch user (attempt ${retryCount + 1}):`,
        err,
      );

      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return fetchUser(retryCount + 1);
      }

      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
      setUser(null);
    }
  }, []);

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          appStore.getState().loadUserData().catch(console.error);
        } else {
          // No session - guest user; skip getUser to avoid AuthSessionMissingError
          setUser(null);
          setSession(null);
        }
      } catch (err) {
        console.error("[AuthContext] Initialization error:", err);
        if (mounted) {
          setError(
            err instanceof Error
              ? err
              : new Error("Auth initialization failed"),
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return;

        console.log("[AuthContext] Auth state changed:", event);

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);

        if (event === "SIGNED_IN" && newSession) {
          appStore.getState().loadUserData().catch(console.error);
          router.replace("/(tabs)");
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          router.replace("/(auth)/login");
        } else if (event === "TOKEN_REFRESHED" && newSession) {
          setUser(newSession.user);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // AppState listener: pause/resume token auto-refresh when app goes background/foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          supabase.auth.startAutoRefresh();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }
        // Auth state change listener handles user/session state update
      } catch (err) {
        console.error("[AuthContext] Sign in error:", err);
        setError(err instanceof Error ? err : new Error("Failed to sign in"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
    ): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }
      } catch (err) {
        console.error("[AuthContext] Sign up error:", err);
        setError(err instanceof Error ? err : new Error("Failed to sign up"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("[AuthContext] Sign out error:", err);
      setError(err instanceof Error ? err : new Error("Failed to sign out"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // @MX:NOTE: [AUTO] signInWithOAuth initiates OAuth flow via Supabase.
  // Actual token exchange from deep link happens in the root _layout.tsx.
  const signInWithOAuth = useCallback(
    async (
      provider: "google" | "github" | "kakao" | "azure",
    ): Promise<void> => {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: "shadowoo://auth/callback",
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    },
    [],
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await fetchUser();
    setIsLoading(false);
  }, [fetchUser]);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: !!user,
      isInitialized,
      error,
      signIn,
      signUp,
      signOut,
      signInWithOAuth,
      refreshUser,
    }),
    [
      user,
      session,
      isLoading,
      isInitialized,
      error,
      signIn,
      signUp,
      signOut,
      signInWithOAuth,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// Hook for protected routes - uses expo-router instead of window.location
export function useRequireAuth(redirectTo = "/(auth)/login") {
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo as Parameters<typeof router.replace>[0]);
    }
  }, [isLoading, isAuthenticated, redirectTo]);

  return { user, isLoading, isAuthenticated };
}
