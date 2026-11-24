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
  assert.match(html, /original resource remains available in the Resource Library/i);
  assert.match(html, /Cắt ảnh giữ bản gốc/);
  assert.match(html, /window\.confirm\('AI muốn xóa /);
});

test('AI chat favors readable replies with compact input and fewer quick prompts', () => {
  assert.match(html, /width:min\(560px,calc\(100vw - 32px\)\)/);
  assert.match(html, /font-size:14px;line-height:1\.6/);
  assert.match(html, /grid-template-columns:1fr 1fr/);
  assert.match(html, /min-height:42px;max-height:96px/);
  assert.match(html, /rows="2" placeholder="Lời thoại hoặc chữ xuất hiện trong phim/);
  assert.match(html, /rows="2" placeholder="Bạn muốn AI làm gì/);
  assert.equal((html.match(/data-ai-prompt=/g)||[]).length, 3);
  assert.match(html, /aria-label="Gợi ý nhanh"/);
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


test('finished video preview records the complete project with its audio tracks', () => {
  assert.match(html, /id="openVideoPreview"/);
  assert.match(html, /id="videoPreviewDialog"/);
  assert.match(html, /<video id="finishedVideo" controls playsinline/);
  assert.match(html, /async function exportVideo\(previewMode=false\)/);
  assert.match(html, /audioTracks\.length/);
  assert.match(html, /previewMode\)showFinishedVideoPreview\(blob,filename,audioTracks\.length\)/);
  assert.match(html, /\$\('openVideoPreview'\)\.onclick=\(\)=>exportVideo\(true\)/);
});

test('cloud export sends authenticated MP4 or WebM renders through R2 to Runway, then cleans up', () => {
  assert.ok(html.includes("fetch('/api/media/upload-url'"));
  assert.match(html, /purpose:'final'/);
  assert.match(html, /method:'PUT',headers:\{'content-type':contentType\},body:finishedPreviewBlob/);
  assert.match(html, /id="uploadFinishedVideo"[^>]*disabled/);
  assert.match(html, /R2 chưa sẵn sàng/);
  assert.ok(html.includes("fetch('/api/media/send-to-runway'"));
  assert.match(html, /action:'cleanup'/);
  assert.match(html, /Runway đã nhận video thành công/);
});
