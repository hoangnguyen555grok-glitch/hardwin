'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AGENT_SYSTEM_PROMPT,
  sanitizeAgentAction,
  parseAgentOutput
} = require('../lib/ai-agent');

test('agent prompt restricts actions and requires observe/verify after each tool', () => {
  assert.match(AGENT_SYSTEM_PROMPT, /one safe editor action at a time/i);
  assert.match(AGENT_SYSTEM_PROMPT, /wait for the next observation/i);
  assert.match(AGENT_SYSTEM_PROMPT, /deleteSelected is destructive/i);
  assert.match(AGENT_SYSTEM_PROMPT, /Video export remains a manual user action/i);
  assert.match(AGENT_SYSTEM_PROMPT, /exactly one JSON object/i);
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
  assert.throws(() => sanitizeAgentAction({ tool: 'setFrame', args: { frame: -1 } }));
  assert.deepEqual(sanitizeAgentAction({ tool: 'setFrame', args: { frame: 7199 } }), { tool: 'setFrame', args: { frame: 7199 } });
  assert.throws(() => sanitizeAgentAction({ tool: 'setFrame', args: { frame: 7200 } }));
});

test('agent parser accepts a valid JSON response and strips unknown arguments', () => {
  const parsed = parseAgentOutput('{"message":"Tôi sẽ tạo một chuyển động.","action":{"tool":"animateCircle","args":{"durationSeconds":5,"script":"bad"}},"done":false}');
  assert.equal(parsed.formatValid, true);
  assert.deepEqual(parsed.data, {
    message: 'Tôi sẽ tạo một chuyển động.',
    action: { tool: 'animateCircle', args: { durationSeconds: 5 } },
    done: false
  });
});

test('agent parser refuses untrusted/unknown tool requests and malformed output', () => {
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


test('agent memory is optional, user-requested text and limited to 1000 characters', () => {
  const valid = parseAgentOutput(JSON.stringify({
    message: 'Tôi đã ghi nhận tùy chọn này.',
    action: null,
    done: true,
    memory: 'Người dùng thích timeline ở 24 FPS.'
  }));
  assert.equal(valid.formatValid, true);
  assert.equal(valid.data.memory, 'Người dùng thích timeline ở 24 FPS.');

  const tooLong = parseAgentOutput(JSON.stringify({
    message: 'Done',
    action: null,
    done: true,
    memory: 'x'.repeat(1001)
  }));
  assert.equal(tooLong.formatValid, false);
  assert.equal(tooLong.data.action, null);
});
