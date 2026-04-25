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
import { AppState, AppStateStatus, Platform } from "react-native";
import { router } from "expo-router";
import {
  User,
  AuthChangeEvent,
  Session,
  Provider,
} from "@supabase/supabase-js";
import type { LearningProfile } from "@inputenglish/shared";
import { supabase } from "@/lib/supabase";
import { appStore } from "@/lib/stores";
import { clearDailyInputQueueCache } from "@/lib/daily-input";
import {
  clearCachedLearningProfile,
  fetchLearningProfile,
  readCachedLearningProfile,
  updateLearningProfile as persistLearningProfile,
} from "@/lib/learning-profile";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  learningProfile: LearningProfile | null;
  isProfileLoading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  signInWithOAuth: (
    provider: "google" | "github" | "kakao" | "azure",
  ) => Promise<void>;
  signInWithApple: () => Promise<void>;
  completeOAuthCodeExchange: (code: string) => Promise<Session | null>;
  refreshUser: () => Promise<void>;
  refreshLearningProfile: () => Promise<void>;
  updateLearningProfile: (
    patch: Partial<Omit<LearningProfile, "user_id">>,
  ) => Promise<LearningProfile>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [learningProfile, setLearningProfile] =
    useState<LearningProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
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

  const loadLearningProfile = useCallback(
    async (authUser: User): Promise<void> => {
      const cachedProfile = readCachedLearningProfile(authUser.id);
      if (cachedProfile) {
        setLearningProfile(cachedProfile);
      }

      setIsProfileLoading(true);
      try {
        const profile = await fetchLearningProfile(authUser.id);
        setLearningProfile(profile);
      } catch (err) {
        console.error("[AuthContext] Failed to load learning profile:", err);
        if (!cachedProfile) {
          setLearningProfile({
            user_id: authUser.id,
            level_band: null,
            goal_mode: null,
            focus_tags: [],
            preferred_speakers: [],
            preferred_situations: [],
            preferred_source_types: [],
            preferred_genres: [],
            onboarding_completed_at: null,
            updated_at: null,
          });
        }
      } finally {
        setIsProfileLoading(false);
      }
    },
    [],
  );

  const applyAuthenticatedSession = useCallback(
    async (nextSession: Session): Promise<void> => {
      setIsProfileLoading(true);
      setSession(nextSession);
      setUser(nextSession.user);
      await loadLearningProfile(nextSession.user);
      appStore.getState().loadUserData().catch(console.error);
    },
    [loadLearningProfile],
  );

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
          await loadLearningProfile(initialSession.user);
          appStore.getState().loadUserData().catch(console.error);
        } else {
          // No session - guest user; skip getUser to avoid AuthSessionMissingError
          setUser(null);
          setSession(null);
          setLearningProfile(null);
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
          setIsProfileLoading(true);
          void loadLearningProfile(newSession.user);
          appStore.getState().loadUserData().catch(console.error);
          // Navigation handled declaratively in _layout.tsx via useEffect
          // to avoid race condition where router.replace fires before React
          // commits the setUser state update, causing TabLayout to see
          // isAuthenticated=false and redirect back to login.
        } else if (event === "SIGNED_OUT") {
          if (user?.id) clearCachedLearningProfile(user.id);
          setUser(null);
          setSession(null);
          setLearningProfile(null);
          router.replace("/intro?scene=9" as never);
        } else if (event === "TOKEN_REFRESHED" && newSession) {
          setUser(newSession.user);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadLearningProfile, user?.id]);

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

        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) {
          throw signInError;
        }

        // Explicitly update auth state so the navigation useEffect triggers
        // immediately, without waiting for the async onAuthStateChange.
        if (data.session) {
          await applyAuthenticatedSession(data.session);
        }
      } catch (err) {
        console.error("[AuthContext] Sign in error:", err);
        setError(err instanceof Error ? err : new Error("Failed to sign in"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuthenticatedSession],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
    ): Promise<{ needsEmailConfirmation: boolean }> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: signUpError } = await supabase.auth.signUp({
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

        // Session present = signed in immediately (email confirmation disabled)
        if (data.session) {
          await applyAuthenticatedSession(data.session);
          return { needsEmailConfirmation: false };
        }

        // User created but no session = email confirmation required
        return { needsEmailConfirmation: true };
      } catch (err) {
        console.error("[AuthContext] Sign up error:", err);
        setError(err instanceof Error ? err : new Error("Failed to sign up"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuthenticatedSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      if (user?.id) clearCachedLearningProfile(user.id);
      setUser(null);
      setSession(null);
      setLearningProfile(null);
      router.replace("/intro?scene=9" as never);
    } catch (err) {
      console.error("[AuthContext] Sign out error:", err);
      setError(err instanceof Error ? err : new Error("Failed to sign out"));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // @MX:NOTE: [AUTO] signInWithOAuth initiates OAuth flow via Supabase.
  // Actual token exchange from deep link happens in the root _layout.tsx.
  const signInWithOAuth = useCallback(
    async (
      provider: "google" | "github" | "kakao" | "azure",
    ): Promise<void> => {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: "inputenglish://auth/callback",
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    },
    [],
  );

  const signInWithApple = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const AppleAuth = require("expo-apple-authentication");
      const ExpoCrypto = require("expo-crypto");

      // Generate nonce: Apple embeds the hash in the identity token,
      // Supabase verifies the raw nonce against it.
      const rawNonce = Array.from(
        ExpoCrypto.getRandomBytes(32) as Uint8Array,
        (byte: number) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const hashedNonce = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error("No identity token returned from Apple");
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
          nonce: rawNonce,
        });

      if (signInError) throw signInError;

      // Explicitly update auth state from the response so the navigation
      // useEffect in _layout.tsx fires immediately, without waiting for
      // onAuthStateChange (which depends on async SecureStore persistence).
      if (data.session) {
        await applyAuthenticatedSession(data.session);
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      console.error("[AuthContext] Apple sign in error:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to sign in with Apple"),
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthenticatedSession]);

  const completeOAuthCodeExchange = useCallback(
    async (code: string): Promise<Session | null> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          throw exchangeError;
        }

        if (data.session) {
          await applyAuthenticatedSession(data.session);
          return data.session;
        }

        return null;
      } catch (err) {
        console.error("[AuthContext] OAuth code exchange error:", err);
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to complete OAuth sign in"),
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuthenticatedSession],
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await fetchUser();
    setIsLoading(false);
  }, [fetchUser]);

  const refreshLearningProfile = useCallback(async (): Promise<void> => {
    if (!user) return;
    await loadLearningProfile(user);
  }, [loadLearningProfile, user]);

  const updateLearningProfile = useCallback(
    async (
      patch: Partial<Omit<LearningProfile, "user_id">>,
    ): Promise<LearningProfile> => {
      if (!user) {
        throw new Error("Cannot update learning profile without a user");
      }

      setIsProfileLoading(true);
      try {
        const nextProfile = await persistLearningProfile(user.id, patch);
        clearDailyInputQueueCache(user.id);
        setLearningProfile(nextProfile);
        return nextProfile;
      } finally {
        setIsProfileLoading(false);
      }
    },
    [user],
  );

  const deleteAccount = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { error: deleteError } = await supabase.rpc("delete_user");
      if (deleteError) throw deleteError;
      await supabase.auth.signOut();
      if (user?.id) clearCachedLearningProfile(user.id);
      setUser(null);
      setSession(null);
      setLearningProfile(null);
      router.replace("/intro?scene=9" as never);
    } catch (err) {
      console.error("[AuthContext] Delete account error:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to delete account"),
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      session,
      learningProfile,
      isProfileLoading,
      isLoading,
      isAuthenticated: !!user,
      isInitialized,
      error,
      signIn,
      signUp,
      signOut,
      signInWithOAuth,
      signInWithApple,
      completeOAuthCodeExchange,
      refreshUser,
      refreshLearningProfile,
      updateLearningProfile,
      deleteAccount,
    }),
    [
      user,
      session,
      learningProfile,
      isProfileLoading,
      isLoading,
      isInitialized,
      error,
      signIn,
      signUp,
      signOut,
      signInWithOAuth,
      signInWithApple,
      completeOAuthCodeExchange,
      refreshUser,
      refreshLearningProfile,
      updateLearningProfile,
      deleteAccount,
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
