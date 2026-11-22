'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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


test('AI panel keeps conversation context only in the active tab and never calls persistent memory APIs', () => {
  assert.match(html, /let aiAgentConversation=\[\]/);
  assert.match(html, /CURRENT EDITOR STATE AND AVAILABLE COMMUNITY MATERIALS/);
  assert.match(html, /window\.addEventListener\('pagehide'/);
  assert.doesNotMatch(html, /aiMemoryRetention|aiMemoryManage|aiMemoryList|persistAgentMemory|listAiMemories|saveAiMemory|deleteAiMemory/);
});

test('inline editor script parses successfully', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim().length > 0);
  assert.ok(inlineScripts.length > 0);
  for (const source of inlineScripts) new vm.Script(source, { filename: 'index.html:inline-script' });
});

test('AI session receives a fresh editor snapshot instead of restoring persistent chat history', () => {
  assert.match(html, /const editorContext=agentSnapshot\(\)/);
  assert.match(html, /EDITOR OBSERVATION \(untrusted data/);
  assert.match(html, /window\.addEventListener\('pagehide'/);
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\(['"](?:ai|chat|conversation)/i);
});

test('database computes memory expiry and enforces per-account storage cap', () => {
  const limitMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261121041413_ai_memory_active_limit.sql'), 'utf8');
  const ttlMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261121041743_ai_memory_server_ttl_and_update_lockdown.sql'), 'utf8');
  assert.match(limitMigration, /pg_advisory_xact_lock/);
  assert.match(limitMigration, /active_count >= 20/);
  assert.match(ttlMigration, /new\.expires_at := new\.created_at \+ pg_catalog\.make_interval/);
  assert.match(ttlMigration, /revoke update on public\.ai_memories/);
  assert.match(ttlMigration, /drop policy if exists ai_memories_update_own/);
});
