/**
 * LinkedIn adapter — a CONFIGURATION of HttpPublishAdapter for LinkedIn's UGC
 * Posts API. This is real, correct mapping code that would function with an
 * operator's credentials; it is NOT exercised against the live LinkedIn API in
 * this repository and makes no claim to have published to LinkedIn.
 *
 * To use for real, the operator must supply:
 *   - a LinkedIn app and an OAuth2 member/organization access token with the
 *     `w_member_social` scope (via a TokenProvider);
 *   - the author URN (urn:li:person:<id> or urn:li:organization:<id>).
 *
 * LIMITATION: only text shares are mapped. Image/video shares require LinkedIn's
 * separate register-upload-attach media flow, which is not implemented here.
 */

import { HttpPublishAdapter, type HttpPublishAdapterConfig } from './http-adapter.ts';
import type { TokenProvider } from './token.ts';
import type { ExecuteParams } from '../../core/src/index.ts';

export interface LinkedInConfig {
  /** urn:li:person:<id> or urn:li:organization:<id>. */
  authorUrn: string;
  tokenProvider: TokenProvider;
  /** Override for tests; defaults to the live UGC Posts endpoint. */
  endpoint?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  baseDelayMs?: number;
}

/** Map an Origentra execute() call to a LinkedIn UGC ShareContent body. */
export function linkedInUgcBody(authorUrn: string, visibility: 'PUBLIC' | 'CONNECTIONS') {
  return (params: ExecuteParams): unknown => {
    const text = params.record?.assetBase64
      ? Buffer.from(params.record.assetBase64, 'base64').toString('utf8')
      : '';
    return {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
    };
  };
}

export function createLinkedInAdapter(cfg: LinkedInConfig): HttpPublishAdapter {
  const config: HttpPublishAdapterConfig = {
    name: 'linkedin/ugc-v2',
    endpoint: cfg.endpoint ?? 'https://api.linkedin.com/v2/ugcPosts',
    tokenProvider: cfg.tokenProvider,
    scheme: 'linkedin',
    buildBody: linkedInUgcBody(cfg.authorUrn, cfg.visibility ?? 'PUBLIC'),
    // LinkedIn returns the post URN in the response body `id` (and x-restli-id).
    parseRef: (json) => String((json as { id?: unknown })?.id ?? ''),
    ...(cfg.fetchImpl ? { fetchImpl: cfg.fetchImpl } : {}),
    ...(cfg.sleep ? { sleep: cfg.sleep } : {}),
    ...(cfg.maxRetries !== undefined ? { maxRetries: cfg.maxRetries } : {}),
    ...(cfg.baseDelayMs !== undefined ? { baseDelayMs: cfg.baseDelayMs } : {}),
  };
  return new HttpPublishAdapter(config);
}
