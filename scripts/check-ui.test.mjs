import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { scan } from './check-ui.mjs';

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'check-ui-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test('raw Pressables are counted everywhere except the allowed files, and PressableScale is not one', () => {
  const root = project({
    'src/components/ui/pressable-scale.tsx': '<Pressable a /><Pressable b />',
    'src/components/chip.tsx': '<Pressable a />\n<PressableScale b />',
    'src/app/(app)/home.tsx': '<Pressable a />\n<Pressable b />',
  });
  const { rawPressable } = scan(root);
  assert.equal(rawPressable.total, 3);
  assert.deepEqual(rawPressable.files, { 'src/components/chip.tsx': 1, 'src/app/(app)/home.tsx': 2 });
});

test('spinners are only counted on the swipe, recipes and preferences screens', () => {
  const root = project({
    'src/app/(app)/swipe.tsx': '<ActivityIndicator /><ActivityIndicator />',
    'src/app/(app)/(tabs)/recipes.tsx': '<ActivityIndicator />',
    'src/app/(app)/reveal.tsx': '<ActivityIndicator />',
    'src/components/ui/button.tsx': '<ActivityIndicator />',
  });
  const { spinners } = scan(root);
  assert.equal(spinners.total, 3);
  assert.deepEqual(spinners.files, { 'src/app/(app)/swipe.tsx': 2, 'src/app/(app)/(tabs)/recipes.tsx': 1 });
});

test('hex colours in components are counted, comments, other folders and the avatar palette are not', () => {
  const root = project({
    'src/components/ui/button.tsx': "shadowColor: '#B93D26',\n// was #FFF\nconst x = '#abc';",
    'src/components/ui/avatar.tsx': "['#B93D26', '#FFF8EF']",
    'src/constants/theme.ts': "primary: '#B93D26'",
  });
  const { hex } = scan(root);
  assert.equal(hex.total, 2);
  assert.deepEqual(Object.keys(hex.files), ['src/components/ui/button.tsx']);
});

test('files that opt out of Reduce Motion are listed; the default (follow the system) is fine', () => {
  const root = project({
    'src/app/a.tsx': 'withTiming(1, { reduceMotion: ReduceMotion.Never })',
    'src/app/b.tsx': 'FadeInDown.duration(500).reduceMotion(ReduceMotion.Never)',
    'src/app/c.tsx': 'entering={FadeInDown.duration(500)}',
    'src/app/d.tsx': 'withSpring(1, { reduceMotion: ReduceMotion.Always })',
  });
  const { reduceMotionOptOuts } = scan(root);
  assert.deepEqual(reduceMotionOptOuts, ['src/app/a.tsx', 'src/app/b.tsx']);
});

test('test files are ignored', () => {
  const root = project({ 'src/components/x.test.tsx': "<Pressable /> '#fff' ReduceMotion.Never" });
  const r = scan(root);
  assert.equal(r.rawPressable.total + r.hex.total, 0);
  assert.deepEqual(r.reduceMotionOptOuts, []);
});
