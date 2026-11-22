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
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/community-library.json'), 'utf8'));
const docs = fs.readFileSync(path.join(root, 'docs/COMMUNITY-ASSET-LIBRARY.md'), 'utf8');

test('editor and public library share one static asset catalog', () => {
  assert.match(editor, /fetch\('\/assets\/community-library\.json'/);
  assert.match(editor, /href="\/library\.html"/);
  assert.match(page, /Kho vật liệu/);
  assert.deepEqual(catalog.assets, []);
  assert.equal(catalog.schemaVersion, 2);
});

test('catalog structure contains six community categories and media support', () => {
  for (const category of ['backgrounds','characters','props','audio','effects','fonts']) {
    assert.ok(page.includes(category) || script.includes(category), 'missing category '+category);
  }
  for (const mediaType of ['image','audio','video','font']) assert.ok(script.includes(mediaType));
});

test('resource page loads catalog metadata and renders safely without mock assets', () => {
  assert.match(script, /fetch\('\/assets\/community-library\.json'/);
  assert.match(script, /createElement\('article'\)/);
  assert.match(script, /textContent/);
  assert.match(script, /communityAssets = data\.assets\.map\(normalizeAsset\)/);
  assert.match(script, /sessionStorage\.setItem\('geedCommunityAssetHandoff'/);
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'lib/community-library.js' }));
});

test('contributions submit only public HTTPS URLs through GitHub Issues, never file bytes', () => {
  assert.match(page, /Đề xuất tài nguyên bằng link/);
  assert.match(page, /Đường dẫn tệp HTTPS công khai/);
  assert.match(script, /https:\/\/github\.com\/hoangnguyen555grok-glitch\/hardwin\/issues\/new/);
  assert.match(script, /URL công khai/);
  assert.doesNotMatch(page, /<input[^>]+type="file"/i);
  assert.doesNotMatch(script, /FileReader|XMLHttpRequest|FormData\([^)]*files/i);
});

test('external asset loading is direct and the editor stores URLs instead of binaries', () => {
  assert.match(editor, /safeCommunityAssetUrl/);
  assert.match(editor, /crossOrigin='anonymous'/);
  assert.match(editor, /externalUrl:url/);
  assert.match(editor, /tệp không được tải lên Geed Hardwin/);
  assert.match(docs, /does \*\*not\*\* receive or store community media files/);
  assert.match(docs, /CORS/);
});

test('only image and audio catalog entries are enabled for editor insertion', () => {
  assert.match(editor, /asset\.mediaType==='image'/);
  assert.match(editor, /asset\.mediaType==='audio'/);
  assert.match(editor, /Video và font đang ở chế độ xem trước/);
  assert.match(script, /supportsEditor === true && \['image','audio'\]/);
});

test('no private uploads, storage APIs or database writes are introduced', () => {
  assert.doesNotMatch(script, /localStorage|indexedDB|supabase|R2/);
  assert.doesNotMatch(page, /supabase|storage\/v1|upload\.do/i);
});
