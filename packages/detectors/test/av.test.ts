import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioReuseIndex, VideoReuseIndex, detectionToReport } from '../src/index.ts';
import { AbuseSignalExchange, type AbuseTarget } from '../../sentinel/src/index.ts';
import { generateKeyPair, TrustStore } from '../../core/src/index.ts';
import type { PcmAudio, RawImage } from '../../media/src/index.ts';
import { T0 } from './helpers.ts';

const SR = 8000;
function tone(freqs: number[], gain = 0.8): PcmAudio {
  const n = SR * 2;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const f of freqs) v += Math.sin((2 * Math.PI * f * i) / SR);
    s[i] = (v / freqs.length) * gain;
  }
  return { sampleRate: SR, samples: s };
}

function makeImage(size: number, phase: number): RawImage {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, Math.round(128 + 100 * Math.sin((3 * Math.PI * x) / size + phase) * Math.sin((2 * Math.PI * y) / size))));
      const o = (y * size + x) * 4;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  return { width: size, height: size, channels: 4, data };
}
const clip = (n: number, size: number) => Array.from({ length: n }, (_, i) => makeImage(size, i * 0.6));

// A structurally different pattern (not the same wave phase-shifted) for negatives.
function makeOther(size: number, phase: number): RawImage {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, Math.round(128 + 100 * Math.cos((4 * Math.PI * y) / size + phase) * Math.sin((2 * Math.PI * x) / size + 1))));
      const o = (y * size + x) * 4;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  return { width: size, height: size, channels: 4, data };
}
const otherClip = (n: number, size: number) => Array.from({ length: n }, (_, i) => makeOther(size, i * 0.6));

test('audio reuse: a volume-changed copy by another account is detected; own content is not', () => {
  const idx = new AudioReuseIndex().add('song-1', 'alice', tone([440, 554, 659], 0.8));
  const copy = idx.detect({ subjectId: 'post-9', publisherIdentityId: 'bob', audio: tone([440, 554, 659], 0.3) });
  assert.ok(copy.disposition === 'match' || copy.disposition === 'near_match');
  assert.equal(copy.matched, 'song-1');

  const own = idx.detect({ subjectId: 'p', publisherIdentityId: 'alice', audio: tone([440, 554, 659], 0.3) });
  assert.equal(own.disposition, 'no_match');

  const unrelated = idx.detect({ subjectId: 'p', publisherIdentityId: 'bob', audio: tone([311, 740, 1245]) });
  assert.equal(unrelated.disposition, 'no_match');
});

test('video reuse: a resized clip by another account is detected; unrelated is not', () => {
  const idx = new VideoReuseIndex().add('clip-1', 'alice', clip(12, 64));
  const resized = idx.detect({ subjectId: 'post-9', publisherIdentityId: 'bob', frames: clip(12, 40) });
  assert.ok(resized.disposition === 'match' || resized.disposition === 'near_match');
  assert.equal(resized.matched, 'clip-1');

  const other = idx.detect({ subjectId: 'p', publisherIdentityId: 'bob', frames: otherClip(12, 64) });
  assert.equal(other.disposition, 'no_match');
});

test('an audio detection bridges to a signed Sentinel report', () => {
  const idx = new AudioReuseIndex().add('song-1', 'alice', tone([440, 554, 659]));
  const d = idx.detect({ subjectId: 'bob', publisherIdentityId: 'bob', audio: tone([440, 554, 659]) });
  const key = generateKeyPair();
  const reporterTrust = new TrustStore().add(key.keyId, key.publicKeyPem);
  const ex = new AbuseSignalExchange(reporterTrust, new TrustStore(), { quorum: 2 });
  const target: AbuseTarget = { type: 'account', id: 'bob' };
  assert.equal(ex.submit(detectionToReport(d, { reportId: 'r1', reporterIdentityId: 'det-audio', target, reportedAt: T0 }, key)).accepted, true);
  assert.equal(ex.signals(target).categories[0]?.disposition, 'single_source');
});
