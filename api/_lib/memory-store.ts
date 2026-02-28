// In-memory store for local development when KV is not available
const sessions = new Map<string, any>();

export const memoryStore = {
  get: async (key: string) => {
    return sessions.get(key);
  },

  set: async (key: string, value: any, options?: { ex?: number }) => {
    sessions.set(key, value);

    // Handle expiration
    if (options?.ex) {
      setTimeout(() => {
        sessions.delete(key);
      }, options.ex * 1000);
    }
  },

  clear: () => {
    sessions.clear();
  }
};