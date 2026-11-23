// The slice of Storage the stores and the session use, so tests can pass a plain object.
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// This phone's localStorage, or a stand-in that reads as empty and refuses saves when the browser blocks storage.
// The refusal shows up as "unavailable" (with Retry) instead of a tap that silently saves nothing.
export function phoneStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {
        throw new Error('storage blocked');
      },
      removeItem: () => {},
    } as unknown as Storage;
  }
}

// sessionStorage, or a stand-in that reads as empty and forgets writes when the browser blocks storage.
// Unlike phoneStorage, a blocked write is not an error: scroll, tab and banner state are allowed to be lost.
export function pageSession(): Storage {
  try {
    return window.sessionStorage;
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage;
  }
}
