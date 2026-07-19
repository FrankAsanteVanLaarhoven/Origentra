/**
 * Acoustic perceptual fingerprint (Haitsma-Kalker style), zero dependencies.
 *
 * The signal is framed; each frame is windowed and FFT'd; energy is summed into
 * log-spaced sub-bands; a 32-bit sub-fingerprint per frame is derived from the
 * SIGN of energy differences across bands and time. That sign-of-difference
 * construction is what makes it robust to volume changes, EQ and lossy
 * re-encoding. Similarity is 1 − bit-error-rate over aligned frames (with a small
 * offset search for time-shift tolerance).
 *
 * SCOPE (docs/LIMITATIONS.md): this operates on PCM samples. A minimal 16-bit PCM
 * WAV parser is provided; MP3/AAC/Opus decoding is NOT implemented — decode to PCM
 * first. Chromaprint/AcoustID compatibility is not claimed; this is an
 * independent robust hash of the same family.
 */

import { magnitudeSpectrum } from './fft.ts';
import type { Fingerprint } from './perceptual.ts';

export interface PcmAudio {
  sampleRate: number;
  /** Mono samples in [-1, 1]. */
  samples: Float32Array;
}

const ALGO = 'acoustic-hk-v1';
const FRAME = 2048;
const HOP = 512;
const BANDS = 33; // -> 32 bits per frame
const F_MIN = 300;
const F_MAX = 2000;

/** Parse a 16-bit PCM WAV into mono PcmAudio. Throws on unsupported formats. */
export function parseWavPcm(buffer: Buffer): PcmAudio {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('wav: not a RIFF/WAVE file');
  }
  let pos = 12;
  let channels = 1;
  let sampleRate = 44100;
  let bits = 16;
  let dataStart = -1;
  let dataLen = 0;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      const audioFormat = buffer.readUInt16LE(pos + 8);
      channels = buffer.readUInt16LE(pos + 10);
      sampleRate = buffer.readUInt32LE(pos + 12);
      bits = buffer.readUInt16LE(pos + 22);
      if (audioFormat !== 1) throw new Error('wav: only PCM (format 1) supported');
      if (bits !== 16) throw new Error('wav: only 16-bit PCM supported');
    } else if (id === 'data') {
      dataStart = pos + 8;
      dataLen = size;
    }
    pos += 8 + size + (size & 1);
  }
  if (dataStart < 0) throw new Error('wav: no data chunk');

  const frames = Math.floor(dataLen / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) acc += buffer.readInt16LE(dataStart + (i * channels + c) * 2);
    samples[i] = acc / channels / 32768;
  }
  return { sampleRate, samples };
}

function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

function bandEdges(sampleRate: number): number[] {
  const edges: number[] = [];
  for (let m = 0; m <= BANDS; m++) {
    const f = F_MIN * Math.pow(F_MAX / F_MIN, m / BANDS);
    edges.push(Math.min(FRAME >> 1, Math.max(0, Math.round((f * FRAME) / sampleRate))));
  }
  return edges;
}

export function audioFingerprint(audio: PcmAudio): Fingerprint {
  const { samples, sampleRate } = audio;
  const win = hann(FRAME);
  const edges = bandEdges(sampleRate);
  const bits: number[] = [];
  let prevE: Float64Array | null = null;

  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    const frame = new Float64Array(FRAME);
    for (let i = 0; i < FRAME; i++) frame[i] = (samples[start + i] ?? 0) * win[i]!;
    const mag = magnitudeSpectrum(frame);
    const E = new Float64Array(BANDS);
    for (let m = 0; m < BANDS; m++) {
      let e = 0;
      for (let b = edges[m]!; b < edges[m + 1]!; b++) e += mag[b]! * mag[b]!;
      E[m] = e;
    }
    if (prevE) {
      let word = 0;
      for (let m = 0; m < 32; m++) {
        const d = E[m]! - E[m + 1]! - (prevE[m]! - prevE[m + 1]!);
        if (d > 0) word |= 1 << m;
      }
      bits.push(word >>> 0);
    }
    prevE = E;
  }

  const value = bits.map((w) => (w >>> 0).toString(16).padStart(8, '0')).join('');
  return { algo: ALGO, value };
}

function toWords(fp: Fingerprint): number[] {
  const words: number[] = [];
  for (let i = 0; i + 8 <= fp.value.length; i += 8) words.push(parseInt(fp.value.slice(i, i + 8), 16) >>> 0);
  return words;
}

function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

/** Similarity in [0,1] = 1 − min bit-error-rate over a small time-offset search. */
export function audioSimilarity(a: Fingerprint, b: Fingerprint, maxOffset = 4): number {
  if (a.algo !== b.algo) return 0;
  const wa = toWords(a);
  const wb = toWords(b);
  if (wa.length === 0 || wb.length === 0) return 0;
  let bestBer = 1;
  for (let off = -maxOffset; off <= maxOffset; off++) {
    let bitErrors = 0;
    let compared = 0;
    for (let i = 0; i < wa.length; i++) {
      const j = i + off;
      if (j < 0 || j >= wb.length) continue;
      bitErrors += popcount((wa[i]! ^ wb[j]!) >>> 0);
      compared += 32;
    }
    if (compared > 0) bestBer = Math.min(bestBer, bitErrors / compared);
  }
  return 1 - bestBer;
}

export { ALGO as AUDIO_ALGO };
