// @MX:ANCHOR: supabase - mobile Supabase singleton with SecureStore auth persistence
// @MX:REASON: [AUTO] fan_in >= 3: imported by AuthContext, stores.ts, and OAuthButtons; central auth entrypoint
// @MX:SPEC: SPEC-MOBILE-002 - mobile Supabase client with PKCE flow and SecureStore
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

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
    'Missing Supabase environment variables. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE flow required for native mobile OAuth (no implicit flow)
    flowType: 'pkce',
  },
});
