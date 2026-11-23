import { test } from 'node:test';
import assert from 'node:assert/strict';

// Runs the real stack-room.ts against a tiny fake page, so we can say what --kk-stack-height ends up as.
let n = 0;
async function load({ height }) {
  const props = new Map();
  const stack = { offsetHeight: height };
  let observed = null;
  globalThis.window = { ResizeObserver: true };
  globalThis.ResizeObserver = class {
    constructor(fn) {
      observed = fn;
    }
    observe() {}
  };
  globalThis.document = {
    getElementById: (id) => (id === 'bottom-stack' ? stack : null),
    documentElement: {
      style: {
        setProperty: (k, v) => props.set(k, v),
        removeProperty: (k) => props.delete(k),
        getPropertyValue: (k) => props.get(k) ?? '',
      },
    },
  };
  await import(`../src/scripts/stack-room.ts?case=${n++}`);
  return { stack, props, fire: () => observed() };
}

test('after load the stack height variable is set to a non-zero value', async () => {
  const { props } = await load({ height: 112 });
  assert.equal(props.get('--kk-stack-height'), '112px');
});

test('a stack that reads 0 tall before first paint leaves the CSS fallback alone, then picks up the real height', async () => {
  const { stack, props, fire } = await load({ height: 0 });
  assert.notEqual(props.get('--kk-stack-height'), '0px', 'a 0px variable would remove all the room under the last card');
  assert.equal(props.has('--kk-stack-height'), false, 'not set at all, so the CSS fallback applies');
  stack.offsetHeight = 76; // first layout happens and the observer fires
  fire();
  assert.equal(props.get('--kk-stack-height'), '76px');
});

test('if the stack later reads 0 again (hidden), the variable is dropped back to the CSS fallback', async () => {
  const { stack, props, fire } = await load({ height: 90 });
  stack.offsetHeight = 0;
  fire();
  assert.equal(props.has('--kk-stack-height'), false);
});
