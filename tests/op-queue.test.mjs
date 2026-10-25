import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpQueue } from '../src/scripts/op-queue.ts';

function setup() {
  const log = [];
  const events = { fails: 0, emits: 0 };
  const queue = createOpQueue({ onFail: () => events.fails++, emit: () => events.emits++ });
  const op = (name, { kind = 'write', failTimes = 0 } = {}) => {
    let left = failTimes;
    return {
      kind,
      run: async () => {
        if (left-- > 0) throw new Error('down');
        log.push(name);
      },
    };
  };
  return { queue, op, log, events };
}

test('operations run one at a time, in the order they were enqueued', async () => {
  const { queue, op, log } = setup();
  await Promise.all([queue.enqueue(op('a')), queue.enqueue(op('b')), queue.enqueue(op('c'))]);
  assert.deepEqual(log, ['a', 'b', 'c']);
  assert.equal(queue.unavailable, false);
});

test('a failure marks the queue unavailable, tells onFail once, and later writes wait behind it', async () => {
  const { queue, op, log, events } = setup();
  await queue.enqueue(op('a', { failTimes: 1 }));
  await queue.enqueue(op('b'));
  await queue.enqueue(op('c', { kind: 'load' }));
  assert.equal(queue.unavailable, true);
  assert.equal(events.fails, 1);
  assert.deepEqual(log, [], 'nothing ran: b waits, a load is not queued');
});

test('Retry replays the failed list in tap order, then the queue is available again', async () => {
  const { queue, op, log } = setup();
  await queue.enqueue(op('a', { failTimes: 1 }));
  await queue.enqueue(op('b'));
  await queue.enqueue(op('c'));
  await queue.retry(op('load', { kind: 'load' }));
  assert.deepEqual(log, ['a', 'b', 'c']);
  assert.equal(queue.unavailable, false);
});

test('Retry that fails again keeps the failed one and everything behind it, in order', async () => {
  const { queue, op, log } = setup();
  await queue.enqueue(op('a', { failTimes: 2 }));
  await queue.enqueue(op('b'));
  await queue.retry(op('load', { kind: 'load' }));
  assert.equal(queue.unavailable, true);
  assert.deepEqual(log, []);
  await queue.retry(op('load', { kind: 'load' }));
  assert.deepEqual(log, ['a', 'b']);
  assert.equal(queue.unavailable, false);
});

test('a failed first load is retried with the load operation given to retry()', async () => {
  const { queue, op, log } = setup();
  await queue.enqueue(op('first-load', { kind: 'load', failTimes: 1 }));
  assert.equal(queue.unavailable, true);
  await queue.retry(op('second-load', { kind: 'load' }));
  assert.deepEqual(log, ['first-load']);
});
