import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWakeLock } from '../src/scripts/wake-lock.ts';

// A stand-in for navigator.wakeLock: grants, denies, and lets the test play "the system released it".
function standIn({ deny = false } = {}) {
  const api = {
    requests: 0,
    sentinels: [],
    deny,
    async request(type) {
      api.requests++;
      assert.equal(type, 'screen');
      if (api.deny) throw new DOMException('not allowed', 'NotAllowedError');
      const listeners = [];
      const sentinel = {
        released: false,
        addEventListener: (name, fn) => name === 'release' && listeners.push(fn),
        async release() {
          if (sentinel.released) return;
          sentinel.released = true;
          listeners.forEach((fn) => fn());
        },
        systemRelease() {
          sentinel.released = true;
          listeners.forEach((fn) => fn());
        },
      };
      api.sentinels.push(sentinel);
      return sentinel;
    },
  };
  return api;
}

function make(options = {}) {
  const api = options.api === undefined ? standIn() : options.api;
  const log = [];
  const state = { visible: true };
  const lock = createWakeLock({ api, isVisible: () => state.visible, onChange: (s) => log.push(s) });
  return { api, log, state, lock };
}

test('granted: status goes on and the lock is held', async () => {
  const { api, lock, log } = make();
  assert.equal(lock.status(), 'off');
  await lock.acquire();
  assert.equal(lock.status(), 'on');
  assert.deepEqual(log, ['on']);
  assert.equal(api.requests, 1);
});

test('denied: status is failed, and nothing is held', async () => {
  const { lock, log } = make({ api: standIn({ deny: true }) });
  await lock.acquire();
  assert.equal(lock.status(), 'failed');
  assert.deepEqual(log, ['failed']);
});

test('no Wake Lock API at all (older iPhones, some browsers): failed, with no error thrown', async () => {
  const none = createWakeLock({ api: null, isVisible: () => true, onChange: () => {} });
  await none.acquire();
  assert.equal(none.status(), 'failed');
});

test('asking twice does not take a second lock', async () => {
  const { api, lock } = make();
  await lock.acquire();
  await lock.acquire();
  assert.equal(api.requests, 1);
});

test('released by the system while the page is hidden: status goes off, and coming back to the page asks again', async () => {
  const { api, lock, state, log } = make();
  await lock.acquire();
  state.visible = false;
  api.sentinels[0].systemRelease();
  assert.equal(lock.status(), 'off');
  assert.equal(api.requests, 1, 'no request while hidden');
  await lock.onVisible(); // still hidden here: must not ask
  assert.equal(api.requests, 1);
  state.visible = true;
  await lock.onVisible();
  assert.equal(api.requests, 2);
  assert.equal(lock.status(), 'on');
  assert.deepEqual(log, ['on', 'off', 'on']);
});

test('released by the system while the page is visible (low battery, a policy): failed, so the page says it may sleep, and no retry loop', async () => {
  const { api, lock } = make();
  await lock.acquire();
  api.sentinels[0].systemRelease();
  assert.equal(lock.status(), 'failed');
  assert.equal(api.requests, 1);
});

test('becoming visible with the lock still held does nothing', async () => {
  const { api, lock } = make();
  await lock.acquire();
  await lock.onVisible();
  assert.equal(api.requests, 1);
});

test('release() lets go, and later visibility changes do not take it back', async () => {
  const { api, lock, log } = make();
  await lock.acquire();
  await lock.release();
  assert.equal(api.sentinels[0].released, true);
  assert.equal(lock.status(), 'off');
  await lock.onVisible();
  assert.equal(api.requests, 1);
  assert.deepEqual(log, ['on', 'off']);
});

test('release() with nothing held is quiet, and a release that throws is swallowed', async () => {
  const { lock, api } = make();
  await lock.release();
  assert.equal(lock.status(), 'off');
  await lock.acquire();
  api.sentinels[0].release = async () => {
    throw new Error('boom');
  };
  await lock.release();
  assert.equal(lock.status(), 'off');
});

test('acquire() after release() works again (back from Done to a step)', async () => {
  const { api, lock } = make();
  await lock.acquire();
  await lock.release();
  await lock.acquire();
  assert.equal(api.requests, 2);
  assert.equal(lock.status(), 'on');
});

test('a lock granted after release() was called (the request was still in flight) is let go straight away', async () => {
  const api = standIn();
  const slow = api.request;
  let finish;
  api.request = (type) => new Promise((resolve) => (finish = () => resolve(slow(type))));
  const { lock } = make({ api });
  const pending = lock.acquire();
  await lock.release();
  finish();
  await pending;
  assert.equal(api.sentinels[0].released, true);
  assert.equal(lock.status(), 'off');
});

test('a denied lock stays failed on later visibility changes (no nagging loop), until acquire() is called again', async () => {
  const api = standIn({ deny: true });
  const { lock } = make({ api });
  await lock.acquire();
  await lock.onVisible();
  assert.equal(api.requests, 1);
  api.deny = false;
  await lock.acquire();
  assert.equal(lock.status(), 'on');
});
