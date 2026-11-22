'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'library.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'lib/community-library.js'), 'utf8');

test('editor exposes a direct link to the public community library', () => {
  assert.match(editor, /href="\/library\.html"/);
  assert.match(editor, /Kho vật liệu/);
});

test('community library is publicly browsable and has all six planned categories', () => {
  assert.match(page, /Kho vật liệu/);
  assert.match(page, /Kho cộng đồng/);
  for (const label of ['Bối cảnh', 'Nhân vật', 'Đạo cụ', 'Âm thanh', 'Hiệu ứng', 'Font chữ']) {
    assert.ok(page.includes(label), `missing category: ${label}`);
  }
  assert.match(page, /href="\/"[^>]*>← Trình biên tập/);
});

test('upload control is visibly disabled until the upload pipeline is ready', () => {
  assert.match(page, /Đăng tài nguyên/);
  assert.match(page, /disabled aria-disabled="true"/);
  assert.doesNotMatch(page, /<input[^>]+type="file"/i);
});

test('community library starts with no mock assets and does not write files or call storage APIs', () => {
  assert.match(script, /const communityAssets = Object\.freeze\(\[\]\)/);
  assert.doesNotMatch(script, /\b(fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|FileReader)\b/);
  assert.doesNotMatch(page, /supabase|r2\.|upload\.do|storage\/v1/i);
});

test('community library script parses and filters the six categories', () => {
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'lib/community-library.js' }));
  assert.match(script, /addEventListener\('input', render\)/);
  assert.match(script, /aria-pressed/);
  assert.match(script, /asset\.category === activeCategory/);
});
