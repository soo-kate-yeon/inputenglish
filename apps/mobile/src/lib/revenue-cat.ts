// @MX:NOTE: [AUTO] RevenueCat SDK wrapper for in-app purchase management.
// Handles SDK initialization, offerings, purchases, restores, and plan syncing to Supabase.
// @MX:WARN: configure() must be called at app startup BEFORE any other SDK call.
// logIn() is separate and not required for getOfferings().
// @MX:SPEC: SPEC-MOBILE-006

import { Platform } from "react-native";
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOfferings,
} from "react-native-purchases";
import { supabase } from "./supabase";

export type Plan = "FREE" | "PREMIUM";

// Use bracket notation to prevent babel-preset-expo from inlining at compile time.
// This ensures the env var is read at runtime (needed for test environments).
const ENV = process.env;
function getApiKey(): string {
  const iosKey = ENV["EXPO_PUBLIC_RC_IOS_KEY"] ?? "";
  const androidKey = ENV["EXPO_PUBLIC_RC_ANDROID_KEY"] ?? "";
  return Platform.OS === "ios" ? iosKey : androidKey;
}

// ---- SDK Lifecycle ----

let configuredPromise: Promise<boolean> | null = null;
let sdkConfigured = false;

/**
 * Configure RevenueCat SDK. Call at app startup (no user needed).
 * getOfferings() only requires configure, not logIn.
 */
export function configureRevenueCat(): Promise<boolean> {
  if (configuredPromise) return configuredPromise;

  configuredPromise = (async () => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.error(
          "[RevenueCat] API key is empty — check EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY",
        );
        return false;
      }
      Purchases.configure({ apiKey });
      sdkConfigured = true;
      console.log("[RevenueCat] configured OK");
      return true;
    } catch (err) {
      console.error("[RevenueCat] configure failed:", err);
      return false;
    }
  })();

  return configuredPromise;
}

/**
 * Log in a user to RevenueCat. Call after auth is confirmed.
 * Requires configureRevenueCat() to have been called first.
 */
export async function logInRevenueCat(userId: string): Promise<void> {
  try {
    await configureRevenueCat();
    if (!sdkConfigured) return;
    await Purchases.logIn(userId);
    console.log("[RevenueCat] logIn OK, userId:", userId);
  } catch (err) {
    console.error("[RevenueCat] logIn failed:", err);
  }
}

/**
 * Wait for SDK configure to complete. Returns true if configured successfully.
 */
export async function waitForRevenueCat(): Promise<boolean> {
  if (!configuredPromise) {
    return configureRevenueCat();
  }
  return configuredPromise;
}

/** @deprecated Use configureRevenueCat() + logInRevenueCat() instead */
export async function initRevenueCat(userId: string): Promise<void> {
  await configureRevenueCat();
  await logInRevenueCat(userId);
}

// ---- Customer Info ----

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

// ---- Offerings ----

/**
 * Fetch offerings with retry + exponential backoff.
 * Retries up to `maxRetries` times with delays of 1s, 2s, 4s.
 * This handles sandbox/review environment latency gracefully.
 */
export async function getOfferings(
  maxRetries = 3,
): Promise<PurchasesOfferings | null> {
  const configured = await waitForRevenueCat();
  if (!configured) {
    console.error("[RevenueCat] getOfferings aborted — SDK not configured");
    return null;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const offerings = await Purchases.getOfferings();
      if (
        offerings?.current &&
        offerings.current.availablePackages.length > 0
      ) {
        console.log(
          "[RevenueCat] offerings.current:",
          offerings.current.identifier,
        );
        console.log(
          "[RevenueCat] packages:",
          offerings.current.availablePackages.map((p) => p.product.identifier),
        );
        return offerings;
      }
      // Offerings returned but empty — retry (sandbox delay)
      console.warn(
        `[RevenueCat] getOfferings attempt ${attempt + 1}: empty offerings, retrying...`,
      );
    } catch (err) {
      lastError = err;
      console.warn(
        `[RevenueCat] getOfferings attempt ${attempt + 1} failed:`,
        err,
      );
    }
    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  console.error(
    "[RevenueCat] getOfferings failed after retries:",
    lastError ?? "empty offerings",
  );
  return null;
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
