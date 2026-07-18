#!/usr/bin/env node
/**
 * origentra — reference CLI.
 *
 * `origentra demo` runs the entire vertical slice end-to-end against the
 * reference core, printing each stage. Nothing is mocked: real Ed25519
 * signatures, real digests, a real deterministic policy decision, a real
 * hash-chained audit log. The platform adapter is explicitly simulated (it
 * performs no network I/O and says so).
 *
 * Other subcommands operate on real files:
 *   origentra keygen                         -> print a fresh keypair (PEM)
 *   origentra digest <file>                  -> sha256 + fuzzy fingerprint
 *   origentra sign <file> --key <pem> ...    -> emit a Content Passport (JSON)
 *   origentra verify <file> <passport.json>  -> print verification states
 */

import { readFileSync } from 'node:fs';
import {
  generateKeyPair,
  issueIdentity,
  createPassport,
  verifyPassport,
  evaluatePolicy,
  decisionDigest,
  approve,
  authorize,
  SimulatedAdapter,
  verifyReceipt,
  sha256,
  fingerprint,
  similarity,
  TrustStore,
  AuditLog,
  type Passport,
  type PolicyInput,
} from '../../packages/core/src/index.ts';

const now = () => new Date().toISOString();

function hr(title: string) {
  console.log('\n\x1b[1m' + '── ' + title + ' ' + '─'.repeat(Math.max(0, 60 - title.length)) + '\x1b[0m');
}
function ok(msg: string) {
  console.log('  \x1b[32m✓\x1b[0m ' + msg);
}
function info(msg: string) {
  console.log('    ' + msg);
}

function demo() {
  const clock = makeStepClock();
  const audit = new AuditLog(clock);

  console.log('\x1b[1mORIGENTRA PASSPORT OS — vertical slice demo\x1b[0m');
  console.log('Secure every identity. Prove every asset. Control every release.');

  // 0. The tenant's signing authority (its key is the root of trust here).
  const tenantId = 'tenant-acme';
  const authority = generateKeyPair();
  const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);

  hr('1. Identity');
  const creator = issueIdentity(
    { identityId: 'id-frank', tenantId, subjectType: 'person', displayName: 'Frank', scopes: ['asset:register', 'publish:propose'], issuedAt: clock() },
    authority,
  );
  const approver = issueIdentity(
    { identityId: 'id-editor', tenantId, subjectType: 'person', displayName: 'Editor', scopes: ['publish:approve'], issuedAt: clock() },
    authority,
  );
  const agent = issueIdentity(
    { identityId: 'id-agent', tenantId, subjectType: 'agent', displayName: 'PublishBot', scopes: ['publish:propose'], issuedAt: clock() },
    authority,
  );
  ok(`verified creator ${creator.claim.identityId} (person), approver ${approver.claim.identityId}, agent ${agent.claim.identityId}`);
  audit.append('id-frank', 'identity.issue', 'id-frank', creator.claim);

  hr('2. Asset registration + Content Passport');
  const asset = 'Origentra secures the provenance of this article across its whole lifecycle. '.repeat(12);
  info(`asset digest: ${sha256(asset)}`);
  const passport = createPassport(
    asset,
    { assetId: 'asset-42', tenantId, contentType: 'text/plain', createdAt: clock(), creatorIdentityId: 'id-frank', aiInvolvement: 'assisted', rights: [{ kind: 'ownership', holder: 'id-frank' }] },
    authority,
  );
  ok(`signed Content Passport for ${passport.manifest.assetId} by ${passport.signer.keyId}`);
  audit.append('id-frank', 'passport.sign', passport.manifest.assetId, passport.manifest);

  hr('3. Public verification (discrete states, no trust score)');
  const v = verifyPassport(passport, { trustStore: trust, assetBytes: asset });
  ok('states: ' + v.states.join(', '));

  hr('4. Publication proposal + deterministic policy');
  const proposal: PolicyInput = {
    proposalId: 'pub-1', tenantId, identity: agent, passport, assetBytes: asset,
    platform: 'linkedin', audience: 'public', rightsRequirement: { required: ['ownership'] }, aiDisclosed: true,
  };
  const decision = evaluatePolicy(proposal, { trustStore: trust, now: clock() });
  ok(`decision: \x1b[1m${decision.decision}\x1b[0m   risk: ${decision.risk}/6`);
  info('risk factors: ' + (decision.riskFactors.join(', ') || 'none'));
  info('checks: ' + decision.checks.map((c) => `${c.name}=${c.status}`).join('  '));
  audit.append('policy-engine', 'publish.evaluate', proposal.proposalId, decision);

  hr('5. Human approval + authorisation (agent may not self-publish)');
  const approval = approve(decision, approver, authority, clock());
  const auth = authorize(decision, [approval], { trustStore: trust, now: clock(), approverIdentities: { 'id-editor': approver } });
  ok(`authorised: ${auth.authorized} (accepted approvals: ${auth.acceptedApprovals})`);
  audit.append('id-editor', 'publish.approve', proposal.proposalId, { decisionDigest: decisionDigest(decision) });

  hr('6. Idempotent execution + signed receipt (simulated adapter)');
  const adapter = new SimulatedAdapter();
  const execKey = generateKeyPair();
  const p = { decision, authorization: auth, platform: 'linkedin', assetId: 'asset-42', idempotencyKey: 'pub-1:linkedin', now: clock(), executionKey: execKey };
  const r1 = adapter.execute(p);
  const r2 = adapter.execute(p); // replay
  ok(`receipt status: ${r1.status}   externalRef: ${r1.externalRef}`);
  ok(`idempotent replay identical: ${JSON.stringify(r1) === JSON.stringify(r2)}   receipt signature valid: ${verifyReceipt(r1)}`);
  audit.append('adapter:simulated/1', 'publish.execute', proposal.proposalId, r1);

  hr('7. Continuous protection: recover provenance of a transformed copy');
  const transformed = asset.replace('secures the provenance', 'SECURES the provenance') + ' [re-posted elsewhere]';
  const s = similarity(fingerprint(asset), fingerprint(transformed));
  const exact = sha256(transformed) === passport.manifest.digest;
  ok(`transformed copy: exact-digest-match=${exact}, fuzzy-similarity=${s.toFixed(3)} -> ${s >= 0.6 ? 'PROVENANCE RECOVERED' : 'unmatched'}`);
  audit.append('sentinel', 'reuse.detect', 'asset-42', { similarity: s, source: 'transformed-copy' });

  hr('8. Tamper-evident audit trail');
  const chain = audit.verify();
  ok(`entries: ${audit.list().length}   chain verified: ${chain.ok}   head: ${audit.head.slice(0, 16)}…`);
  for (const e of audit.list()) info(`#${e.seq} ${e.action.padEnd(20)} ${e.actor}`);

  console.log('\n\x1b[1mResult:\x1b[0m one complete control loop — identity → passport → verify → propose → policy → approve → execute → detect → evidence — all cryptographically real. Platform publication is simulated (declared).');
}

/** Deterministic-ish incrementing clock for a clean demo transcript. */
function makeStepClock() {
  let n = 0;
  return () => {
    n += 1;
    const s = String(n).padStart(2, '0');
    return `2026-07-18T12:00:${s}.000Z`;
  };
}

// ---- file subcommands -------------------------------------------------------

function main(argv: string[]) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'demo':
    case undefined:
      return demo();
    case 'keygen': {
      const k = generateKeyPair();
      console.log(JSON.stringify({ keyId: k.keyId, publicKeyPem: k.publicKeyPem, privateKeyPem: k.privateKeyPem }, null, 2));
      return;
    }
    case 'digest': {
      const file = rest[0];
      if (!file) return fail('usage: origentra digest <file>');
      const bytes = readFileSync(file);
      console.log(JSON.stringify({ file, digest: sha256(bytes), fingerprint: fingerprint(bytes) }, null, 2));
      return;
    }
    case 'verify': {
      const [file, passportPath] = rest;
      if (!file || !passportPath) return fail('usage: origentra verify <file> <passport.json>');
      const bytes = readFileSync(file);
      const passport = JSON.parse(readFileSync(passportPath, 'utf8')) as Passport;
      // Honesty: without an external trust anchor the signer is UNKNOWN. Pass a
      // trusted key id with --trust <keyId> to assert authority; otherwise a
      // valid signature proves integrity only, not authority.
      const trustIdx = rest.indexOf('--trust');
      const trust = new TrustStore();
      if (trustIdx !== -1 && rest[trustIdx + 1] === passport.signer.keyId) {
        trust.add(passport.signer.keyId, passport.signer.publicKeyPem);
      }
      const result = verifyPassport(passport, { trustStore: trust, assetBytes: bytes });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    default:
      return fail(`unknown command: ${cmd}\nCommands: demo | keygen | digest <file> | verify <file> <passport.json>`);
  }
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main(process.argv.slice(2));
export {};
