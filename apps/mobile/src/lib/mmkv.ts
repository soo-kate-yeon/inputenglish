// @MX:NOTE: [AUTO] MMKV is the high-performance storage for mobile.
// Used as the Zustand persist storage adapter (not for auth tokens - those go to SecureStore).
import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';

const storage = new MMKV();

// @MX:ANCHOR: mmkvStorage - Zustand StateStorage adapter backed by MMKV
// @MX:REASON: [AUTO] fan_in >= 3: passed to createStudyStore and any future persist-enabled stores
export const mmkvStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};

export default storage;
