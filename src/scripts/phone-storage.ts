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
