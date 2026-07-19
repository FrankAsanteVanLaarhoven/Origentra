import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signConsent,
  verifyConsent,
  signWithdrawal,
  verifyWithdrawal,
  consentCoversModality,
  type EnrolmentConsent,
} from '../src/index.ts';
import { generateKeyPair } from '../../core/src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';

function fields(): Omit<EnrolmentConsent, 'signer' | 'signature'> {
  return { subjectId: 'subj-1', modalities: ['face', 'voice'], purpose: 'impersonation protection', noticeVersion: 'v1', consentedAt: T0 };
}

test('consent signs and verifies; tampering fails', () => {
  const key = generateKeyPair();
  const consent = signConsent(fields(), key);
  assert.equal(verifyConsent(consent), true);
  assert.equal(verifyConsent({ ...consent, modalities: ['face', 'voice', 'monitoring'] }), false);
});

test('consent requires at least one modality and a notice version', () => {
  const key = generateKeyPair();
  assert.throws(() => signConsent({ ...fields(), modalities: [] }, key), /modality/);
  assert.throws(() => signConsent({ ...fields(), noticeVersion: '' }, key), /noticeVersion/);
});

test('withdrawal signs and verifies', () => {
  const key = generateKeyPair();
  const w = signWithdrawal({ subjectId: 'subj-1', modalities: ['face'], withdrawnAt: T0 }, key);
  assert.equal(verifyWithdrawal(w), true);
});

test('consentCoversModality respects scope and expiry', () => {
  const key = generateKeyPair();
  const consent = signConsent({ ...fields(), modalities: ['face'], expiresAt: '2026-08-01T00:00:00.000Z' }, key);
  assert.equal(consentCoversModality(consent, 'face', '2026-07-20T00:00:00.000Z'), true);
  assert.equal(consentCoversModality(consent, 'voice', '2026-07-20T00:00:00.000Z'), false, 'voice not consented');
  assert.equal(consentCoversModality(consent, 'face', '2026-09-01T00:00:00.000Z'), false, 'expired');
});
