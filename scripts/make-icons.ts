// Renders app icons (PNG) from inline SVG using Playwright's Chromium.
import { chromium } from '@playwright/test';

const svg = (pad: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#0f172a"/>
  <g transform="translate(${pad},${pad}) scale(${(512 - 2 * pad) / 512})">
    <rect x="96" y="150" width="96" height="212" rx="20" fill="#2563eb"/>
    <rect x="208" y="150" width="96" height="212" rx="20" fill="#dc2626"/>
    <rect x="320" y="150" width="96" height="212" rx="20" fill="#16a34a"/>
  </g>
</svg>`;

const targets: [string, number, number][] = [
  ['public/icons/icon-192.png', 192, 0],
  ['public/icons/icon-512.png', 512, 0],
  ['public/icons/icon-maskable-512.png', 512, 64],
  ['public/icons/apple-touch-icon.png', 180, 0],
];

const browser = await chromium.launch();
for (const [path, size, pad] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg(pad)).toString('base64')}" width="${size}" height="${size}">`);
  await page.screenshot({ path, omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons written');
