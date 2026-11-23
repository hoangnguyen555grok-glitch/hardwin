'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'materials.html'), 'utf8');
const library = fs.readFileSync(path.join(root, 'lib/material-library.js'), 'utf8');

test('personal material cards offer Edit handoff for image, texture and audio assets', () => {
  assert.match(page, /id="materialsGrid"/);
  assert.match(library, /function supportsEditor\(item\)/);
  assert.match(library, /"Hình ảnh", "Texture", "Âm thanh", "Nhạc", "Giọng đọc", "Hiệu ứng âm thanh"/);
  assert.match(library, /"Dùng trong Edit"/);
  assert.match(library, /use\.disabled = !\(item\.previewUrl \|\| item\.fileUrl\)/);
});

test('personal handoff stores only the material ID, not a temporary signed file URL', () => {
  assert.match(library, /sessionStorage\.setItem\("geedPrivateMaterialHandoff", String\(item\.id\)\)/);
  assert.doesNotMatch(library, /sessionStorage\.setItem\("geedPrivateMaterialHandoff",\s*item\.(?:previewUrl|fileUrl)/);
  assert.match(editor, /sessionStorage\.getItem\('geedPrivateMaterialHandoff'\)/);
  assert.match(editor, /await fetchPrivateMaterials\(\)/);
});

test('editor rechecks private material access with the signed-in Supabase access token', () => {
  assert.match(editor, /window\.GeedHardwinAuth\?\.getAccessToken\?\.\(\)/);
  assert.match(editor, /fetch\('\/api\/materials',\{headers:\{authorization:'Bearer '\+token\},cache:'no-store'\}\)/);
  assert.match(editor, /materials\.find\(entry=>entry&&entry\.id===materialId\)/);
});

test('personal images enter both the stage and reusable project resource library', () => {
  assert.match(editor, /resource=\{id:localAssetId,name,dataUrl:url,externalUrl:url,privateMaterialId:materialId/);
  assert.match(editor, /makeObject\('image'.*privateMaterialId:materialId/);
  assert.match(editor, /privateMaterialId:asset\.privateMaterialId\|\|undefined/);
  assert.match(editor, /makeObject\('audio'.*privateMaterialId:materialId/);
});

test('Notion temporary URLs are refreshed for saved personal material references', () => {
  assert.match(editor, /async function refreshSavedPrivateMaterialUrls/);
  assert.match(editor, /resourceLibrary\.images\|\|[\s\S]*privateMaterialId/);
  assert.match(editor, /for\(const sc of scenes\)[\s\S]*privateMaterialId/);
  assert.match(editor, /for\(const definition of symbolLibrary\)[\s\S]*privateMaterialId/);
  assert.match(editor, /await refreshSavedPrivateMaterialUrls\(\)/);
  assert.match(editor, /autosaveRestorePromise=restoreAutosave\(\)/);
});

test('editor inline JavaScript remains syntactically valid', () => {
  const match = editor.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match, 'editor inline script should exist');
  assert.doesNotThrow(() => new vm.Script(match[1], { filename: 'index.html inline script' }));
});

test('private library handoff does not upload or copy source files into GitHub or R2', () => {
  assert.doesNotMatch(library, /FileReader|localStorage|indexedDB|R2/);
  assert.match(editor, /tệp không được tải lên Geed Hardwin/);
});
