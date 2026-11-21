'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'lib', 'supabase-auth.js'), 'utf8');

test('signed-in account control exposes a profile menu with all agreed destinations', () => {
  for (const id of [
    'accountArea', 'accountButton', 'accountAvatar', 'accountAvatarFallback',
    'accountMenu', 'accountProfileItem', 'accountLibraryItem',
    'accountSettingsItem', 'accountHelpItem', 'accountSignOut'
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /role="menu"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Hồ sơ tài khoản/);
  assert.match(html, /Thư viện tài nguyên/);
  assert.match(html, /Cài đặt trình biên tập/);
  assert.match(html, /Trợ giúp và phím tắt/);
  assert.match(html, /Đăng xuất/);
});

test('Google profile metadata is rendered safely with a local initial fallback', () => {
  assert.match(auth, /user_metadata/);
  assert.match(auth, /full_name \|\| metadata\.name/);
  assert.match(auth, /lh3\.googleusercontent\.com/);
  assert.match(auth, /fallback\.textContent = initial/);
  assert.match(auth, /window\.dispatchEvent\(new CustomEvent\("geed-auth-change"/);
});

test('account menu actions navigate to resources, configure editor settings, help and sign out', () => {
  assert.match(auth, /accountLibraryItem/);
  assert.match(auth, /resourceLibraryList/);
  assert.match(auth, /accountSettingsFps/);
  assert.match(auth, /accountSettingsDuration/);
  assert.match(auth, /accountHelpItem/);
  assert.match(auth, /accountSignOut/);
  assert.match(auth, /client\.auth\.signOut\(\{ scope: "local" \}\)/);
});

test('account profile content is inserted as text rather than interpolated HTML', () => {
  assert.match(auth, /appendText\(copy, "h3", "", getDisplayName\(currentUser\)\)/);
  assert.match(auth, /appendText\(copy, "p", "", currentUser\?\.email/);
  assert.doesNotMatch(auth, /accountDialogContent\.innerHTML\s*=/);
});
