// Builds the app's icons from the pizza-slice emoji on tomato (the wheel's hub, as the app draws it). Light theme colours.
// The emoji is Noto Emoji (Apache 2.0, see NOTICE.md), because Apple's emoji art cannot be reused as a logo.
// Run from the project root:   npm i --no-save sharp && node brand-assets/build-icons.mjs
// Writes the files app.json reads into assets/images, plus brand-assets/play-store-512.png for the Play Console.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = dirname(fileURLToPath(import.meta.url));
const brand = (...p) => join(root, ...p);
const images = (name) => join(root, '..', 'assets', 'images', name);

const PAPER = '#FAF5EC';
const SURFACE = '#FFFDF8';
const TOMATO = '#B93D26';

// How far from the art's bounding-box centre (0) towards its centre of mass (1) the slice is centred. Raise it if it still looks off.
const BLEND = 0.5;
// After that, move the slice further left and up by this share of the emoji box (a circle makes a wedge look low and to the right).
const NUDGE = { left: 0.04, up: 0.05 };
// The centred picture is this much bigger than the source square, so sizes below are multiplied by it and the slice keeps its size.
const SCALE = 1.25;

/** The slice is a diagonal wedge, so it never looks centred in its square. Shift it until the middle of the picture sits at BLEND between the art's bounding box centre and its centre of mass. */
async function centred(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, sx = 0, sy = 0, sa = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > 16) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      sx += x * a;
      sy += y * a;
      sa += a;
    }
  const bx = (x0 + x1) / 2;
  const by = (y0 + y1) / 2;
  const cx = Math.round(bx + (sx / sa - bx) * BLEND);
  const cy = Math.round(by + (sy / sa - by) * BLEND);
  const pad = W; // room to shift without clipping
  const OUT = Math.round(W * SCALE); // output window, bigger than the source so a shifted slice is not cut
  // Two steps: sharp runs extract before extend in a single pipeline.
  const padded = await sharp(png).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp(padded).extract({ left: cx + pad - OUT / 2 + Math.round(NUDGE.left * W), top: cy + pad - OUT / 2 + Math.round(NUDGE.up * H), width: OUT, height: OUT }).png().toBuffer();
}
const EMOJI = await centred(readFileSync(brand('source/noto-pizza.png')));
const RING = 4 / 84; // the app's hub: a 4 px ring on an 84 px circle
const emojiImage = (size, glyph) => {
  const e = size * glyph * SCALE;
  return `<image href="data:image/png;base64,${EMOJI.toString('base64')}" x="${(size - e) / 2}" y="${(size - e) / 2}" width="${e}" height="${e}"/>`;
};
const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
const raster = (markup, size) => sharp(Buffer.from(markup), { density: 384 }).resize(size, size);
// Apple rejects an icon with an alpha channel, even a fully opaque one.
const opaque = (img) => img.flatten({ background: PAPER }).removeAlpha();

/** Full-bleed icon: tomato to the edges with the pizza centred. The stores and launchers mask the shape themselves. */
const bleed = (size, glyph) => svg(size, `<rect width="${size}" height="${size}" fill="${TOMATO}"/>${emojiImage(size, glyph)}`);

const pizza = (size, glyph) => sharp(EMOJI).resize(Math.round(size * glyph * SCALE)).toBuffer();

// iOS needs an opaque square icon. Android's adaptive icon is a tomato background plus the pizza inside the central safe zone.
await opaque(raster(bleed(1024, 0.62), 1024)).png().toFile(images('icon.png'));
await opaque(raster(bleed(512, 0.62), 512)).png().toFile(brand('play-store-512.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: TOMATO } }).png().toFile(images('android-icon-background.png'));
const fg = await pizza(1024, 0.52);
const at = Math.round((1024 - Math.round(1024 * 0.52 * SCALE)) / 2);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, left: at, top: at }]).png().toFile(images('android-icon-foreground.png'));
// Themed icon: only the shape counts, so the same pizza as a one-colour silhouette.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#000' } }).composite([{ input: fg, left: at, top: at, blend: 'dest-in' }]).png().toFile(images('android-icon-monochrome.png'));

// Splash: the hub (surface ring, tomato circle, pizza) on a transparent canvas, so it sits on the cream or espresso background.
const hub = svg(1024, `<circle cx="512" cy="512" r="460" fill="${SURFACE}"/><circle cx="512" cy="512" r="${460 - RING * 920}" fill="${TOMATO}"/>${emojiImage(1024, 0.6)}`);
await raster(hub, 1024).png().toFile(images('splash-icon.png'));

console.log('icons written to assets/images and brand-assets/play-store-512.png');
