// @MX:NOTE: [AUTO] Mobile-specific store instantiation using @inputenglish/shared factories.
// Uses MMKV for study store persistence and SecureStore-backed supabase for auth.
import * as ExpoCrypto from "expo-crypto";
import { createAppStore, createStudyStore } from "@inputenglish/shared";
import { supabase } from "./supabase";
import { mmkvStorage } from "./mmkv";

type MutableSubtleCrypto = Partial<SubtleCrypto> & {
  digest?: (
    algorithm: AlgorithmIdentifier,
    data: BufferSource,
  ) => Promise<ArrayBuffer>;
};

type MutableCrypto = Partial<Crypto> & {
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
  subtle?: MutableSubtleCrypto;
};

const globalObject = globalThis as typeof globalThis & { crypto?: unknown };
const cryptoObject = (globalObject.crypto ?? {}) as MutableCrypto;
globalObject.crypto = cryptoObject as unknown as Crypto;

// Hermes on RN 0.76 may not expose a complete WebCrypto implementation.
// Patch only the missing methods so libraries like Supabase PKCE can use SHA-256.
if (typeof cryptoObject.randomUUID !== "function") {
  cryptoObject.randomUUID = () =>
    ExpoCrypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`;
}

if (typeof cryptoObject.getRandomValues !== "function") {
  cryptoObject.getRandomValues = <T extends ArrayBufferView | null>(
    array: T,
  ): T => {
    if (array === null) return array;
    return ExpoCrypto.getRandomValues(array as never) as T;
  };
}

const subtle = (cryptoObject.subtle ?? {}) as MutableSubtleCrypto;
cryptoObject.subtle = subtle as SubtleCrypto;

if (typeof subtle.digest !== "function") {
  subtle.digest = async (
    algorithm: AlgorithmIdentifier,
    data: BufferSource,
  ) => {
    if (typeof algorithm !== "string") {
      throw new TypeError(
        "Only string digest algorithms are supported in React Native",
      );
    }

    return ExpoCrypto.digest(
      algorithm as ExpoCrypto.CryptoDigestAlgorithm,
      data,
    );
  };
}

const getCurrentUserId = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
};

export const appStore = createAppStore(supabase, getCurrentUserId);

export const studyStore = createStudyStore(mmkvStorage);
