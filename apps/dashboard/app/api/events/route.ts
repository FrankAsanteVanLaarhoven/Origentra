import { existsSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { ensureGenerator, EVENTS_FILE } from "@/lib/event-source";

export const dynamic = "force-dynamic";

// Reference fallback, used only until the real generator's file appears.
const A = ["id-frank", "agent:publish-svc", "id-editor", "sentinel", "policy-engine"];
const AC = ["passport.sign", "publish.evaluate", "publish.approve", "publish.execute", "reuse.detect"];
const SB = ["asset-42", "pub-1", "asset-7", "incident-9"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const synthetic = () => ({ ts: Date.now(), actor: pick(A), action: pick(AC), subject: pick(SB), hash: null as string | null, ref: true });

/** SSE stream of REAL Origentra control-plane audit entries (hash-chained, Ed25519-
 *  signed) tailed from the generator's file; reference data until it goes live. */
export async function GET(req: Request) {
  ensureGenerator();
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (o: unknown) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { stop(); }
      };
      let pos = existsSync(EVENTS_FILE) ? statSync(EVENTS_FILE).size : 0;
      let sawReal = false;

      const poll = () => {
        try {
          if (existsSync(EVENTS_FILE)) {
            const size = statSync(EVENTS_FILE).size;
            if (size < pos) pos = size; // file was trimmed/rotated — skip to new end
            if (size > pos) {
              const fd = openSync(EVENTS_FILE, "r");
              const len = size - pos;
              const buf = Buffer.alloc(len);
              readSync(fd, buf, 0, len, pos);
              closeSync(fd);
              pos = size;
              for (const line of buf.toString("utf8").split("\n")) {
                if (!line.trim()) continue;
                try { send(JSON.parse(line)); sawReal = true; } catch { /* partial line */ }
              }
            }
          }
          if (!sawReal) send(synthetic());
        } catch { /* transient fs error */ }
      };

      poll();
      timer = setInterval(poll, 700);
      req.signal.addEventListener("abort", stop);
      function stop() {
        clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive" },
  });
}
