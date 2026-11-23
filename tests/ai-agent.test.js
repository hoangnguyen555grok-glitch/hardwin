'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AGENT_SYSTEM_PROMPT, sanitizeAgentAction, parseAgentOutput } = require('../lib/ai-agent');

test('agent prompt defines tab-only context and a safe batch scene builder', () => {
  assert.match(AGENT_SYSTEM_PROMPT, /current browser tab session/i);
  assert.match(AGENT_SYSTEM_PROMPT, /never emit a memory field/i);
  assert.match(AGENT_SYSTEM_PROMPT, /buildScene/i);
  assert.match(AGENT_SYSTEM_PROMPT, /FABRIK inverse-kinematics solver/i);
  assert.match(AGENT_SYSTEM_PROMPT, /createBone/i);
  assert.match(AGENT_SYSTEM_PROMPT, /solveBoneIK/i);
  assert.match(AGENT_SYSTEM_PROMPT, /wait for the next observation/i);
  assert.match(AGENT_SYSTEM_PROMPT, /deleteSelected is destructive/i);
  assert.match(AGENT_SYSTEM_PROMPT, /Never use deleteSelected when the user asks to crop, trim, clip or cut an image/i);
  assert.match(AGENT_SYSTEM_PROMPT, /cropSelectedImage is a non-destructive image edit/i);
  assert.match(AGENT_SYSTEM_PROMPT, /Video export is a manual user action/i);
  assert.match(AGENT_SYSTEM_PROMPT, /setSelectedProperties/);
  assert.match(AGENT_SYSTEM_PROMPT, /manageScene/);
  assert.match(AGENT_SYSTEM_PROMPT, /privateMaterials/);
  assert.match(AGENT_SYSTEM_PROMPT, /Video and font materials remain preview-only/);
  assert.match(AGENT_SYSTEM_PROMPT, /Never output code/i);
});

test('agent action sanitizer accepts only allow-listed safe tools', () => {
  assert.deepEqual(sanitizeAgentAction({ tool: 'inspect' }), { tool: 'inspect', args: {} });
  assert.deepEqual(sanitizeAgentAction({ tool: 'play', args: { extra: true } }), { tool: 'play', args: {} });
  assert.deepEqual(sanitizeAgentAction({ tool: 'setFrame', args: { frame: 24 } }), { tool: 'setFrame', args: { frame: 24 } });
  assert.throws(() => sanitizeAgentAction({ tool: 'runShell', args: { command: 'rm -rf /' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'eval', args: { code: 'alert(1)' } }));
  assert.deepEqual(sanitizeAgentAction({tool:'setSelectedProperties',args:{x:640,rotation:15,color:'#abcdef',text:'Hello',blendMode:'multiply',unknown:'drop'}}),{tool:'setSelectedProperties',args:{x:640,rotation:15,color:'#abcdef',text:'Hello',blendMode:'multiply'}});
  assert.throws(()=>sanitizeAgentAction({tool:'setSelectedProperties',args:{opacity:2}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setSelectedProperties',args:{blendMode:'javascript'}}));
  assert.deepEqual(sanitizeAgentAction({tool:'setCamera',args:{x:20,zoom:1.5,addKey:true}}),{tool:'setCamera',args:{x:20,zoom:1.5,addKey:true}});
  assert.throws(()=>sanitizeAgentAction({tool:'setCamera',args:{zoom:0}}));
  assert.deepEqual(sanitizeAgentAction({tool:'manageScene',args:{operation:'rename',sceneIndex:0,name:'Opening'}}),{tool:'manageScene',args:{operation:'rename',sceneIndex:0,name:'Opening'}});
  assert.throws(()=>sanitizeAgentAction({tool:'manageScene',args:{operation:'delete'}}));
  assert.deepEqual(sanitizeAgentAction({tool:'setWorkArea',args:{start:12,end:80}}),{tool:'setWorkArea',args:{start:12,end:80}});
  assert.deepEqual(sanitizeAgentAction({tool:'setWorkArea',args:{clear:true}}),{tool:'setWorkArea',args:{clear:true}});
  assert.deepEqual(sanitizeAgentAction({tool:'setExposure',args:{operation:'split'}}),{tool:'setExposure',args:{operation:'split'}});
  assert.deepEqual(sanitizeAgentAction({tool:'addPrivateMaterial',args:{materialId:'123e4567-e89b-12d3-a456-426614174000',url:'https://evil.example'}}),{tool:'addPrivateMaterial',args:{materialId:'123e4567-e89b-12d3-a456-426614174000'}});
  assert.throws(()=>sanitizeAgentAction({tool:'addPrivateMaterial',args:{materialId:'../../secret'}}));
  assert.deepEqual(sanitizeAgentAction({tool:'exportVideoPreview',args:{ignored:true}}),{tool:'exportVideoPreview',args:{}});
  assert.throws(() => sanitizeAgentAction({ tool: 'exportVideo' }));
  assert.deepEqual(sanitizeAgentAction({ tool: 'undo' }), { tool: 'undo', args: {} });
  assert.deepEqual(sanitizeAgentAction({ tool: 'redo' }), { tool: 'redo', args: {} });
  assert.deepEqual(sanitizeAgentAction({ tool: 'cropSelectedImage', args: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 } }), { tool: 'cropSelectedImage', args: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 } });
  assert.deepEqual(sanitizeAgentAction({ tool: 'renameLayer', args: { name: 'Sky layer' } }), { tool: 'renameLayer', args: { name: 'Sky layer' } });
  assert.deepEqual(sanitizeAgentAction({ tool: 'setLayerVisibility', args: { visible: false } }), { tool: 'setLayerVisibility', args: { visible: false } });
  assert.deepEqual(sanitizeAgentAction({ tool: 'moveLayer', args: { direction: 'front' } }), { tool: 'moveLayer', args: { direction: 'front' } });
  assert.throws(() => sanitizeAgentAction({ tool: 'cropSelectedImage', args: { left: -0.1, top: 0, width: 0.8, height: 0.8 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'cropSelectedImage', args: { left: 0, top: 0, width: 1, height: 1 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'moveLayer', args: { direction: 'sideways' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'transformSelected', args: { opacity: 2 } }));
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
        { type: 'triangle', x: 640, y: 400, width: 220, height: 180, color: '#23aa44' },
        { type: 'polygon', x: 400, y: 300, width: 90, height: 90, sides: 7 },
        { type: 'star', x: 800, y: 200, width: 70, height: 70, innerRatio: 0.4 },
        { type: 'ellipse', x: 500, y: 500, width: 180, height: 80 },
        { type: 'line', x: 100, y: 100, width: 180, height: 180 },
        { type: 'text', name: 'Title', x: 640, y: 110, width: 760, height: 80, text: 'Hello Geed', fontSize: 56, color: '#18324a' }
      ]
    }
  });
  assert.equal(action.tool, 'buildScene');
  assert.equal(action.args.durationSeconds, 8);
  assert.equal(action.args.elements.length, 8);
  assert.equal(action.args.elements[2].type, 'triangle');
  assert.equal(action.args.elements[3].sides, 7);
  assert.equal(action.args.elements[4].innerRatio, 0.4);
  assert.deepEqual(action.args.elements[0], {
    type: 'rect', name: 'Sky', x: 640, y: 360, width: 1280, height: 720, color: '#86c7ff'
  });
  assert.equal(action.args.elements[1].startY, 210);
  assert.equal(action.args.elements[7].text, 'Hello Geed');
  assert.equal('script' in action.args.elements[0], false);
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 0, elements: [] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 1.5, elements: [{ type: 'triangle', x: 100, y: 100, width: 60, height: 60 }] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'setTimeline', args: { durationSeconds: 2.5 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'setFrame', args: { frame: 2.5 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: [{ type: 'image', x: 1, y: 1, width: 10, height: 10 }] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: [{ type: 'text', x: 1, y: 1, width: 10, height: 10 }] } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: Array(25).fill({ type: 'rect', x: 1, y: 1, width: 10, height: 10 }) } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'buildScene', args: { durationSeconds: 8, elements: [{ type: 'polygon', x: 1, y: 1, width: 10, height: 10, sides: 4.5 }] } }));
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

test('community asset action accepts only a bounded catalog asset id and never a URL', () => {
  assert.deepEqual(sanitizeAgentAction({
    tool: 'addCommunityAsset',
    args: { assetId: 'forest-dawn-bg', url: 'https://evil.example/file.png', extra: true }
  }), {
    tool: 'addCommunityAsset',
    args: { assetId: 'forest-dawn-bg' }
  });
  assert.throws(() => sanitizeAgentAction({ tool: 'addCommunityAsset', args: { assetId: 'javascript:alert(1)' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'addCommunityAsset', args: { assetId: '../private' } }));
});

test('community image animation is bounded and requires a catalog asset id', () => {
  assert.deepEqual(sanitizeAgentAction({
    tool: 'animateCommunityImage',
    args: { assetId: 'forest-dawn-bg', durationSeconds: 6, toX: 920, toY: 280, rotation: 12, scale: 1.2, opacity: 0.9, url: 'https://evil.example/x.png' }
  }), {
    tool: 'animateCommunityImage',
    args: { assetId: 'forest-dawn-bg', durationSeconds: 6, toX: 920, toY: 280, rotation: 12, scale: 1.2, opacity: 0.9 }
  });
  assert.throws(() => sanitizeAgentAction({ tool: 'animateCommunityImage', args: { assetId: '../x', durationSeconds: 6, toX: 20, toY: 20 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'animateCommunityImage', args: { assetId: 'forest-dawn-bg', durationSeconds: 61, toX: 20, toY: 20 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'animateCommunityImage', args: { assetId: 'forest-dawn-bg', durationSeconds: 6, toX: 1400, toY: 20 } }));
});

test('AI composition tools validate multi-selection, resource IDs and mask stacks', () => {
  assert.deepEqual(sanitizeAgentAction({tool:'selectLayers',args:{layerIds:['layer-a','layer-b'],ignored:true}}),{tool:'selectLayers',args:{layerIds:['layer-a','layer-b']}});
  assert.throws(()=>sanitizeAgentAction({tool:'selectLayers',args:{layerIds:['same','same']}}));
  assert.throws(()=>sanitizeAgentAction({tool:'selectLayers',args:{layerIds:['only-one']}}));
  assert.deepEqual(sanitizeAgentAction({tool:'addImageResource',args:{assetId:'img-local_01',url:'https://evil.example'}}),{tool:'addImageResource',args:{assetId:'img-local_01'}});
  assert.throws(()=>sanitizeAgentAction({tool:'addImageResource',args:{assetId:'../private'}}));
  assert.deepEqual(sanitizeAgentAction({tool:'setLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape',mode:'luma',extra:true}}),{tool:'setLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape',mode:'luma'}});
  assert.deepEqual(sanitizeAgentAction({tool:'setLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape'}}),{tool:'setLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape',mode:'alpha'}});
  assert.throws(()=>sanitizeAgentAction({tool:'setLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape',mode:'script'}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-photo'}}));
  assert.deepEqual(sanitizeAgentAction({tool:'removeLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape'}}),{tool:'removeLayerMask',args:{targetLayerId:'layer-photo',maskLayerId:'layer-shape'}});
});

test('AI rigging tools validate existing bone IDs, stage bounds and rotations', () => {
  assert.deepEqual(sanitizeAgentAction({
    tool: 'createBone',
    args: { name: 'Right arm', x: 420, y: 280, length: 120, rotation: -35, parentId: 'bone-root', ignored: true }
  }), {
    tool: 'createBone',
    args: { name: 'Right arm', x: 420, y: 280, length: 120, rotation: -35, parentId: 'bone-root' }
  });
  assert.deepEqual(sanitizeAgentAction({
    tool: 'rotateBone', args: { boneId: 'bone-arm', rotation: 75, extra: 'ignored' }
  }), { tool: 'rotateBone', args: { boneId: 'bone-arm', rotation: 75 } });
  assert.deepEqual(sanitizeAgentAction({
    tool: 'solveBoneIK', args: { boneId: 'bone-hand', targetX: 900, targetY: 540 }
  }), { tool: 'solveBoneIK', args: { boneId: 'bone-hand', targetX: 900, targetY: 540 } });
  assert.throws(() => sanitizeAgentAction({ tool: 'createBone', args: { x: 640, y: 360, length: 4 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'createBone', args: { x: 640, y: 360, length: 900 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'createBone', args: { x: 1281, y: 360, length: 80 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'createBone', args: { x: 640, y: 360, length: 80, parentId: '../private' } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'rotateBone', args: { boneId: 'bone-arm', rotation: 721 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'solveBoneIK', args: { boneId: 'bone-hand', targetX: -1, targetY: 540 } }));
  assert.throws(() => sanitizeAgentAction({ tool: 'solveBoneIK', args: { boneId: 'bone-hand', targetX: 900, targetY: 721 } }));
});


test('AI playback and onion-skin controls accept bounded settings only', () => {
  assert.deepEqual(sanitizeAgentAction({tool:'setPlaybackOptions',args:{
    loopPlayback:false,frameByFrame:true,onionSkin:true,onionSelectedOnly:true,
    onionPrevCount:3,onionNextCount:2,onionPrevOpacity:25,onionNextOpacity:15,ignored:'drop'
  }}),{tool:'setPlaybackOptions',args:{
    loopPlayback:false,frameByFrame:true,onionSkin:true,onionSelectedOnly:true,
    onionPrevCount:3,onionNextCount:2,onionPrevOpacity:25,onionNextOpacity:15
  }});
  assert.deepEqual(sanitizeAgentAction({tool:'setPlaybackOptions',args:{loopPlayback:true}}),{tool:'setPlaybackOptions',args:{loopPlayback:true}});
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{loopPlayback:'false'}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{onionPrevCount:6}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{onionNextCount:-1}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{onionPrevOpacity:4}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{onionNextOpacity:51}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{onionSkin:true,onionPrevCount:1.5}}));
  assert.throws(()=>sanitizeAgentAction({tool:'setPlaybackOptions',args:{}}));
});
