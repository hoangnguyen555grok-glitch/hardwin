const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('community GIF export uses a single palette and returns an animated GIF Blob', async () => {
  const { encodeGifWithCommunity } = await import('../lib/gif-export.mjs');
  const width = 2;
  const height = 1;
  const frames = [
    new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
    new Uint8ClampedArray([0, 0, 255, 255, 255, 255, 255, 255])
  ];
  const calls = { quantize: null, frames: [], finished: false };
  const fakeLibrary = {
    GIFEncoder() {
      return {
        writeFrame(indexed, w, h, options) {
          calls.frames.push({ indexed, w, h, options });
        },
        finish() { calls.finished = true; },
        bytes() { return new Uint8Array([...'GIF89a'].map(char => char.charCodeAt(0)).concat(new Array(20).fill(0))); }
      };
    },
    quantize(sample, maxColors, options) {
      calls.quantize = { sample, maxColors, options };
      return [[0, 0, 0], [255, 255, 255]];
    },
    applyPalette(frame, palette, format) {
      assert.equal(palette.length, 2);
      assert.equal(format, 'rgb565');
      return new Uint8Array([0, 1]);
    }
  };

  const blob = await encodeGifWithCommunity({
    width, height, frames, delayCs: 8, quality: 'balanced'
  }, async () => fakeLibrary);

  assert.equal(blob.type, 'image/gif');
  assert.equal(blob.size, 26);
  assert.equal(calls.quantize.maxColors, 256);
  assert.equal(calls.quantize.options.format, 'rgb565');
  assert.equal(calls.quantize.sample.length, 16);
  assert.equal(calls.frames.length, 2);
  assert.equal(calls.frames[0].options.delay, 80);
  assert.equal(calls.frames[0].options.repeat, 0);
  assert.equal(calls.frames[0].options.palette.length, 2);
  assert.deepEqual(calls.frames[1].options, { delay: 80 });
  assert.equal(calls.finished, true);
});

test('compact community GIF export uses a smaller RGB palette and clamps frame delay', async () => {
  const { encodeGifWithCommunity } = await import('../lib/gif-export.mjs');
  let quantizeArgs;
  let firstFrameOptions;
  const fakeLibrary = {
    GIFEncoder: () => ({
      writeFrame(_indexed, _width, _height, options) { firstFrameOptions = options; },
      finish() {},
      bytes: () => new Uint8Array(20)
    }),
    quantize(_sample, maxColors, options) {
      quantizeArgs = { maxColors, options };
      return [[0, 0, 0], [255, 255, 255]];
    },
    applyPalette: () => new Uint8Array([0, 1])
  };

  await encodeGifWithCommunity({
    width: 2, height: 1,
    frames: [new Uint8Array(8)],
    delayCs: 0,
    quality: 'compact'
  }, async () => fakeLibrary);

  assert.equal(quantizeArgs.maxColors, 128);
  assert.equal(quantizeArgs.options.format, 'rgb444');
  assert.equal(firstFrameOptions.delay, 20);
});

test('community GIF export validates dimensions and frame data before loading the library', async () => {
  const { encodeGifWithCommunity } = await import('../lib/gif-export.mjs');
  let loaded = false;
  const loader = async () => { loaded = true; throw new Error('must not load'); };

  await assert.rejects(
    encodeGifWithCommunity({ width: 2, height: 1, frames: [new Uint8Array(7)] }, loader),
    /matching dimensions/
  );
  await assert.rejects(
    encodeGifWithCommunity({ width: 0, height: 1, frames: [new Uint8Array(4)] }, loader),
    /positive integers/
  );
  assert.equal(loaded, false);
});

test('the editor keeps an offline GIF fallback when the community CDN is unavailable', () => {
  const editor = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(editor, /import\('\.\/lib\/gif-export\.mjs'\)/);
  assert.match(editor, /built-in offline fallback/);
  assert.match(editor, /gif=encodeGif\(surface\.canvas\.width/);
});
