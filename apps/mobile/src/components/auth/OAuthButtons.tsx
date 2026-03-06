// @MX:NOTE: [AUTO] OAuth flow uses expo-web-browser + expo-auth-session with PKCE.
// skipBrowserRedirect: true required so we control the redirect via WebBrowser.openAuthSessionAsync.
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_PROVIDERS = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'kakao', label: 'Continue with Kakao' },
  { id: 'azure', label: 'Continue with Microsoft' },
] as const;

type Provider = (typeof OAUTH_PROVIDERS)[number]['id'];

export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      setLoadingProvider(provider);

      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'shadowoo',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned from Supabase');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    } catch (err) {
      console.error(`[OAuthButtons] ${provider} sign in failed:`, err);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      {OAUTH_PROVIDERS.map((providerConfig) => (
        <TouchableOpacity
          key={providerConfig.id}
          style={[
            styles.button,
            loadingProvider === providerConfig.id && styles.buttonDisabled,
          ]}
          onPress={() => handleOAuthSignIn(providerConfig.id)}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === providerConfig.id ? (
            <ActivityIndicator color="#333" />
          ) : (
            <Text style={styles.buttonText}>{providerConfig.label}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
  },
  button: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },
});
