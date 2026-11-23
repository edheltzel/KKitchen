// The failed-operations list and Retry, shared by the ratings and the week plan. Operations run one at a
// time in the order they were asked for. When one fails the queue is "unavailable": later writes wait behind
// it, and Retry replays the failed ones in tap order, so no tap is lost or applied out of order.

export interface Op {
  kind: 'load' | 'write';
  run: () => Promise<void>;
}

export function createOpQueue({ onFail, emit }: { onFail?: () => void; emit: () => void }) {
  let failed: Op[] = [];
  let unavailable = false;
  let chain: Promise<void> = Promise.resolve();

  const fail = (ops: Op[]): void => {
    failed = ops;
    unavailable = true;
    onFail?.();
  };
  const attempt = async (op: Op): Promise<void> => {
    if (unavailable) {
      if (op.kind === 'write') failed.push(op); // wait behind the failed ones
    } else {
      try {
        await op.run();
      } catch {
        fail([op]);
      }
    }
    emit();
  };
  const replay = async (loadOp: Op): Promise<void> => {
    const todo = failed.length ? [...failed] : [loadOp];
    for (let i = 0; i < todo.length; i++) {
      try {
        await todo[i].run();
      } catch {
        fail(todo.slice(i)); // the one that failed again and everything behind it, still in order
        emit();
        return;
      }
    }
    failed = [];
    unavailable = false;
    emit();
  };

  return {
    get unavailable(): boolean {
      return unavailable;
    },
    enqueue: (op: Op): Promise<void> => (chain = chain.then(() => attempt(op))),
    retry: (loadOp: Op): Promise<void> => (chain = chain.then(() => replay(loadOp))),
  };
}
