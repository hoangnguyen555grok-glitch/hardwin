const DEFAULT_GIFENC_URL = 'https://esm.sh/gifenc@1.0.3';
const MAX_PALETTE_SAMPLE_PIXELS = 100_000;

function buildPaletteSample(frames) {
  const pixelsPerFrame = frames[0].length / 4;
  const totalPixels = pixelsPerFrame * frames.length;
  const sampleBudget = Math.min(totalPixels, MAX_PALETTE_SAMPLE_PIXELS);
  const sample = new Uint8Array(sampleBudget * 4);
  let offset = 0;

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const remainingFrames = frames.length - frameIndex;
    const remainingSamples = sampleBudget - offset / 4;
    const count = Math.min(pixelsPerFrame, Math.ceil(remainingSamples / remainingFrames));
    const frame = frames[frameIndex];

    for (let sampleIndex = 0; sampleIndex < count && offset < sample.length; sampleIndex++) {
      const pixelIndex = Math.min(pixelsPerFrame - 1, Math.floor(sampleIndex * pixelsPerFrame / count));
      const sourceOffset = pixelIndex * 4;
      sample[offset++] = frame[sourceOffset];
      sample[offset++] = frame[sourceOffset + 1];
      sample[offset++] = frame[sourceOffset + 2];
      sample[offset++] = frame[sourceOffset + 3];
    }
  }

  return offset === sample.length ? sample : sample.subarray(0, offset);
}

/**
 * Encodes rendered RGBA frames with the community gifenc library.
 * The dependency is loaded only when a user exports a GIF. If the CDN is
 * unavailable, the caller can fall back to Geed Hardwin's offline encoder.
 *
 * @param {{width:number,height:number,frames:Array<Uint8Array|Uint8ClampedArray>,delayCs?:number,quality?:string}} options
 * @param {() => Promise<object>} loadLibrary Test seam; defaults to the pinned community package.
 * @returns {Promise<Blob>}
 */
export async function encodeGifWithCommunity(options, loadLibrary = () => import(DEFAULT_GIFENC_URL)) {
  const { width, height, frames, delayCs = 8, quality = 'balanced' } = options || {};

  if (!Number.isInteger(width) || width < 1 || width > 65535 ||
      !Number.isInteger(height) || height < 1 || height > 65535) {
    throw new TypeError('GIF width and height must be positive integers within the GIF format limit');
  }
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new TypeError('GIF export requires at least one frame');
  }

  const expectedBytes = width * height * 4;
  for (const frame of frames) {
    if (!(frame instanceof Uint8Array || frame instanceof Uint8ClampedArray) || frame.byteLength !== expectedBytes) {
      throw new TypeError('GIF frame data must be RGBA pixels with matching dimensions');
    }
  }

  const { GIFEncoder, quantize, applyPalette } = await loadLibrary();
  if (typeof GIFEncoder !== 'function' || typeof quantize !== 'function' || typeof applyPalette !== 'function') {
    throw new TypeError('The community GIF encoder did not expose the expected API');
  }

  const compact = quality === 'compact';
  const colorFormat = compact ? 'rgb444' : 'rgb565';
  const maxColors = compact ? 128 : 256;
  const palette = quantize(buildPaletteSample(frames), maxColors, { format: colorFormat });
  if (!Array.isArray(palette) || palette.length < 2) {
    throw new Error('The community GIF encoder could not create a color palette');
  }

  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round(Number(delayCs) * 10) || 20);
  for (let index = 0; index < frames.length; index++) {
    const indexed = applyPalette(frames[index], palette, colorFormat);
    gif.writeFrame(indexed, width, height, index === 0
      ? { palette, delay, repeat: 0 }
      : { delay });
  }
  gif.finish();

  const bytes = gif.bytes();
  if (!(bytes instanceof Uint8Array) || bytes.length < 14) {
    throw new Error('The community GIF encoder returned an invalid GIF stream');
  }
  return new Blob([bytes], { type: 'image/gif' });
}
