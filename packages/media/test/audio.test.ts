import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magnitudeSpectrum,
  audioFingerprint,
  audioSimilarity,
  parseWavPcm,
  type PcmAudio,
} from '../src/index.ts';

const SR = 8000;

function tone(freqs: number[], seconds = 2, gain = 0.8): PcmAudio {
  const n = SR * seconds;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const f of freqs) v += Math.sin((2 * Math.PI * f * i) / SR);
    s[i] = (v / freqs.length) * gain;
  }
  return { sampleRate: SR, samples: s };
}

test('FFT magnitude peaks at the bin of a pure sinusoid', () => {
  const N = 1024;
  const f = 500;
  const frame = new Float64Array(N);
  for (let i = 0; i < N; i++) frame[i] = Math.sin((2 * Math.PI * f * i) / SR);
  const mag = magnitudeSpectrum(frame);
  let peak = 0;
  for (let i = 1; i < mag.length; i++) if (mag[i]! > mag[peak]!) peak = i;
  assert.equal(peak, Math.round((f * N) / SR));
});

test('identical audio fingerprints match perfectly', () => {
  const a = tone([440, 554, 659]);
  assert.equal(audioSimilarity(audioFingerprint(a), audioFingerprint(a)), 1);
});

test('a volume change barely affects the fingerprint (sign-of-difference robustness)', () => {
  const base = tone([440, 554, 659], 2, 0.8);
  const quiet = tone([440, 554, 659], 2, 0.3);
  const s = audioSimilarity(audioFingerprint(base), audioFingerprint(quiet));
  assert.ok(s >= 0.95, `expected volume robustness, got ${s}`);
});

test('an added low-level tone (lossy-ish perturbation) stays similar', () => {
  const base = tone([440, 554, 659]);
  const perturbed: PcmAudio = { sampleRate: SR, samples: Float32Array.from(base.samples, (v, i) => v + 0.03 * Math.sin((2 * Math.PI * 37 * i) / SR)) };
  const s = audioSimilarity(audioFingerprint(base), audioFingerprint(perturbed));
  assert.ok(s >= 0.8, `expected perturbation robustness, got ${s}`);
});

test('unrelated audio is clearly distinguishable', () => {
  const a = tone([440, 554, 659]);
  const b = tone([311, 740, 1245]);
  const s = audioSimilarity(audioFingerprint(a), audioFingerprint(b));
  assert.ok(s < 0.7, `expected unrelated audio to differ, got ${s}`);
});

test('parseWavPcm reads a 16-bit PCM WAV', () => {
  // Build a tiny mono 16-bit WAV.
  const n = 16;
  const dataLen = n * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i) * 10000), 44 + i * 2);

  const audio = parseWavPcm(buf);
  assert.equal(audio.sampleRate, SR);
  assert.equal(audio.samples.length, n);
  assert.ok(Math.abs(audio.samples[1]! - Math.sin(1) * 10000 / 32768) < 1e-3);
});
