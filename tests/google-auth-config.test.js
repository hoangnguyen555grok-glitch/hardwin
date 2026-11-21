'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Google OAuth uses the Supabase PKCE browser flow and restores the callback session', () => {
  const auth = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase-auth.js'), 'utf8');
  assert.match(auth, /flowType:\s*"pkce"/);
  assert.match(auth, /detectSessionInUrl:\s*true/);
  assert.match(auth, /persistSession:\s*true/);
  assert.match(auth, /provider:\s*"google"/);
  assert.match(auth, /queryParams:\s*\{\s*prompt:\s*"select_account"/);
  assert.match(auth, /new URL\("\/", window\.location\.origin\)/);
});

test('Google provider-disabled error explains the exact required Supabase setting', () => {
  const auth = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase-auth.js'), 'utf8');
  assert.match(auth, /provider is not enabled|unsupported provider/i);
  assert.match(auth, /validation_failed/);
  assert.match(auth, /Google Provider chưa bật trong Supabase/);
  assert.match(auth, /Authentication → Providers → Google/);
});

test('Geed Hardwin no longer includes an AI image-generation feature or endpoint', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /aiImageForm|aiImagePrompt|aiImageGenerate|FLUX\.1 Schnell/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'api', 'ai', 'image.js')), false);
});
