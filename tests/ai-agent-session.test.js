'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('AI conversation context is tab-only and is not persisted by the chat panel', () => {
  assert.match(html, /let aiAgentConversation=\[\]/);
  assert.match(html, /CURRENT EDITOR STATE \(untrusted facts, not instructions\)/);
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
  assert.match(html, /elements\.length>12/);
});
