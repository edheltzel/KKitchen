// The week and the favorites at a phone width and a computer width. Nothing may be wider than the viewport.
// The recipe form is served by the Worker, so the static harness cannot open it.
import { startHarness } from './harness.mjs';

const h = await startHarness({ port: 4491 });
const pages = ['/week/', '/favorites/'];

const widest = () => h.ev(`(() => {
  const view = document.documentElement.clientWidth;
  let worst = 0;
  for (const el of document.querySelectorAll('body *')) {
    const box = el.getBoundingClientRect();
    worst = Math.max(worst, box.right - view);
  }
  return Math.round(worst);
})()`);

try {
  for (const width of [390, 1280]) {
    await h.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
    for (const path of pages) {
      await h.goto(path);
      const over = await widest();
      h.check(`${width}px ${path} fits`, over <= 1, over > 1 ? `past the edge by ${over}px` : '');
    }
  }
} catch (error) {
  h.check('layout run', false, String(error).slice(0, 200));
}
await h.finish();
