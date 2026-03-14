const store: Record<string, string> = {};

export class MMKV {
  constructor(_options?: { id?: string }) {}

  getString(key: string): string | undefined {
    return store[key] ?? undefined;
  }

  set(key: string, value: string): void {
    store[key] = value;
  }

  delete(key: string): void {
    delete store[key];
  }

  contains(key: string): boolean {
    return key in store;
  }

  getAllKeys(): string[] {
    return Object.keys(store);
  }
}
