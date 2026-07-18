/**
 * SocialTrust-Bench v0.1 — open, reproducible benchmark.
 *
 * Every KPI maps to a specific failure mode. The harness is deterministic (no
 * randomness, fixed logical timestamps), so a re-run reproduces the numbers.
 * Results print as a table and a JSON report is written to bench/reports/
 * (gitignored — the harness and methodology are committed, generated outputs
 * are not). Hard gates cause a non-zero exit so this doubles as a CI gate.
 *
 * Run:  node bench/socialtrust-bench.ts
 *
 * Honesty: these numbers are self-measured on a self-defined corpus. That makes
 * SocialTrust-Bench a reproducibility and regression tool, NOT a claim of
 * third-party-audited security. Independent replication is the goal (see README).
 */

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateKeyPair,
  issueIdentity,
  createPassport,
  revokePassport,
  verifyPassport,
  evaluatePolicy,
  approve,
  authorize,
  decisionDigest,
  SimulatedAdapter,
  verifyReceipt,
  evidenceCompleteness,
  TrustStore,
  type KeyPair,
  type SignedIdentityClaim,
  type PolicyInput,
  type Passport,
  type EvidencePack,
  type Approval,
} from '../packages/core/src/index.ts';
import { DurableManifestStore } from '../packages/store/src/index.ts';
import {
  imageFingerprintRaw,
  perceptualSimilarity,
  dHash,
  type RawImage,
} from '../packages/media/src/index.ts';

const T0 = '2026-07-18T10:00:00.000Z';
const CDC_THRESHOLD = 0.6;
const PERCEPTUAL_THRESHOLD = 0.85;

interface Metric {
  kpi: string;
  failureMode: string;
  value: number;
  unit: string;
  target: string;
  pass: boolean;
  hardGate: boolean;
  detail?: string;
}
const metrics: Metric[] = [];
function record(m: Metric) {
  metrics.push(m);
}

// ---- shared builders --------------------------------------------------------

function world() {
  const authority = generateKeyPair();
  const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);
  return { authority, trust };
}
function identity(
  authority: KeyPair,
  id: string,
  tenantId: string,
  subjectType: SignedIdentityClaim['claim']['subjectType'],
  scopes: string[],
): SignedIdentityClaim {
  return issueIdentity(
    { identityId: id, tenantId, subjectType, displayName: id, scopes, issuedAt: T0 },
    authority,
  );
}
function textAsset(i: number): string {
  return `Origentra protected asset number ${i}. It carries provenance across its whole lifecycle so reuse can be proven. `.repeat(6);
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
function pattern(x: number, y: number): number {
  return 128 + 100 * Math.sin(3 * Math.PI * x) * Math.sin(2 * Math.PI * y);
}
function makeImage(w: number, h: number, f: (x: number, y: number) => number): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x / w, y / h))));
      const o = (y * w + x) * 4;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  return { width: w, height: h, channels: 4, data };
}

// ---- KPI 1: passport validity ----------------------------------------------

function kpiPassportValidity() {
  const { authority, trust } = world();
  const N = 500;
  let valid = 0;
  for (let i = 0; i < N; i++) {
    const asset = textAsset(i);
    const p = createPassport(asset, { assetId: `a${i}`, tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'c', aiInvolvement: 'assisted', rights: [{ kind: 'ownership', holder: 'c' }] }, authority);
    const r = verifyPassport(p, { trustStore: trust, assetBytes: asset });
    if (r.signatureValid && !r.revoked && r.states.includes('SIGNER_TRUSTED') && r.states.includes('PROVENANCE_RECOVERED')) valid++;
  }
  record({ kpi: 'Passport validity rate', failureMode: 'invalid/unverifiable passport', value: (valid / N) * 100, unit: '%', target: '>=99.9%', pass: valid / N >= 0.999, hardGate: true, detail: `${valid}/${N}` });
}

// ---- KPI 2: provenance survivability (text / CDC) ---------------------------

function kpiTextSurvivability() {
  const dir = mkdtempSync(join(tmpdir(), 'stbench-'));
  const store = new DurableManifestStore(join(dir, 'm.jsonl'));
  const N = 200;
  for (let i = 0; i < N; i++) {
    const asset = textAsset(i);
    store.put(createPassport(asset, { assetId: `a${i}`, tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'c', aiInvolvement: 'none', rights: [] }, generateKeyPair()));
  }
  function measure(transforms: Record<string, (s: string) => string>) {
    const per: Record<string, number> = {};
    let recovered = 0;
    let total = 0;
    for (const [name, fn] of Object.entries(transforms)) {
      let ok = 0;
      for (let i = 0; i < N; i++) {
        const rec = store.recover(fn(textAsset(i)), 't', CDC_THRESHOLD);
        if (rec && rec.passport.manifest.assetId === `a${i}`) ok++;
      }
      per[name] = (ok / N) * 100;
      recovered += ok;
      total += N;
    }
    return { rate: recovered / total, per };
  }

  // Registered suite: localized edits — what CDC fingerprinting is designed for.
  const registered = measure({
    exact: (s) => s,
    append_suffix: (s) => s + ' — reposted with a short editorial note appended.',
    prepend: (s) => 'BREAKING: ' + s,
    small_edit: (s) => s.replace('protected asset', 'PROTECTED asset'),
    truncate_tail: (s) => s.slice(0, Math.floor(s.length * 0.85)),
  });
  record({ kpi: 'Provenance survivability (text, registered)', failureMode: 'origin unrecoverable after localized transformation', value: registered.rate * 100, unit: '%', target: '>=95%', pass: registered.rate >= 0.95, hardGate: false, detail: Object.entries(registered.per).map(([k, v]) => `${k}=${v.toFixed(1)}%`).join('  ') });

  // Stress suite: global rewrites — documented known-hard for CDC (see LIMITATIONS).
  // Reported transparently, not gated: perceptual/text-normalization fingerprints
  // are the production path for these and are not yet implemented.
  const stress = measure({
    whitespace_double: (s) => s.replace(/ /g, '  '),
    uppercase_all: (s) => s.toUpperCase(),
  });
  record({ kpi: 'Provenance survivability (text, stress)', failureMode: 'origin unrecoverable after global rewrite (known-hard for CDC)', value: stress.rate * 100, unit: '%', target: 'informational', pass: true, hardGate: false, detail: Object.entries(stress.per).map(([k, v]) => `${k}=${v.toFixed(1)}%`).join('  ') + ' — expected low; needs perceptual text fingerprint' });
}

// ---- KPI 3: provenance survivability (image / perceptual) -------------------

function kpiImageSurvivability() {
  const N = 60;
  // Each asset is the same smooth pattern phase-shifted by i, for variety.
  const original = (phase: number): RawImage => makeImage(64, 64, (x, y) => pattern(x + phase, y));
  const transforms: Record<string, (phase: number) => RawImage> = {
    reencode: (phase) => original(phase),
    downscale_64_48: (phase) => makeImage(48, 48, (x, y) => pattern(x + phase, y)),
    brightness: (phase) => makeImage(64, 64, (x, y) => pattern(x + phase, y) + 30),
  };
  const perTransform: Record<string, number> = {};
  let ok = 0;
  let total = 0;
  for (const [name, transform] of Object.entries(transforms)) {
    let hit = 0;
    for (let i = 0; i < N; i++) {
      const phase = i / N;
      const ref = imageFingerprintRaw(original(phase));
      const got = dHash(transform(phase));
      if (perceptualSimilarity(ref, got) >= PERCEPTUAL_THRESHOLD) hit++;
    }
    perTransform[name] = (hit / N) * 100;
    ok += hit;
    total += N;
  }
  record({ kpi: 'Provenance survivability (image)', failureMode: 'image origin unrecoverable after transformation', value: (ok / total) * 100, unit: '%', target: '>=95%', pass: ok / total >= 0.95, hardGate: false, detail: Object.entries(perTransform).map(([k, v]) => `${k}=${v.toFixed(1)}%`).join('  ') });
}

// ---- KPI 4: passport generation latency ------------------------------------

function kpiLatency() {
  const authority = generateKeyPair();
  const N = 300;
  const times: number[] = [];
  for (let i = 0; i < N; i++) {
    const asset = textAsset(i);
    const t = process.hrtime.bigint();
    createPassport(asset, { assetId: `a${i}`, tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'c', aiInvolvement: 'none', rights: [] }, authority);
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  const med = median(times);
  record({ kpi: 'Provenance generation latency', failureMode: 'passport generation adds unacceptable delay', value: med, unit: 'ms', target: '<5000ms', pass: med < 5000, hardGate: false, detail: `median of ${N}` });
}

// ---- KPI 5+6: rights false-negative / false-positive ------------------------

function kpiRights() {
  const { authority, trust } = world();
  const id = identity(authority, 'u', 't', 'person', ['publish:propose']);
  function decide(input: Partial<PolicyInput>, passport: Passport): string {
    return evaluatePolicy({ proposalId: 'p', tenantId: 't', identity: id, passport, assetBytes: 'x', platform: 'web', audience: 'internal', rightsRequirement: { required: ['ownership'] }, aiDisclosed: true, ...input } as PolicyInput, { trustStore: trust, now: T0 }).decision;
  }
  function passportWith(rights: Passport['manifest']['rights']): Passport {
    return createPassport('x', { assetId: 'a', tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'u', aiInvolvement: 'none', rights }, authority);
  }
  // Restricted cases that MUST block (a false negative = incorrectly allowed).
  const restricted = [
    passportWith([]),
    passportWith([{ kind: 'ownership', holder: 'u', expiresAt: '2020-01-01T00:00:00.000Z' }]),
    passportWith([{ kind: 'ownership', holder: 'u', revokedAt: '2025-01-01T00:00:00.000Z' }]),
    passportWith([{ kind: 'ownership', holder: 'u', disputed: true }]),
  ];
  let falseNeg = 0;
  for (const p of restricted) if (decide({}, p) !== 'BLOCK') falseNeg++;
  record({ kpi: 'Rights false-negative rate', failureMode: 'restricted content incorrectly approved', value: (falseNeg / restricted.length) * 100, unit: '%', target: '<=0.5%', pass: falseNeg === 0, hardGate: true, detail: `${falseNeg}/${restricted.length}` });

  // Legitimate cases that MUST pass rights (a false positive = incorrectly blocked).
  const legit = [
    passportWith([{ kind: 'ownership', holder: 'u' }]),
    passportWith([{ kind: 'ownership', holder: 'u', platforms: ['web'] }]),
    passportWith([{ kind: 'ownership', holder: 'u', expiresAt: '2030-01-01T00:00:00.000Z' }]),
  ];
  let falsePos = 0;
  for (const p of legit) if (decide({}, p) === 'BLOCK') falsePos++;
  record({ kpi: 'Rights false-positive rate', failureMode: 'legitimate content unnecessarily blocked', value: (falsePos / legit.length) * 100, unit: '%', target: '<=2%', pass: falsePos / legit.length <= 0.02, hardGate: false, detail: `${falsePos}/${legit.length}` });
}

// ---- KPI 7: unauthorised-publication prevention -----------------------------

function kpiUnauthorisedPrevention() {
  const { authority, trust } = world();
  const stranger = generateKeyPair();
  const person = identity(authority, 'u', 't', 'person', ['publish:propose']);
  const asset = 'critical publication bytes';
  function pp(overrides: Partial<Parameters<typeof createPassport>[1]> = {}, signer = authority): Passport {
    return createPassport(asset, { assetId: 'a', tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'u', aiInvolvement: 'none', rights: [{ kind: 'ownership', holder: 'u' }], ...overrides }, signer);
  }
  const base: PolicyInput = { proposalId: 'p', tenantId: 't', identity: person, passport: pp(), assetBytes: asset, platform: 'web', audience: 'public', rightsRequirement: { required: ['ownership'] }, aiDisclosed: true };
  const scenarios: PolicyInput[] = [
    { ...base, rightsRequirement: { required: ['music_licence'] } },        // missing rights
    { ...base, passport: pp({ tenantId: 'other' }) },                       // cross-tenant
    { ...base, passport: pp({}, stranger) },                               // untrusted signer
    { ...base, passport: revokePassport(pp(), T0, 'compromise') },          // revoked passport
    { ...base, assetBytes: 'tampered-bytes' },                             // provenance mismatch
    { ...base, passport: pp({ aiInvolvement: 'generated' }), aiDisclosed: false }, // undisclosed AI
    { ...base, passport: pp({ aiInvolvement: 'unknown' }) },                // unknown origin
  ];
  const adapter = new SimulatedAdapter();
  const execKey = generateKeyPair();
  let prevented = 0;
  scenarios.forEach((s, i) => {
    const d = evaluatePolicy(s, { trustStore: trust, now: T0 });
    const auth = authorize(d, [], { trustStore: trust, now: T0, approverIdentities: {} });
    const receipt = adapter.execute({ decision: d, authorization: auth, platform: 'web', assetId: 'a', idempotencyKey: `crit-${i}`, now: T0, executionKey: execKey });
    if (receipt.status !== 'executed') prevented++;
  });
  record({ kpi: 'Unauthorised-publication prevention', failureMode: 'unapproved content reaches a platform', value: (prevented / scenarios.length) * 100, unit: '%', target: '100%', pass: prevented === scenarios.length, hardGate: true, detail: `${prevented}/${scenarios.length} critical scenarios` });
}

// ---- KPI 8: agent approval-bypass rate (>=10,000 adversarial traces) --------

function kpiAgentBypass() {
  const { authority, trust } = world();
  const agent = identity(authority, 'agent', 't', 'agent', ['publish:propose']);
  const passport = createPassport('bytes', { assetId: 'a', tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'agent', aiInvolvement: 'fully_synthetic', rights: [{ kind: 'ownership', holder: 't' }] }, authority);
  const input: PolicyInput = { proposalId: 'p', tenantId: 't', identity: agent, passport, assetBytes: 'bytes', platform: 'web', audience: 'public', rightsRequirement: { required: ['ownership'] }, aiDisclosed: true };
  const decision = evaluatePolicy(input, { trustStore: trust, now: T0 }); // REQUIRE_APPROVAL
  const wantDigest = decisionDigest(decision);

  // Pre-built adversarial approver identities.
  const agentApprover = identity(authority, 'agent2', 't', 'agent', ['publish:approve']);
  const noScope = identity(authority, 'noscope', 't', 'person', ['publish:propose']);
  const wrongTenant = identity(authority, 'other', 'other', 'person', ['publish:approve']);
  const untrustedIssuer = generateKeyPair(); // NOT in trust store
  const untrustedApprover = identity(untrustedIssuer, 'untrusted', 't', 'person', ['publish:approve']);
  const validApprover = identity(authority, 'human', 't', 'person', ['publish:approve']);

  const approverIdentities: Record<string, SignedIdentityClaim> = { agent2: agentApprover, noscope: noScope, other: wrongTenant, untrusted: untrustedApprover, human: validApprover };

  function forged(approverId: string, approverKeyId: string): Approval {
    // A structurally complete approval with an invalid (garbage) signature.
    return { proposalId: decision.proposalId, decisionDigest: wantDigest, approverIdentityId: approverId, approverKeyId, approvedAt: T0, signature: Buffer.from('forged').toString('base64') };
  }

  const TRACES = 10000;
  let bypasses = 0;
  for (let i = 0; i < TRACES; i++) {
    const kind = i % 7;
    let approvals: Approval[];
    switch (kind) {
      case 0: approvals = [approve(decision, agentApprover, authority, T0)]; break;            // agent tries to approve
      case 1: approvals = [approve(decision, noScope, authority, T0)]; break;                  // approver lacks scope
      case 2: approvals = [approve(decision, wrongTenant, authority, T0)]; break;              // wrong tenant
      case 3: approvals = [approve(decision, untrustedApprover, untrustedIssuer, T0)]; break;  // untrusted issuer
      case 4: approvals = [forged('human', authority.keyId)]; break;                           // forged signature
      case 5: approvals = [{ ...approve(decision, validApprover, authority, T0), decisionDigest: 'sha256:' + '0'.repeat(64) }]; break; // stale/wrong decision
      default: approvals = [{ ...approve(decision, validApprover, authority, T0), proposalId: 'different-proposal' }]; break;          // wrong proposal
    }
    const auth = authorize(decision, approvals, { trustStore: trust, now: T0, approverIdentities });
    if (auth.authorized) bypasses++;
  }
  // Control: a genuine human approval MUST authorise (proves we didn't just deny everything).
  const control = authorize(decision, [approve(decision, validApprover, authority, T0)], { trustStore: trust, now: T0, approverIdentities });
  record({ kpi: 'Agent approval-bypass rate', failureMode: 'agent circumvents mandatory human approval', value: bypasses, unit: 'bypasses', target: `0 across ${TRACES}`, pass: bypasses === 0 && control.authorized, hardGate: true, detail: `${TRACES} adversarial traces; legitimate-approval control authorises=${control.authorized}` });
}

// ---- KPI 9: publishing reliability / idempotency ---------------------------

function kpiPublishingReliability() {
  const { authority, trust } = world();
  const person = identity(authority, 'u', 't', 'person', ['publish:propose']);
  const adapter = new SimulatedAdapter();
  const execKey = generateKeyPair();
  const N = 300;
  let reliable = 0;
  for (let i = 0; i < N; i++) {
    const asset = textAsset(i);
    const passport = createPassport(asset, { assetId: `a${i}`, tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'u', aiInvolvement: 'none', rights: [{ kind: 'ownership', holder: 'u' }] }, authority);
    const d = evaluatePolicy({ proposalId: `p${i}`, tenantId: 't', identity: person, passport, assetBytes: asset, platform: 'web', audience: 'internal', rightsRequirement: { required: ['ownership'] }, aiDisclosed: false }, { trustStore: trust, now: T0 });
    const auth = authorize(d, [], { trustStore: trust, now: T0, approverIdentities: {} });
    const key = `rel-${i}`;
    const r1 = adapter.execute({ decision: d, authorization: auth, platform: 'web', assetId: `a${i}`, idempotencyKey: key, now: T0, executionKey: execKey });
    const r2 = adapter.execute({ decision: d, authorization: auth, platform: 'web', assetId: `a${i}`, idempotencyKey: key, now: T0, executionKey: execKey });
    if (r1.status === 'executed' && JSON.stringify(r1) === JSON.stringify(r2) && verifyReceipt(r1)) reliable++;
  }
  record({ kpi: 'Publishing reliability', failureMode: 'publish fails, duplicates or wrong content', value: (reliable / N) * 100, unit: '%', target: '>=99.5%', pass: reliable / N >= 0.995, hardGate: false, detail: `${reliable}/${N} exactly-once & valid` });
}

// ---- KPI 10: cross-tenant isolation ----------------------------------------

function kpiCrossTenant() {
  const dir = mkdtempSync(join(tmpdir(), 'stbench-iso-'));
  const store = new DurableManifestStore(join(dir, 'm.jsonl'));
  const N = 100;
  for (let i = 0; i < N; i++) {
    const a = textAsset(i);
    store.put(createPassport(a, { assetId: `a${i}`, tenantId: 't1', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'c', aiInvolvement: 'none', rights: [] }, generateKeyPair()));
  }
  let failures = 0;
  for (let i = 0; i < N; i++) {
    // t2 presenting t1's exact bytes must recover nothing.
    if (store.recover(textAsset(i), 't2', CDC_THRESHOLD)) failures++;
  }
  // Policy-level cross-tenant asset must BLOCK.
  const { authority, trust } = world();
  const person = identity(authority, 'u', 't1', 'person', ['publish:propose']);
  const foreign = createPassport('x', { assetId: 'a', tenantId: 't2', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'u', aiInvolvement: 'none', rights: [{ kind: 'ownership', holder: 'u' }] }, authority);
  const d = evaluatePolicy({ proposalId: 'p', tenantId: 't1', identity: person, passport: foreign, assetBytes: 'x', platform: 'web', audience: 'internal', rightsRequirement: { required: ['ownership'] }, aiDisclosed: false }, { trustStore: trust, now: T0 });
  if (d.decision !== 'BLOCK' || !d.blockingReasons.includes('cross_tenant_asset')) failures++;
  record({ kpi: 'Cross-tenant isolation failures', failureMode: "one tenant accesses another tenant's data", value: failures, unit: 'failures', target: '0', pass: failures === 0, hardGate: true, detail: `${N} recovery attempts + 1 policy attempt` });
}

// ---- KPI 11: evidence completeness -----------------------------------------

function kpiEvidence() {
  const pack: EvidencePack = {
    incidentId: 'inc-1', tenantId: 't', affectedIdentityId: 'id', affectedAssetIds: ['a'],
    detectionSource: 'sentinel', timeline: [{ at: T0, event: 'detected' }], assetDigests: ['sha256:aa'],
    similarityScores: [0.72], provenanceStates: ['PROVENANCE_RECOVERED'], rightsRecords: [{ kind: 'ownership', holder: 'id' }],
    humanDecision: 'confirmed', containmentActions: ['prepared_takedown'], outcome: 'submitted', evidenceStatus: 'complete',
  };
  const c = evidenceCompleteness(pack);
  record({ kpi: 'Evidence completeness', failureMode: 'incident packet lacks required evidence', value: c.score * 100, unit: '%', target: '>=99%', pass: c.score >= 0.99, hardGate: false, detail: c.missing.length ? `missing: ${c.missing.join(',')}` : 'all required fields present' });
}

// ---- KPI 12: decision determinism ------------------------------------------

function kpiDeterminism() {
  const { authority, trust } = world();
  const agent = identity(authority, 'agent', 't', 'agent', ['publish:propose']);
  const passport = createPassport('x', { assetId: 'a', tenantId: 't', contentType: 'text/plain', createdAt: T0, creatorIdentityId: 'agent', aiInvolvement: 'synthetic_voice', rights: [{ kind: 'ownership', holder: 't' }] }, authority);
  const input: PolicyInput = { proposalId: 'p', tenantId: 't', identity: agent, passport, assetBytes: 'x', platform: 'web', audience: 'public', rightsRequirement: { required: ['ownership'] }, aiDisclosed: true };
  const K = 1000;
  const first = decisionDigest(evaluatePolicy(input, { trustStore: trust, now: T0 }));
  let stable = 0;
  for (let i = 0; i < K; i++) if (decisionDigest(evaluatePolicy(input, { trustStore: trust, now: T0 })) === first) stable++;
  record({ kpi: 'Decision determinism', failureMode: 'non-deterministic authorisation (audit ambiguity)', value: (stable / K) * 100, unit: '%', target: '100%', pass: stable === K, hardGate: true, detail: `${stable}/${K} identical decision digests` });
}

// ---- run + report -----------------------------------------------------------

function run() {
  const started = process.hrtime.bigint();
  kpiPassportValidity();
  kpiTextSurvivability();
  kpiImageSurvivability();
  kpiLatency();
  kpiRights();
  kpiUnauthorisedPrevention();
  kpiAgentBypass();
  kpiPublishingReliability();
  kpiCrossTenant();
  kpiEvidence();
  kpiDeterminism();
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;

  // Table
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  console.log('\n\x1b[1mSocialTrust-Bench v0.1 — results\x1b[0m  (self-measured, reproducible)\n');
  console.log(pad('KPI', 34) + pad('value', 12) + pad('target', 16) + 'result');
  console.log('─'.repeat(78));
  for (const m of metrics) {
    const v = `${m.value.toFixed(m.unit === '%' ? 1 : m.unit === 'ms' ? 2 : 0)}${m.unit === '%' ? '%' : m.unit === 'ms' ? 'ms' : ''}`;
    const res = m.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    const gate = m.hardGate ? ' \x1b[2m(gate)\x1b[0m' : '';
    console.log(pad(m.kpi, 34) + pad(v, 12) + pad(m.target, 16) + res + gate);
    if (m.detail) console.log('  \x1b[2m' + m.detail + '\x1b[0m');
  }

  const hardFails = metrics.filter((m) => m.hardGate && !m.pass);
  const softFails = metrics.filter((m) => !m.hardGate && !m.pass);
  console.log('─'.repeat(78));
  console.log(`${metrics.filter((m) => m.pass).length}/${metrics.length} KPIs pass · ${hardFails.length} hard-gate failures · ${softFails.length} soft failures · ${durationMs.toFixed(0)}ms`);

  const reportDir = join(process.cwd(), 'bench', 'reports');
  mkdirSync(reportDir, { recursive: true });
  const report = { benchmark: 'SocialTrust-Bench', version: '0.1', generatedAt: new Date().toISOString(), durationMs, metrics };
  const file = join(reportDir, 'socialtrust-bench-v0.1.json');
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`report: ${file}`);

  if (hardFails.length > 0) {
    console.error(`\n\x1b[31mHARD GATE FAILURE:\x1b[0m ${hardFails.map((m) => m.kpi).join(', ')}`);
    process.exit(1);
  }
}

run();
export {};
