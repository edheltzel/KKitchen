// Tells the page how tall the bottom stack is (banner, search field, tab bar or Undo bar), so the last
// thing on the page always scrolls clear of it. The CSS reads --kk-stack-height (see .kk-room).
const roomStack = document.getElementById('bottom-stack');
if (roomStack && 'ResizeObserver' in window) {
  // A stack that reads 0 tall (not laid out yet, or hidden) must not be written: 0px would take away all the room.
  // Leaving the variable unset keeps the CSS fallback until a real height arrives.
  const apply = () => {
    const { style } = document.documentElement;
    if (roomStack.offsetHeight > 0) style.setProperty('--kk-stack-height', `${roomStack.offsetHeight}px`);
    else style.removeProperty('--kk-stack-height');
  };
  new ResizeObserver(apply).observe(roomStack);
  apply();
}
