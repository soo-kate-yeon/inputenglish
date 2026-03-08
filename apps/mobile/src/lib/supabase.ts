// @MX:ANCHOR: supabase - mobile Supabase singleton with SecureStore auth persistence
// @MX:REASON: [AUTO] fan_in >= 3: imported by AuthContext, stores.ts, and OAuthButtons; central auth entrypoint
// @MX:SPEC: SPEC-MOBILE-002 - mobile Supabase client with PKCE flow and SecureStore
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";

// Polyfill crypto.subtle.digest for Hermes (missing Web Crypto API).
// Required by Supabase PKCE auth flow (sha256 of code_verifier).
if (typeof global.crypto === "undefined") {
  (global as any).crypto = {};
}
if (!(global.crypto as any).subtle) {
  (global.crypto as any).subtle = {
    digest: async (
      algorithm: AlgorithmIdentifier,
      data: BufferSource,
    ): Promise<ArrayBuffer> => {
      const algorithmName =
        typeof algorithm === "string" ? algorithm : algorithm.name;
      if (algorithmName !== "SHA-256") {
        throw new Error(
          `[crypto polyfill] Unsupported algorithm: ${algorithmName}`,
        );
      }

      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data instanceof Uint8Array
            ? data
            : new Uint8Array((data as any).buffer);

      let str = "";
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }

      const hex = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        str,
        { encoding: ExpoCrypto.CryptoEncoding.HEX },
      );

      const result = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      return result.buffer;
    },
  };
}

// ExpoSecureStoreAdapter stores auth tokens in iOS Keychain / Android Keystore.
// Must NOT use AsyncStorage for auth tokens - security requirement.
const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE flow required for native mobile OAuth (no implicit flow)
    flowType: "pkce",
  },
});
