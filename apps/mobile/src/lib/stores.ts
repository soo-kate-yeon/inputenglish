// @MX:NOTE: [AUTO] Mobile-specific store instantiation using @shadowoo/shared factories.
// Uses MMKV for study store persistence and SecureStore-backed supabase for auth.
import { createAppStore, createStudyStore } from '@shadowoo/shared';
import { supabase } from './supabase';
import { mmkvStorage } from './mmkv';

const getCurrentUserId = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
};

export const appStore = createAppStore(supabase, getCurrentUserId);

export const studyStore = createStudyStore(mmkvStorage);
