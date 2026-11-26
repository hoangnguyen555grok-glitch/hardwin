import test from "node:test";
import assert from "node:assert/strict";
import { pcm16ToWav } from "../lib/audio-workspace.js";

test("wraps mono PCM16 bytes in a valid 48 kHz WAV header", async () => {
  const pcm = new Uint8Array([0, 0, 255, 127, 1, 128, 0, 0]);
  const blob = pcm16ToWav(pcm, 48000);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);

  assert.equal(blob.type, "audio/wav");
  assert.equal(bytes.length, 44 + pcm.length);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...bytes.slice(8, 12)), "WAVE");
  assert.equal(String.fromCharCode(...bytes.slice(36, 40)), "data");
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), pcm.length);
  assert.deepEqual(bytes.slice(44), pcm);
});

test("rejects invalid PCM and sample rates", () => {
  assert.throws(() => pcm16ToWav(new Uint8Array()), /PCM16/);
  assert.throws(() => pcm16ToWav(new Uint8Array([1])), /PCM16/);
  assert.throws(() => pcm16ToWav(new Uint8Array([1, 2]), 0), /Tần số/);
});
