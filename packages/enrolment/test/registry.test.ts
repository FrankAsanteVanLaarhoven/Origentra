import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnrolmentRegistry, signConsent, signWithdrawal } from '../src/index.ts';
import { generateKeyPair, type KeyPair } from '../../core/src/index.ts';
import { LocalKeyProvider } from '../../enterprise/src/index.ts';
import { imageFingerprintRaw, type RawImage, type Fingerprint } from '../../media/src/index.ts';
import { ImpersonationIndex } from '../../detectors/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';
let nowStr = T0;
const now = () => nowStr;

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
const faceHash = (phase: number): Fingerprint => imageFingerprintRaw(makeImage(64, phase));

function setup() {
  nowStr = T0;
  const kms = LocalKeyProvider.generate();
  const reg = new EnrolmentRegistry(kms, { now });
  const subjectKey = generateKeyPair();
  return { reg, subjectKey };
}
function consentFor(subjectKey: KeyPair, modalities: ('face' | 'voice' | 'monitoring')[], expiresAt?: string) {
  return signConsent({ subjectId: 'subj-1', modalities, purpose: 'protection', noticeVersion: 'v1', consentedAt: T0, ...(expiresAt ? { expiresAt } : {}) }, subjectKey);
}

test('enrol under active consent makes the reference retrievable; it is transparency-logged', () => {
  const { reg, subjectKey } = setup();
  reg.recordConsent(consentFor(subjectKey, ['face']));
  const { accepted, enrolmentId } = reg.enrol('subj-1', 'face', faceHash(0));
  assert.equal(accepted, true);
  assert.ok(reg.referenceFor(enrolmentId!));
  assert.ok(reg.log.size >= 2, 'consent + enrol logged');
});

test('enrolment without active consent is refused', () => {
  const { reg } = setup();
  const r = reg.enrol('subj-1', 'face', faceHash(0));
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'no_active_consent');
});

test('granular consent: face-only consent does not permit voice enrolment', () => {
  const { reg, subjectKey } = setup();
  reg.recordConsent(consentFor(subjectKey, ['face']));
  assert.equal(reg.enrol('subj-1', 'voice', faceHash(1)).accepted, false);
});

test('withdrawal crypto-shreds the reference and blocks all further use', () => {
  const { reg, subjectKey } = setup();
  reg.recordConsent(consentFor(subjectKey, ['face']));
  const { enrolmentId } = reg.enrol('subj-1', 'face', faceHash(0));
  assert.ok(reg.referenceFor(enrolmentId!));

  const w = reg.withdraw(signWithdrawal({ subjectId: 'subj-1', modalities: ['face'], withdrawnAt: '2026-07-20T00:00:00.000Z' }, subjectKey));
  assert.equal(w.accepted, true);
  assert.equal(w.shredded, 1);
  assert.equal(reg.referenceFor(enrolmentId!), undefined, 'reference no longer retrievable');
  assert.equal(reg.isShredded(enrolmentId!), true, 'ciphertext + wrapped key destroyed');
  assert.equal(reg.hasActiveConsent('subj-1', 'face'), false);
});

test('withdrawal must be signed by the same key that gave consent', () => {
  const { reg, subjectKey } = setup();
  reg.recordConsent(consentFor(subjectKey, ['face']));
  reg.enrol('subj-1', 'face', faceHash(0));
  const attacker = generateKeyPair();
  const w = reg.withdraw(signWithdrawal({ subjectId: 'subj-1', modalities: ['face'], withdrawnAt: T0 }, attacker));
  assert.equal(w.accepted, false);
  assert.equal(w.reason, 'withdrawal_key_mismatch');
});

test('an expired consent yields no reference', () => {
  const { reg, subjectKey } = setup();
  reg.recordConsent(consentFor(subjectKey, ['face'], '2026-07-19T12:00:00.000Z'));
  const { enrolmentId } = reg.enrol('subj-1', 'face', faceHash(0));
  assert.ok(reg.referenceFor(enrolmentId!), 'available before expiry');
  nowStr = '2026-07-20T00:00:00.000Z'; // now past expiry
  assert.equal(reg.referenceFor(enrolmentId!), undefined, 'unavailable after expiry');
});

test('a detector index built from active enrolments drops a withdrawn subject (enrolment-gating)', () => {
  const { reg, subjectKey } = setup();
  reg.recordConsent(consentFor(subjectKey, ['face']));
  reg.enrol('subj-1', 'face', faceHash(0));

  const build = () => {
    const idx = new ImpersonationIndex();
    for (const ref of reg.activeReferences('face')) idx.add({ id: ref.subjectId, names: [ref.subjectId], imageFingerprint: ref.fingerprint });
    return idx;
  };

  // While consented, a look-alike is detected against the enrolled subject.
  const impostor = imageFingerprintRaw(makeImage(48, 0)); // same face, resized
  assert.equal(build().detectLikeness({ subjectId: 'impostor', imageFingerprint: impostor }).disposition, 'near_match');

  // After withdrawal, the subject is not in the index -> no detection can run.
  reg.withdraw(signWithdrawal({ subjectId: 'subj-1', modalities: ['face'], withdrawnAt: T0 }, subjectKey));
  assert.equal(build().detectLikeness({ subjectId: 'impostor', imageFingerprint: impostor }).disposition, 'no_match');
});
