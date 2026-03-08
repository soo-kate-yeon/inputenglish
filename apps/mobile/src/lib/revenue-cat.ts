// @MX:NOTE: [AUTO] RevenueCat SDK wrapper for in-app purchase management.
// Handles SDK initialization, offerings, purchases, restores, and plan syncing to Supabase.
// @MX:SPEC: SPEC-MOBILE-006

import { Platform } from "react-native";
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOfferings,
} from "react-native-purchases";
import { supabase } from "./supabase";

export type Plan = "FREE" | "PREMIUM";

const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? "";
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? "";

// ---- SDK Lifecycle ----

export async function initRevenueCat(userId: string): Promise<void> {
  try {
    const apiKey = Platform.OS === "ios" ? RC_IOS_KEY : RC_ANDROID_KEY;
    Purchases.configure({ apiKey });
    await Purchases.logIn(userId);
  } catch (err) {
    // Never crash on RevenueCat init failure - log and continue
    console.error("[RevenueCat] initRevenueCat failed:", err);
  }
}

// ---- Customer Info ----

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

// ---- Offerings ----

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (err) {
    console.error("[RevenueCat] getOfferings failed:", err);
    return null;
  }
}

// ---- Purchase ----

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ customerInfo: CustomerInfo; productIdentifier: string }> {
  const result = await Purchases.purchasePackage(pkg);
  return {
    customerInfo: result.customerInfo,
    productIdentifier: pkg.product.identifier,
  };
}

// ---- Restore ----

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

// ---- Plan Derivation ----

export function getPlanFromCustomerInfo(info: CustomerInfo): Plan {
  const entitlements = info.entitlements.active;
  console.log("[RC] active entitlements:", Object.keys(entitlements));
  // Check for any active entitlement (fallback in case ID differs)
  if (entitlements["premium"] || Object.keys(entitlements).length > 0)
    return "PREMIUM";
  return "FREE";
}

// ---- Supabase Sync ----

export async function syncPlanToSupabase(plan: Plan): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .from("users")
      .update({ plan })
      .eq("id", userId);

    if (error) {
      console.error("[RevenueCat] syncPlanToSupabase error:", error.message);
    }
  } catch (err) {
    console.error("[RevenueCat] syncPlanToSupabase failed:", err);
  }
}
