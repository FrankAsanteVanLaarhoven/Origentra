/**
 * Live event generator — runs the REAL Origentra governed control loop and appends
 * genuine hash-chained audit entries (real Ed25519 signing, real policy decisions)
 * to a JSONL file that the dashboard's /api/events route tails.
 *
 * Runs with native Node (`node scripts/event-generator.ts`) so the zero-dependency
 * .ts core executes as designed — no bundler involved.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  generateKeyPair,
  issueIdentity,
  createPassport,
  evaluatePolicy,
  approve,
  authorize,
  SimulatedAdapter,
  AuditLog,
  TrustStore,
  decisionDigest,
} from "../../../packages/core/src/index.ts";

const FILE = process.env.ORIGENTRA_LIVE_EVENTS || "/tmp/origentra-live-events.jsonl";
const CAP = 500;
mkdirSync(dirname(FILE), { recursive: true });

const now = () => new Date().toISOString();
const authority = generateKeyPair();
const trust = new TrustStore().add(authority.keyId, authority.publicKeyPem);
const person = issueIdentity({ identityId: "id-frank", tenantId: "tenant-acme", subjectType: "person", displayName: "Frank", scopes: ["asset:register", "publish:propose"], issuedAt: now() }, authority);
const approver = issueIdentity({ identityId: "id-editor", tenantId: "tenant-acme", subjectType: "person", displayName: "Editor", scopes: ["publish:approve"], issuedAt: now() }, authority);
const agent = issueIdentity({ identityId: "agent:publish-svc", tenantId: "tenant-acme", subjectType: "agent", displayName: "PublishSvc", scopes: ["publish:propose"], issuedAt: now() }, authority);
const audit = new AuditLog(now);
const adapter = new SimulatedAdapter();
const execKey = generateKeyPair();
let n = 0;

function trim() {
  try {
    const lines = readFileSync(FILE, "utf8").split("\n").filter(Boolean);
    if (lines.length > CAP) writeFileSync(FILE, lines.slice(-CAP).join("\n") + "\n");
  } catch { /* first write */ }
}

function emit(entries) {
  for (const e of entries) {
    appendFileSync(FILE, JSON.stringify({ ts: Date.parse(e.at), seq: e.seq, actor: e.actor, action: e.action, subject: e.subject, hash: e.entryHash.slice(0, 12) }) + "\n");
  }
  trim();
}

function tick() {
  const before = audit.list().length;
  const i = n++;
  const asset = `Origentra live governed content #${i} — provenance preserved across its lifecycle. `.repeat(3);
  const agentTurn = i % 3 === 0;
  const identity = agentTurn ? agent : person;

  const passport = createPassport(asset, { assetId: `asset-${i}`, tenantId: "tenant-acme", contentType: "text/plain", createdAt: now(), creatorIdentityId: identity.claim.identityId, aiInvolvement: agentTurn ? "generated" : "assisted", rights: [{ kind: "ownership", holder: identity.claim.identityId }] }, authority);
  audit.append(identity.claim.identityId, "passport.sign", passport.manifest.assetId, { digest: passport.manifest.digest });

  const proposal = { proposalId: `pub-${i}`, tenantId: "tenant-acme", identity, passport, assetBytes: asset, platform: "linkedin", audience: "public", rightsRequirement: { required: ["ownership"] }, aiDisclosed: true };
  const decision = evaluatePolicy(proposal, { trustStore: trust, now: now() });
  audit.append("policy-engine", "publish.evaluate", proposal.proposalId, { decision: decision.decision, risk: decision.risk });

  let auth;
  if (decision.decision === "REQUIRE_APPROVAL") {
    const ap = approve(decision, approver, authority, now());
    auth = authorize(decision, [ap], { trustStore: trust, now: now(), approverIdentities: { [approver.claim.identityId]: approver } });
    audit.append(approver.claim.identityId, "publish.approve", proposal.proposalId, { d: decisionDigest(decision) });
  } else {
    auth = authorize(decision, [], { trustStore: trust, now: now(), approverIdentities: {} });
  }

  const receipt = adapter.execute({ decision, authorization: auth, platform: "linkedin", assetId: passport.manifest.assetId, idempotencyKey: `idem-${i}`, now: now(), executionKey: execKey });
  audit.append("adapter:simulated/1", "publish.execute", proposal.proposalId, { status: receipt.status });

  if (i % 4 === 0) audit.append("sentinel", "reuse.detect", passport.manifest.assetId, { similarity: 0.69 });

  emit(audit.list().slice(before));
}

tick();
setInterval(tick, 900);
console.error(`[origentra] live event generator → ${FILE}  (chain verified: ${audit.verify().ok})`);
