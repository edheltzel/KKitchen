// Keeps the bottom stack (search field + tab bar) above the on-screen keyboard.
// iOS Safari does not resize the layout viewport when the keyboard opens, so we
// measure the gap with window.visualViewport and translate the stack by that amount.
// Updates are batched into one requestAnimationFrame so scroll/resize bursts don't jitter.

const stack = document.getElementById('bottom-stack');
const form = document.getElementById('search-form');
const vv = window.visualViewport;

// Enter must not reload the page: search runs live on every keystroke.
form?.addEventListener('submit', (event) => event.preventDefault());

if (stack && vv) {
  let frame = 0;

  const update = () => {
    frame = 0;
    const offset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    stack.dataset.keyboard = offset > 80 ? 'open' : 'closed';
    stack.style.transform = offset > 0 ? `translate3d(0, ${-offset}px, 0)` : '';
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  update();
}
