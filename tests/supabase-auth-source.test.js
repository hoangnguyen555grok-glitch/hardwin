'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const authSource = fs.readFileSync(path.join(root, 'lib/supabase-auth.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('browser auth uses only the Supabase publishable key and PKCE', () => {
  assert.match(authSource, /sb_publishable_/);
  assert.match(authSource, /flowType:\s*["']pkce["']/);
  assert.match(authSource, /provider:\s*["']google["']/);
  assert.doesNotMatch(authSource, /service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(authSource, /signInWithPassword|signInWithOtp|provider:\s*["'](facebook|apple)["']/);
});
test('database auth trigger rejects every provider except Google', () => {
  const migrationPath = path.join(root, 'supabase/migrations/20261121040340_google_only_auth_provider.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /before insert on auth\.users/i);
  assert.match(migration, /new\.raw_app_meta_data\s*->>\s*'provider'/i);
  assert.match(migration, /<>\s*'google'/i);
  assert.match(migration, /using errcode\s*=\s*'42501'/i);
});

test('editor remains usable without account sign-in and preserves local autosave/export', () => {
  assert.match(html, /id="accountButton"/);
  assert.match(html, /id="accountStatus"/);
  assert.match(html, /src="\/lib\/supabase-auth\.js"/);
  assert.match(html, /function openAutosaveDb\(/);
  assert.match(html, /function scheduleAutosave\(/);
  assert.match(html, /id="saveProject"/);
  assert.match(html, /id="openProject"/);
});


test('AI Bridge uses the authenticated cloud agent loop rather than keyword-only command parsing', () => {
  assert.match(html, /data-ai-prompt/);
  assert.match(html, /fetch\('\/api\/ai\/chat'/);
  assert.match(html, /mode:'agent'/);
  assert.match(html, /aiAgentConversation/);
  assert.match(html, /runAgentEditorAction/);
  assert.match(html, /window\.confirm\(/);
  assert.doesNotMatch(html, /function aiBridgeCommand\(/);
  assert.doesNotMatch(html, /data-ai-cmd/);
});


test('AI memory is opt-in, owner-scoped, expiring and user-manageable', () => {
  assert.match(authSource, /async function saveAiMemory/);
  assert.match(authSource, /async function listAiMemories/);
  assert.match(authSource, /async function deleteAiMemory/);
  assert.match(authSource, /\[2, 3, 7, 30\]/);
  assert.match(authSource, /Credentials and secrets cannot be saved as AI memory/);
  assert.match(authSource, /client\.from\("ai_memories"\)/);
  assert.match(html, /<option value="0" selected>Không lưu/);
  assert.match(html, /<option value="2">2 ngày/);
  assert.match(html, /<option value="3">3 ngày/);
  assert.match(html, /<option value="7">7 ngày/);
  assert.match(html, /<option value="30">30 ngày/);
  assert.match(html, /id="aiMemoryManage"/);
  assert.match(html, /id="aiMemoryList"/);
  assert.match(html, /await persistAgentMemory\(agent\)/);
  assert.match(html, /aiAgentConversation=\[\]/);
});
