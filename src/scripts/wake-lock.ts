// Keeps the screen on while cooking, through the Screen Wake Lock API. No DOM here: the browser's navigator.wakeLock is passed in
// (or a stand-in in tests), so granted, denied, released-by-the-system and re-request-when-visible are all testable.
//   'on'      the lock is held: show "Screen stays on".
//   'off'     not held right now (not asked yet, let go, or the system took it while the page was hidden and we will ask again).
//   'failed'  no API, the request was refused, or the system took it while the page was showing: show "Screen may sleep" and the banner.
export type WakeStatus = 'off' | 'on' | 'failed';

interface Sentinel {
  addEventListener(name: 'release', listener: () => void): void;
  release(): Promise<void>;
}
export interface WakeApi {
  request(type: 'screen'): Promise<Sentinel>;
}

/** The browser's own API, or null where there is none (older iPhones, some desktop browsers). */
export function browserWakeApi(): WakeApi | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as unknown as { wakeLock?: WakeApi }).wakeLock ?? null;
}

export function createWakeLock({ api, isVisible, onChange }: { api: WakeApi | null; isVisible: () => boolean; onChange: (status: WakeStatus) => void }) {
  let status: WakeStatus = 'off';
  let sentinel: Sentinel | null = null;
  let wanted = false; // acquire() was called and release() has not been since
  let generation = 0; // a request that answers after release() (or a newer acquire()) is stale
  let pending: Promise<void> | null = null;

  const set = (next: WakeStatus): void => {
    if (next === status) return;
    status = next;
    onChange(next);
  };

  async function request(): Promise<void> {
    if (!api) return set('failed');
    const mine = ++generation;
    try {
      const lock = await api.request('screen');
      if (!wanted || mine !== generation) {
        await lock.release().catch(() => {});
        return;
      }
      sentinel = lock;
      lock.addEventListener('release', () => {
        if (sentinel !== lock) return;
        sentinel = null;
        if (wanted) set(isVisible() ? 'failed' : 'off'); // hidden: the system does this; we ask again when visible
      });
      set('on');
    } catch {
      if (wanted && mine === generation) set('failed');
    }
  }

  return {
    status: (): WakeStatus => status,
    /** Ask for the lock (a no-op if held or already being asked for). */
    acquire(): Promise<void> {
      wanted = true;
      if (sentinel || pending) return pending ?? Promise.resolve();
      pending = request().finally(() => (pending = null));
      return pending;
    },
    /** The page became visible again: ask again only if the system took the lock while it was hidden. */
    async onVisible(): Promise<void> {
      if (wanted && isVisible() && status === 'off' && !sentinel && !pending) await this.acquire();
    },
    /** Let go for good (Done, Exit, leaving the page) until acquire() is called again. */
    async release(): Promise<void> {
      wanted = false;
      generation++;
      const held = sentinel;
      sentinel = null;
      try {
        await held?.release();
      } catch {
        /* the lock is gone either way */
      }
      set('off');
    },
  };
}
