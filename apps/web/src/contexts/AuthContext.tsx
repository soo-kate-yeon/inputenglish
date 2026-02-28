"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
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
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Fetch user with retry logic
  const fetchUser = useCallback(
    async (retryCount = 0): Promise<void> => {
      const maxRetries = 3;
      const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        setUser(user);
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

        setError(
          err instanceof Error ? err : new Error("Failed to fetch user"),
        );
        setUser(null);
      }
    },
    [supabase],
  );

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
        } else {
          // No session — guest user, skip getUser (would throw AuthSessionMissingError)
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

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return;

        console.log("[AuthContext] Auth state changed:", event);

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);

        // Handle specific events
        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
        } else if (event === "TOKEN_REFRESHED" && newSession) {
          // Token was refreshed, update user
          setUser(newSession.user);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchUser]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error("[AuthContext] Sign out error:", err);
      setError(err instanceof Error ? err : new Error("Failed to sign out"));
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Manual refresh function
  const refreshUser = useCallback(async () => {
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
      error,
      signOut,
      refreshUser,
    }),
    [user, session, isLoading, error, signOut, refreshUser],
  );

  // Don't render children until we've initialized
  if (!isInitialized) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// Optional: Hook for protected routes
export function useRequireAuth(redirectTo = "/home") {
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isLoading, isAuthenticated, redirectTo]);

  return { user, isLoading, isAuthenticated };
}
