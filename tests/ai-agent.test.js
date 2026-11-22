'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AGENT_SYSTEM_PROMPT, sanitizeAgentAction, parseAgentOutput } = require('../lib/ai-agent');

test('agent prompt defines tab-only context and a safe batch scene builder', () => {
  assert.match(AGENT_SYSTEM_PROMPT, /current browser tab session/i);
  assert.match(AGENT_SYSTEM_PROMPT, /never emit a memory field/i);
  assert.match(AGENT_SYSTEM_PROMPT, /buildScene/i);
  assert.match(AGENT_SYSTEM_PROMPT, /wait for the next observation/i);
  assert.match(AGENT_SYSTEM_PROMPT, /deleteSelected is destructive/i);
  assert.match(AGENT_SYSTEM_PROMPT, /Video export is a manual user action/i);
  assert.match(AGENT_SYSTEM_PROMPT, /Never output code/i);
});

test('agent action sanitizer accepts only allow-listed safe tools', () => {
  assert.deepEqual(sanitizeAgentAction({ tool: 'inspect' }), { tool: 'inspect', args: {} });
  assert.deepEqual(sanitizeAgentAction({ tool: 'play', args: { extra: true } }), { tool: 'play', args: {} });
  assert.deepEqual(sanitizeAgentAction({ tool: 'setFrame', args: { frame: 24 } }), { tool: 'setFrame', args: { frame: 24 } });
  assert.throws(() => sanitizeAgentAction({ tool: 'runShell', args: { command: 'rm -rf /' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'eval', args: { code: 'alert(1)' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'exportVideo' }));
  assert.throws(() => sanitizeAgentAction({ tool: 'undo' }));
});

test('circle tools enforce numeric, name and color bounds', () => {
  assert.deepEqual(sanitizeAgentAction({
    tool: 'createCircle',
    args: { x: 640, y: 360, radius: 80, color: '#12aBcF', name: 'Blue circle', unexpected: 'ignored' }
  }), {
    tool: 'createCircle',
    args: { x: 640, y: 360, radius: 80, color: '#12aBcF', name: 'Blue circle' }
  });
  assert.throws(() => sanitizeAgentAction({ tool: 'createCircle', args: { x: 2000 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'createCircle', args: { radius: 0 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'createCircle', args: { color: 'red' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'animateCircle', args: { durationSeconds: 121 } }));
});

test('buildScene accepts bounded shape and text layers with keyframe positions', () => {
  const action = sanitizeAgentAction({
    tool: 'buildScene',
    args: {
      durationSeconds: 8,
      elements: [
        { type: 'rect', name: 'Sky', x: 640, y: 360, width: 1280, height: 720, color: '#86c7ff', script: 'ignored' },
        { type: 'circle', name: 'Sun', x: 1050, y: 150, width: 120, height: 120, color: '#ffd166', startY: 210 },
        { type: 'text', name: 'Title', x: 640, y: 110, width: 760, height: 80, text: 'Hello Geed', fontSize: 56, color: '#18324a' }
      ]
    }
  });
  assert.equal(action.tool, 'buildScene');
  assert.equal(action.args.durationSeconds, 8);
  assert.equal(action.args.elements.length, 3);
  assert.deepEqual(action.args.elements[0], {
    type: 'rect', name: 'Sky', x: 640, y: 360, width: 1280, height: 720, color: '#86c7ff'
  });
  assert.equal(action.args.elements[1].startY, 210);
  assert.equal(action.args.elements[2].text, 'Hello Geed');
  assert.equal('script' in action.args.elements[0], false);
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 0, elements: [] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: [{ type: 'image', x: 1, y: 1, width: 10, height: 10 }] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: [{ type: 'text', x: 1, y: 1, width: 10, height: 10 }] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: Array(13).fill({ type: 'rect', x: 1, y: 1, width: 10, height: 10 }) } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: [{ type: 'rect', x: 2000, y: 1, width: 10, height: 10 }] } }));
});

test('agent parser accepts valid JSON and strips unknown properties and memory fields', () => {
  const parsed = parseAgentOutput(JSON.stringify({
    message: 'Tôi sẽ dựng cảnh.',
    action: { tool: 'buildScene', args: { durationSeconds: 4, elements: [
      { type: 'circle', x: 400, y: 300, width: 80, height: 80, color: '#123456', script: 'ignored' }
    ] } },
    done: false,
    memory: 'must never be retained'
  }));
  assert.equal(parsed.formatValid, true);
  assert.equal(parsed.data.action.args.elements[0].script, undefined);
  assert.equal('memory' in parsed.data, false);
});

test('agent parser refuses unknown tools and malformed output', () => {
  const unknown = parseAgentOutput('{"message":"Run code","action":{"tool":"eval","args":{"code":"alert(1)"}},"done":false}');
  assert.equal(unknown.formatValid, false);
  assert.equal(unknown.data.action, null);
  assert.equal(unknown.data.done, true);
  const invalid = parseAgentOutput('not json <script>alert(1)</script>');
  assert.equal(invalid.formatValid, false);
  assert.equal(invalid.data.action, null);
  assert.equal(invalid.data.done, true);
});

test('agent parser rejects finished responses that still contain an action', () => {
  const parsed = parseAgentOutput('{"message":"Done","action":{"tool":"play"},"done":true}');
  assert.equal(parsed.formatValid, false);
  assert.equal(parsed.data.action, null);
});
