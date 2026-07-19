import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../../../packages/core/src/index.ts';
import { createLinkedInAdapter, StaticTokenProvider } from '../../../packages/adapters/src/index.ts';
import { runGovernedPublish, governedContext } from '../publish.ts';

/**
 * Credentials-gated live test. It is SKIPPED unless you opt in with:
 *   ORIGENTRA_LIVE=1 LINKEDIN_ACCESS_TOKEN=... LINKEDIN_AUTHOR_URN=... npm test
 * so `npm test` stays hermetic in CI, but you can prove the real integration.
 *
 * WARNING: when enabled, this publishes a REAL post to the configured account.
 */

const token = process.env.LINKEDIN_ACCESS_TOKEN;
const authorUrn = process.env.LINKEDIN_AUTHOR_URN;
const enabled = process.env.ORIGENTRA_LIVE === '1' && !!token && !!authorUrn;

test(
  'live LinkedIn publish under governed control',
  { skip: enabled ? false : 'set ORIGENTRA_LIVE=1 and LINKEDIN_ACCESS_TOKEN / LINKEDIN_AUTHOR_URN to run' },
  async () => {
    const now = new Date().toISOString();
    const text = `Origentra live governed publish test — ${now}`;
    const ctx = governedContext(now);
    const adapter = createLinkedInAdapter({ authorUrn: authorUrn!, tokenProvider: new StaticTokenProvider(token!) });

    const result = await runGovernedPublish({
      ...ctx,
      assetBytes: text,
      contentType: 'text/plain',
      assetId: 'live-' + sha256(text).slice(7, 19),
      aiInvolvement: 'none',
      aiDisclosed: false,
      rights: [{ kind: 'ownership', holder: 'publisher' }],
      rightsRequired: ['ownership'],
      platform: 'linkedin',
      audience: 'public',
      proposalId: 'live-test',
      idempotencyKey: 'live-' + sha256(text).slice(7, 23),
      now,
      adapter,
    });

    assert.equal(result.published, true, 'expected a real LinkedIn publish to succeed');
    assert.match(result.receipt!.externalRef, /^linkedin:\/\//);
    assert.equal(result.receiptValid, true);
  },
);
