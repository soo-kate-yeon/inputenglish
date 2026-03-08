// @MX:NOTE: [AUTO] Hook for reading and refreshing the user's subscription plan via RevenueCat.
// Listens to CustomerInfo updates and syncs plan to Supabase when it changes.
// @MX:SPEC: SPEC-MOBILE-006

import { useEffect, useState, useCallback, useRef } from "react";
import Purchases from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCustomerInfo,
  getPlanFromCustomerInfo,
  syncPlanToSupabase,
  type Plan,
} from "@/lib/revenue-cat";

export interface UseSubscriptionResult {
  plan: Plan;
  canUseAI: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>("FREE");
  const [isLoading, setIsLoading] = useState(true);
  // Track the last synced plan to avoid redundant Supabase calls
  const lastSyncedPlanRef = useRef<Plan | null>(null);

  const applyCustomerInfo = useCallback(async (info: CustomerInfo) => {
    const derived = getPlanFromCustomerInfo(info);
    setPlan(derived);
    if (lastSyncedPlanRef.current !== derived) {
      lastSyncedPlanRef.current = derived;
      await syncPlanToSupabase(derived);
    }
  }, []);

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setPlan("FREE");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const info = await getCustomerInfo();
      await applyCustomerInfo(info);
    } catch (err) {
      console.error("[useSubscription] refresh failed:", err);
      // Default to FREE on error - never crash
      setPlan("FREE");
    } finally {
      setIsLoading(false);
    }
  }, [userId, applyCustomerInfo]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Listen to RevenueCat real-time updates
  useEffect(() => {
    if (!userId) return;

    const listener = (info: CustomerInfo) => {
      void applyCustomerInfo(info);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [userId, applyCustomerInfo]);

  return {
    plan,
    canUseAI: plan !== "FREE",
    isLoading,
    refresh,
  };
}
