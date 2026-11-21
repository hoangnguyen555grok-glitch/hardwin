'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('the inline editor script parses as valid JavaScript', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());

  assert.equal(scripts.length, 1, 'expected one inline editor script');
  assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: 'index.html:inline-script' }));
});

test('the AI Bridge exposes FLUX image generation and saves the result locally', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /id="aiImageForm"/);
  assert.match(html, /id="aiImagePrompt" maxlength="2048"/);
  assert.match(html, /fetch\('\/api\/ai\/image'/);
  assert.match(html, /resourceLibrary\.images\.push\(asset\)/);
  assert.match(html, /makeObject\('image'/);
  assert.match(html, /ảnh không được tải lên Supabase/i);
});
