// The Undo bar that takes the tab bar's place (CSS swaps them on #bottom-stack[data-undo]). Shared by the
// ratings and the week plan. An Undo offer stays for `seconds`, then `expire` is called; showing the same
// offer object again does not restart the clock.
export function createUndoBar({
  bar,
  stack,
  expire,
  seconds = 10,
}: {
  bar: HTMLElement;
  stack: HTMLElement;
  expire: () => void;
  seconds?: number;
}) {
  let timer = 0;
  let shown: object | null = null;
  return {
    show(offer: object | null): void {
      bar.hidden = offer === null;
      stack.dataset.undo = offer ? 'on' : 'off';
      if (offer === shown) return;
      shown = offer;
      clearTimeout(timer);
      if (offer) timer = window.setTimeout(expire, seconds * 1000);
    },
  };
}
