/**
 * Origentra go-live — publish to a REAL LinkedIn account under governed control.
 *
 * Reads credentials from the environment and runs the full governed flow through
 * the real LinkedIn adapter. Nothing is mocked here; if credentials are absent it
 * prints setup instructions and exits WITHOUT any network call. See docs/GO-LIVE.md.
 *
 *   LINKEDIN_ACCESS_TOKEN   OAuth2 token with the w_member_social scope
 *   LINKEDIN_AUTHOR_URN     urn:li:person:<id>  or  urn:li:organization:<id>
 *   LINKEDIN_ENDPOINT       (optional) override the API endpoint (staging/testing)
 *
 *   node apps/publisher/live.ts "Your post text here"
 */

import { sha256 } from '../../packages/core/src/index.ts';
import { createLinkedInAdapter, StaticTokenProvider } from '../../packages/adapters/src/index.ts';
import { runGovernedPublish, governedContext } from './publish.ts';

async function main() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const authorUrn = process.env.LINKEDIN_AUTHOR_URN;
  if (!token || !authorUrn) {
    console.error(
      [
        'Origentra go-live needs LinkedIn credentials (see docs/GO-LIVE.md):',
        '  export LINKEDIN_ACCESS_TOKEN=<oauth token with w_member_social>',
        '  export LINKEDIN_AUTHOR_URN=urn:li:person:<id>',
        '',
        'Then:  node apps/publisher/live.ts "Your post text"',
        'No network call was made.',
      ].join('\n'),
    );
    process.exit(2);
  }

  const text = process.argv.slice(2).join(' ') || 'Published under Origentra governed control.';
  const now = new Date().toISOString();
  const ctx = governedContext(now);
  const adapter = createLinkedInAdapter({
    authorUrn,
    tokenProvider: new StaticTokenProvider(token),
    ...(process.env.LINKEDIN_ENDPOINT ? { endpoint: process.env.LINKEDIN_ENDPOINT } : {}),
  });

  const result = await runGovernedPublish({
    ...ctx,
    assetBytes: text,
    contentType: 'text/plain',
    assetId: 'live-' + sha256(text).slice('sha256:'.length, 'sha256:'.length + 12),
    aiInvolvement: 'none',
    aiDisclosed: false,
    rights: [{ kind: 'ownership', holder: 'publisher' }],
    rightsRequired: ['ownership'],
    platform: 'linkedin',
    audience: 'public',
    proposalId: 'live-pub',
    idempotencyKey: 'live-' + sha256(text).slice('sha256:'.length, 'sha256:'.length + 16),
    now,
    adapter,
  });

  console.log('decision  :', result.decision.decision, `(risk ${result.decision.risk}/6)`);
  if (result.published) {
    console.log('published :', result.receipt?.externalRef);
    console.log('receipt   : signed=' + result.receiptValid);
  } else {
    console.log('NOT published:', result.decision.blockingReasons.join(', ') || result.authorization.reasons.join(', '));
  }
  process.exit(result.published ? 0 : 1);
}

await main();
