const store: Record<string, string> = {};

export const MMKV = jest.fn().mockImplementation(() => ({
  getString: (key: string) => store[key] ?? undefined,
  set: (key: string, value: string) => {
    store[key] = value;
  },
  delete: (key: string) => {
    delete store[key];
  },
  contains: (key: string) => key in store,
  getAllKeys: () => Object.keys(store),
}));
