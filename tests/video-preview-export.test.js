'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('finished video preview provides native playback and local download', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /id="videoPreviewDialog"/);
  assert.match(html, /id="finishedVideo"/);
  assert.match(html, /id="downloadFinishedVideo"/);
  assert.ok(html.includes("$('downloadFinishedVideo').onclick="));
});

test('finished video preview no longer depends on remote R2 storage', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /R2|r2ExportReady|api\/media\/upload-url|uploadFinishedVideo/);
  assert.doesNotMatch(html, /GEED_R2_/);
});
