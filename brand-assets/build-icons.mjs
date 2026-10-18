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
const EMOJI = readFileSync(brand('source/noto-pizza.png'));
const RING = 4 / 84; // the app's hub: a 4 px ring on an 84 px circle
const emojiImage = (size, glyph) => {
  const e = size * glyph;
  return `<image href="data:image/png;base64,${EMOJI.toString('base64')}" x="${(size - e) / 2}" y="${(size - e) / 2}" width="${e}" height="${e}"/>`;
};
const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
const raster = (markup, size) => sharp(Buffer.from(markup), { density: 384 }).resize(size, size);
// Apple rejects an icon with an alpha channel, even a fully opaque one.
const opaque = (img) => img.flatten({ background: PAPER }).removeAlpha();

/** Full-bleed icon: tomato to the edges with the pizza centred. The stores and launchers mask the shape themselves. */
const bleed = (size, glyph) => svg(size, `<rect width="${size}" height="${size}" fill="${TOMATO}"/>${emojiImage(size, glyph)}`);

const pizza = (size, glyph) => sharp(EMOJI).resize(Math.round(size * glyph)).toBuffer();

// iOS needs an opaque square icon. Android's adaptive icon is a tomato background plus the pizza inside the central safe zone.
await opaque(raster(bleed(1024, 0.62), 1024)).png().toFile(images('icon.png'));
await opaque(raster(bleed(512, 0.62), 512)).png().toFile(brand('play-store-512.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: TOMATO } }).png().toFile(images('android-icon-background.png'));
const fg = await pizza(1024, 0.52);
const at = Math.round((1024 - Math.round(1024 * 0.52)) / 2);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, left: at, top: at }]).png().toFile(images('android-icon-foreground.png'));
// Themed icon: only the shape counts, so the same pizza as a one-colour silhouette.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#000' } }).composite([{ input: fg, left: at, top: at, blend: 'dest-in' }]).png().toFile(images('android-icon-monochrome.png'));

// Splash: the hub (surface ring, tomato circle, pizza) on a transparent canvas, so it sits on the cream or espresso background.
const hub = svg(1024, `<circle cx="512" cy="512" r="460" fill="${SURFACE}"/><circle cx="512" cy="512" r="${460 - RING * 920}" fill="${TOMATO}"/>${emojiImage(1024, 0.6)}`);
await raster(hub, 1024).png().toFile(images('splash-icon.png'));

// Favicon for the app's own web build (app.json "web.favicon").
await raster(svg(1024, `<circle cx="512" cy="512" r="512" fill="${TOMATO}"/>${emojiImage(1024, 0.72)}`), 48).png().toFile(images('favicon.png'));
console.log('icons written to assets/images and brand-assets/play-store-512.png');
