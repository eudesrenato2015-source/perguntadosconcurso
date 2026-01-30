const memoryStore = new Map<string, string>();

export function safeGet(key: string){
  try { return localStorage.getItem(key); } catch { return memoryStore.get(key) ?? null; }
}

export function safeSet(key: string, value: string){
  try { localStorage.setItem(key, value); } catch { memoryStore.set(key, value); }
}

export function safeRemove(key: string){
  try { localStorage.removeItem(key); } catch { memoryStore.delete(key); }
}

