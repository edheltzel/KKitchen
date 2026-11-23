// A stand-in for navigator.wakeLock, installed before every page load. The mode is read from localStorage 'e2e:wake':
// 'grant' (default), 'deny' (request rejects) or 'none' (the API is missing, as in an old browser).
// window.__wake counts requests and live locks; __wake.systemRelease() plays "the system let go of the lock".
export async function installWakeStandIn(send) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const mode = () => { try { return localStorage.getItem('e2e:wake') || 'grant'; } catch { return 'grant'; } };
      const wake = { requests: 0, active: 0, sentinels: [], systemRelease() { const s = wake.sentinels[wake.sentinels.length - 1]; if (s && !s.released) { s.released = true; wake.active--; s.l.forEach((f) => f()); } } };
      window.__wake = wake;
      if (mode() === 'none') { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined }); return; }
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
        request: async () => {
          wake.requests++;
          if (mode() === 'deny') throw new DOMException('not allowed', 'NotAllowedError');
          const s = { released: false, l: [], addEventListener(n, f) { this.l.push(f); }, async release() { if (this.released) return; this.released = true; wake.active--; this.l.forEach((f) => f()); } };
          wake.active++; wake.sentinels.push(s);
          return s;
        },
      } });
    })()`,
  });
}
