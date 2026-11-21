'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'lib/supabase-auth.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/cloud/workspace.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261121110000_cloud_workspace_storage.sql'), 'utf8');

test('cloud workspace keeps the editor snapshot API behind the existing editor bridge', () => {
  assert.match(html, /getProjectSnapshot:/);
  assert.match(html, /loadProjectSnapshot:/);
  assert.match(html, /id="cloudWorkspaceOpen"/);
  assert.match(html, /id="cloudWorkspaceDialog"/);
  assert.match(html, /src="\/lib\/cloud-workspace\.js"/);
});

test('browser cloud client uses the authenticated session token, not service credentials', () => {
  const client = fs.readFileSync(path.join(root, 'lib/cloud-workspace.js'), 'utf8');
  assert.match(client, /window\.GeedHardwinAuth\.getAccessToken/);
  assert.match(client, /Authorization.*Bearer/);
  assert.match(client, /crypto\.subtle\.digest/);
  assert.doesNotMatch(client, /service[_-]?role|GEED_R2_SECRET_ACCESS_KEY|GEED_SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(auth, /window\.GeedHardwinAuth/);
});

test('cloud API verifies the Google session and derives its owner from Supabase Auth', () => {
  assert.match(api, /verifySupabaseUser/);
  assert.match(api, /user\.id/);
  assert.doesNotMatch(api, /body\.userId|body\.user_id/);
  assert.match(api, /CLOUD_STORAGE_NOT_CONFIGURED/);
  assert.match(api, /prepare-delete/);
  assert.match(api, /confirm-delete/);
});

test('database reserves account quota atomically and locks client cloud metadata writes', () => {
  assert.match(migration, /for update/i);
  assert.match(migration, /cloud_storage_limit_bytes/);
  assert.match(migration, /CLOUD_STORAGE_QUOTA_EXCEEDED/);
  assert.match(migration, /revoke insert, update, delete on public\.project_metadata from authenticated/i);
  assert.match(migration, /grant execute on function public\.geed_reserve_cloud_storage[\s\S]*to service_role/i);
  assert.match(migration, /geed_delete_cloud_project/);
  assert.match(migration, /p_object_key <> \(p_user_id::text \|\| '\/' \|\| p_local_project_key \|\| '\/project\.json'\)/i);
});
