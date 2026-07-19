import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LegalHoldRegistry, auditToSiem, toCef } from '../src/index.ts';

const T0 = '2026-07-19T00:00:00.000Z';

test('a target under legal hold cannot be deleted (fail closed)', () => {
  const reg = new LegalHoldRegistry();
  reg.place({ holdId: 'h1', targets: ['asset-1', 'incident-9'], reason: 'litigation', placedBy: 'legal', placedAt: T0 });
  assert.equal(reg.isHeld('asset-1'), true);
  assert.throws(() => reg.assertNotHeld('asset-1'), /legal_hold_active/);
  assert.doesNotThrow(() => reg.assertNotHeld('asset-2'));
});

test('releasing a hold lifts the restriction', () => {
  const reg = new LegalHoldRegistry();
  reg.place({ holdId: 'h1', targets: ['asset-1'], reason: 'x', placedBy: 'legal', placedAt: T0 });
  reg.release('h1', '2026-07-20T00:00:00.000Z');
  assert.equal(reg.isHeld('asset-1'), false);
  assert.doesNotThrow(() => reg.assertNotHeld('asset-1'));
});

test('overlapping holds keep a target held until all are released', () => {
  const reg = new LegalHoldRegistry();
  reg.place({ holdId: 'h1', targets: ['asset-1'], reason: 'a', placedBy: 'legal', placedAt: T0 });
  reg.place({ holdId: 'h2', targets: ['asset-1'], reason: 'b', placedBy: 'legal', placedAt: T0 });
  reg.release('h1', T0);
  assert.equal(reg.isHeld('asset-1'), true, 'still held by h2');
  reg.release('h2', T0);
  assert.equal(reg.isHeld('asset-1'), false);
});

test('audit entries map to SIEM events with severity and a CEF line', () => {
  const events = auditToSiem([
    { at: T0, actor: 'id-frank', action: 'passport.sign', subject: 'asset-1' },
    { at: T0, actor: 'id-editor', action: 'credential.revoke', subject: 'id-bob' },
  ]);
  assert.equal(events[0]?.severity, 'info');
  assert.equal(events[1]?.severity, 'high');
  const cef = toCef(events[1]!);
  assert.match(cef, /^CEF:0\|Origentra\|PassportOS\|0\.1\|credential\.revoke\|/);
  assert.match(cef, /suser=id-editor/);
});
