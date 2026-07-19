export const dynamic = "force-dynamic";

const ACTORS = ["id-frank", "agent:publish-svc", "id-editor", "sentinel", "policy-engine", "witness:w1", "adapter:local-fs/1"];
const ACTIONS = ["passport.sign", "publish.evaluate", "publish.approve", "publish.execute", "reuse.detect", "revocation.add", "checkpoint.cosign", "identity.issue", "consent.record"];
const SUBJECTS = ["asset-42", "pub-1", "asset-7", "tenant-acme", "incident-9", "clip-3", "enr-1"];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

/** Server-Sent Events: a live stream of Origentra-style control-plane events.
 *  (Reference stream; wire to real audit/transparency events in production.) */
export async function GET(req: Request) {
  const enc = new TextEncoder();
  let id: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const push = () => {
        const e = { ts: Date.now(), actor: pick(ACTORS), action: pick(ACTIONS), subject: pick(SUBJECTS), risk: Math.floor(Math.random() * 7) };
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          clearInterval(id);
        }
      };
      push();
      id = setInterval(push, 900);
      req.signal.addEventListener("abort", () => {
        clearInterval(id);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      clearInterval(id);
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive" },
  });
}
