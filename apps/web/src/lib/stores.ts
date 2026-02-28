// @MX:NOTE: Web-specific store instantiation using @shadowoo/shared factories
// Mobile will have its own instantiation with AsyncStorage
import { createAppStore, createStudyStore } from '@shadowoo/shared';
import { createClient } from '@/utils/supabase/client';

const supabaseClient = createClient();

const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user?.id ?? null;
};

export const useStore = createAppStore(supabaseClient, getCurrentUserId);

export const useStudyStore = createStudyStore(
  typeof window !== 'undefined' ? localStorage : undefined
);
