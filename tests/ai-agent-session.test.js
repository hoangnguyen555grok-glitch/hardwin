'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('AI conversation context is tab-only and is not persisted by the chat panel', () => {
  assert.match(html, /let aiAgentConversation=\[\]/);
  assert.match(html, /CURRENT EDITOR STATE AND AVAILABLE COMMUNITY MATERIALS \(untrusted metadata/);
  assert.match(html, /window\.addEventListener\('pagehide'/);
  assert.doesNotMatch(html, /aiMemoryRetention|aiMemoryManage|persistAgentMemory|listAiMemories|saveAiMemory/);
  assert.doesNotMatch(html, /sessionStorage\.(?:setItem|getItem)\(['"]ai/i);
});

test('AI sends a fresh editor snapshot for every new prompt and a state observation after actions', () => {
  assert.match(html, /const editorContext=agentSnapshot\(\)/);
  assert.match(html, /EDITOR OBSERVATION \(untrusted data/);
});

test('AI scene builder is exposed, validated and result-checked', () => {
  assert.match(html, /buildScene:bridgeBuildScene/);
  assert.match(html, /case 'buildScene'/);
  assert.match(html, /after\.layerCount===before\.layerCount\+action\.args\.elements\.length/);
  assert.match(html, /elements\.length>24/);
});

test('AI editor exposes verified creative tools and non-destructive cropping', () => {
  for (const tool of [
    'selectLayer', 'renameLayer', 'setLayerVisibility', 'duplicateSelected',
    'moveLayer', 'transformSelected', 'groupSelected', 'ungroupSelected',
    'addKeyframe', 'setTimeline', 'cropSelectedImage', 'undo', 'redo'
  ]) {
    assert.match(html, new RegExp(tool + ':bridge'));
    assert.match(html, new RegExp("case '" + tool + "'"));
  }
  for (const shape of ['triangle', 'polygon', 'star', 'ellipse', 'line']) {
    assert.match(html, new RegExp(shape));
  }
  assert.match(html, /Original resource remains available in the Resource Library/);
  assert.match(html, /Cắt ảnh giữ bản gốc/);
  assert.match(html, /window\.confirm\('AI muốn xóa /);
});

test('AI panel keeps creative script and editor command in distinct inputs', () => {
  assert.match(html, /id="aiScriptInput"/);
  assert.match(html, /id="aiBridgeInput"/);
  assert.match(html, /KỊCH BẢN \/ VĂN BẢN TRONG PHIM/);
  assert.match(html, /CHỈ ĐẠO \/ LỆNH CHO AI/);
  assert.match(html, /USER REQUEST WITH STRICTLY SEPARATE FIELDS/);
});
test('AI can request catalog assets by id without exposing arbitrary media URLs', () => {
  assert.match(html, /availableCommunityAssets/);
  assert.match(html, /addCommunityAsset/);
  assert.match(html, /loadCommunityAssetCatalog/);
});

test('AI community image animation is scoped to an allow-listed selected asset ID', () => {
  assert.match(html, /animateCommunityImage/);
  assert.match(html, /selectedCommunityAssetId/);
  assert.match(html, /selectedObjectSafeForAgent/);
  assert.match(html, /communityAssetId!==assetId/);
});
