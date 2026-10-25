// Tells the page how tall the bottom stack is (banner, search field, tab bar or Undo bar), so the last
// thing on the page always scrolls clear of it. The CSS reads --kk-stack-height (see .kk-room).
const stack = document.getElementById('bottom-stack');
if (stack && 'ResizeObserver' in window) {
  const apply = () => document.documentElement.style.setProperty('--kk-stack-height', `${stack.offsetHeight}px`);
  new ResizeObserver(apply).observe(stack);
  apply();
}
