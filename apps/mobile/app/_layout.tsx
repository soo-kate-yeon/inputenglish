import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import 'react-native-url-polyfill/auto';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isInitialized } = useAuth();

  // Hide splash screen once auth state is resolved to prevent flash of protected content
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // Handle deep links for OAuth callback (PKCE code exchange)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('auth/callback')) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    };

    // Handle initial URL (app opened from a deep link)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle subsequent URLs (app foregrounded via deep link)
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen
        name="study/[videoId]"
        options={{ headerShown: true, title: 'Study' }}
      />
      <Stack.Screen
        name="listening/[videoId]"
        options={{ headerShown: true, title: 'Listening' }}
      />
      <Stack.Screen
        name="shadowing/[videoId]"
        options={{ headerShown: true, title: 'Shadowing' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
