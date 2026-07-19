# Go-live: publishing to a real platform

Origentra's network adapter, LinkedIn body mapping and the governed-publish runner
are complete and tested. Going live requires **your** credentials — Origentra makes
no authenticated third-party call without them, and nothing in this repo has run
against a live API.

## What's already done (no action needed)

- The governed flow (`apps/publisher/publish.ts` `runGovernedPublish`): identity →
  signed Content Passport → deterministic policy → human approval if required →
  execute through the adapter → signed receipt.
- The real HTTP adapter (`@origentra/adapters`): OAuth2 bearer auth, idempotency
  key, retry/backoff, timeout, categorised failures.
- The LinkedIn UGC ShareContent mapping (`createLinkedInAdapter`).
- Hermetic end-to-end tests against a mock platform (`apps/publisher/test`).

## What you provide

1. A **LinkedIn app** (LinkedIn Developer Portal) with **Sign In with LinkedIn**
   and **Share on LinkedIn** products enabled.
2. An **OAuth2 access token** with the `w_member_social` scope (member) — obtained
   via the standard authorization-code flow.
3. Your **author URN**: `urn:li:person:<id>` (member) or
   `urn:li:organization:<id>` (an organization you administer).

## Run it

```bash
export LINKEDIN_ACCESS_TOKEN="<token with w_member_social>"
export LINKEDIN_AUTHOR_URN="urn:li:person:<id>"

# One real governed post:
node apps/publisher/live.ts "Published under Origentra governed control."

# Or run the credentials-gated live test (publishes a real post):
ORIGENTRA_LIVE=1 node --test apps/publisher/test/live.test.ts
```

A success prints the decision, the LinkedIn post reference (`linkedin://…/<id>`)
and confirms the signed receipt. Without the env vars, `live.ts` prints these
instructions and **makes no network call**.

## Notes & limits

- **Idempotency:** the adapter sends an `Idempotency-Key`; re-running with the same
  text is de-duplicated by LinkedIn, so a retry after a timeout is safe.
- **Token refresh:** supply a fresh token, or implement a `TokenProvider` that
  refreshes (an `OAuth2ClientCredentialsProvider` exists for the client-credentials
  grant). A mid-flight `401` is treated as terminal (no silent re-auth).
- **LinkedIn media (image/video) shares** are not mapped — text shares only. They
  need LinkedIn's separate register-upload-attach media flow.
- **YouTube** is not implemented: publishing a video is a resumable multipart
  upload, a heavier flow than a text share. The adapter contract and governed
  runner are ready for it; the mapping + upload are future work.
