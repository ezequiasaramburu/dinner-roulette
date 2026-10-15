#!/usr/bin/env node
// Prints the UI-polish guards from SPEC.md as counts, so each task can show the numbers going down.
// Informational: it always exits 0. Run: npm run check:ui
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files that may use a raw Pressable: the wrapper itself, and the dimmed backdrops that close a menu or sheet (a full-screen backdrop must not shrink). */
export const RAW_PRESSABLE_ALLOWED = [
  'src/components/ui/pressable-scale.tsx',
  'src/components/ui/side-menu.tsx',
  'src/components/dish/ingredients-sheet.tsx',
  'src/components/dish/report-sheet.tsx',
];
/** The screens that should show skeletons instead of spinners. */
export const SKELETON_SCREENS = ['src/app/(app)/swipe.tsx', 'src/app/(app)/recipes.tsx', 'src/app/(app)/preferences.tsx'];

/** The avatar's fixed colour pairs are a decorative palette, not theme colours. */
export const HEX_ALLOWED = ['src/components/ui/avatar.tsx'];

// Reanimated follows the phone's Reduce Motion setting by default (ReduceMotion.System) for springs, timings and
// entering/exiting/layout animations. What this guard catches is someone opting out of that.

function sourceFiles(root) {
  return readdirSync(join(root, 'src'), { recursive: true })
    .map((p) => `src/${p}`.replaceAll('\\', '/'))
    .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\./.test(p))
    .sort();
}

const withoutComments = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const count = (text, re) => (text.match(new RegExp(re, 'g')) ?? []).length;

function tally(entries) {
  const files = Object.fromEntries(entries.filter(([, n]) => n > 0));
  return { total: Object.values(files).reduce((a, b) => a + b, 0), files };
}

export function scan(root) {
  const rawPressable = [];
  const spinners = [];
  const hex = [];
  const reduceMotionOptOuts = [];

  for (const path of sourceFiles(root)) {
    const text = readFileSync(join(root, path), 'utf8');
    const code = withoutComments(text);

    if (!RAW_PRESSABLE_ALLOWED.includes(path)) rawPressable.push([path, count(code, '<Pressable\\b')]);
    if (SKELETON_SCREENS.includes(path)) spinners.push([path, count(code, '<ActivityIndicator\\b')]);
    if (path.startsWith('src/components/') && !HEX_ALLOWED.includes(path)) hex.push([path, count(code, '#[0-9A-Fa-f]{3,8}\\b')]);
    if (/\bReduceMotion\.Never\b/.test(code)) reduceMotionOptOuts.push(path);
  }

  return {
    rawPressable: tally(rawPressable),
    spinners: tally(spinners),
    hex: tally(hex),
    reduceMotionOptOuts,
  };
}

function report(title, target, { total, files }) {
  console.log(`${title}: ${total}  (target ${target})`);
  for (const [path, n] of Object.entries(files)) console.log(`    ${n} × ${path}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const r = scan(root);
  console.log(`UI polish guards for ${relative(join(root, '..'), root)}\n`);
  report('Raw Pressable outside the allowed files', 0, r.rawPressable);
  report('Spinners on swipe / recipes / preferences', 0, r.spinners);
  report('Hex colours in src/components', 0, r.hex);
  console.log(`Files that opt out of Reduce Motion: ${r.reduceMotionOptOuts.length}  (target 0)`);
  for (const path of r.reduceMotionOptOuts) console.log(`    ${path}`);
}
