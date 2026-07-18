/**
 * Origentra Verify — public verification server (Node.js stdlib only).
 *
 * Endpoints:
 *   GET  /                      the verifier UI (inline HTML/CSS/JS, no external assets)
 *   GET  /health                liveness
 *   GET  /api/published         list published assets (public)
 *   GET  /api/passport?digest=  the published passport for a digest (public)
 *   POST /api/verify            body { passport, assetBase64 } -> discrete states
 *
 * Trust anchor (honest): this instance vouches ONLY for signer keys that have
 * actually published content here. A valid signature from any other key
 * verifies as SIGNER_UNKNOWN / VERIFICATION_INCOMPLETE — integrity without
 * authority. The server never invents trust it cannot justify.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { verifyPassport, TrustStore, type Passport } from '../../packages/core/src/index.ts';
import { PublishStore } from '../../packages/store/src/index.ts';
import { RevocationRegistry, type RevocationEntry } from '../../packages/transparency/src/index.ts';

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : String(body);
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    total += (c as Buffer).length;
    if (total > 32 * 1024 * 1024) throw new Error('payload too large');
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

/** Trust store seeded from the signers that have published to this instance. */
function trustFromPublished(store: PublishStore): TrustStore {
  const trust = new TrustStore();
  for (const s of store.list()) {
    const rec = store.getByDigest(s.digest);
    if (rec) trust.add(rec.passport.signer.keyId, rec.passport.signer.publicKeyPem);
  }
  return trust;
}

export function createVerifier(publishFile: string, revocationFile?: string): Server {
  const store = new PublishStore(publishFile);
  const revocationEntries: RevocationEntry[] =
    revocationFile && existsSync(revocationFile)
      ? readFileSync(revocationFile, 'utf8')
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => JSON.parse(l) as RevocationEntry)
      : [];

  return createServer((req, res) => {
    void handle(req, res).catch((err) => send(res, 400, { error: String(err?.message ?? err) }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET' && path === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });

    if (req.method === 'GET' && path === '/api/published') {
      return send(res, 200, { published: store.list() });
    }

    if (req.method === 'GET' && path === '/api/passport') {
      const digest = url.searchParams.get('digest') ?? '';
      const rec = store.getByDigest(digest);
      if (!rec) return send(res, 404, { error: 'not_found' });
      return send(res, 200, { passport: rec.passport, receipt: rec.receipt });
    }

    if (req.method === 'POST' && path === '/api/verify') {
      const body = (await readJson(req)) as { passport?: Passport; assetBase64?: string };
      if (!body.passport) return send(res, 400, { error: 'passport required' });
      const bytes = body.assetBase64 ? Buffer.from(body.assetBase64, 'base64') : undefined;
      const trust = trustFromPublished(store);
      const registry = RevocationRegistry.fromEntries(revocationEntries, trust);
      const result = verifyPassport(body.passport, {
        trustStore: trust,
        assetBytes: bytes,
        isRevoked: (p) => registry.isRevoked('passport', p.manifest.digest),
      });
      return send(res, 200, result);
    }

    return send(res, 404, { error: 'not_found' });
  }
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Origentra Verify</title>
<style>
:root{color-scheme:light dark;--bg:#0b0d10;--fg:#e8eaed;--muted:#9aa4af;--card:#151a1f;--line:#263039;--ok:#3fb950;--warn:#d29922;--bad:#f85149;--accent:#4c8dff}
@media(prefers-color-scheme:light){:root{--bg:#f6f8fa;--fg:#1b1f24;--muted:#57606a;--card:#fff;--line:#d0d7de}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
.wrap{max-width:840px;margin:0 auto;padding:32px 20px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px}
label{display:block;font-weight:600;margin:0 0 6px;font-size:13px}
textarea,input[type=file]{width:100%;background:transparent;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px;font:13px ui-monospace,monospace}
textarea{min-height:120px;resize:vertical}
button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;margin-top:12px}
.states{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line)}
.chip.ok{color:var(--ok);border-color:var(--ok)}.chip.warn{color:var(--warn);border-color:var(--warn)}.chip.bad{color:var(--bad);border-color:var(--bad)}
.note{color:var(--muted);font-size:12px;margin-top:10px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
code{font:12px ui-monospace,monospace;color:var(--muted)}
</style></head><body><div class="wrap">
<h1>Origentra Verify</h1>
<p class="sub">Secure every identity. Prove every asset. Control every release. — evidence-based verification, no single trust score.</p>

<div class="card">
  <label>Content Passport (JSON)</label>
  <textarea id="passport" placeholder="Paste a Content Passport here, or click a published asset below."></textarea>
  <label style="margin-top:14px">Asset file (optional — proves the bytes match the passport)</label>
  <input type="file" id="file">
  <button id="go">Verify</button>
  <div class="states" id="states"></div>
  <div class="note" id="note"></div>
</div>

<div class="card">
  <label>Published on this instance</label>
  <table id="pub"><tbody><tr><td class="note">loading…</td></tr></tbody></table>
</div>

<script>
const meaning={SIGNATURE_VALID:'ok',SIGNER_TRUSTED:'ok',PROVENANCE_RECOVERED:'ok',RIGHTS_RECORDED:'ok',AI_INVOLVEMENT_DECLARED:'ok',
SIGNATURE_INVALID:'bad',ASSET_MODIFIED:'bad',CREDENTIAL_REVOKED:'bad',RIGHTS_DISPUTED:'warn',SIGNER_UNKNOWN:'warn',VERIFICATION_INCOMPLETE:'warn'};
function fileB64(f){return new Promise((r,j)=>{if(!f)return r(undefined);const rd=new FileReader();rd.onload=()=>r(btoa(String.fromCharCode(...new Uint8Array(rd.result))));rd.onerror=j;rd.readAsArrayBuffer(f)})}
async function verify(){
  const el=document.getElementById('states'),note=document.getElementById('note');el.innerHTML='';note.textContent='';
  let passport;try{passport=JSON.parse(document.getElementById('passport').value)}catch(e){note.textContent='Invalid passport JSON.';return}
  const assetBase64=await fileB64(document.getElementById('file').files[0]);
  const res=await fetch('/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({passport,assetBase64})});
  const out=await res.json();
  if(out.error){note.textContent=out.error;return}
  for(const s of out.states){const c=document.createElement('span');c.className='chip '+(meaning[s]||'warn');c.textContent=s;el.appendChild(c)}
  note.textContent=assetBase64?'':'No asset uploaded — provenance not checked (VERIFICATION_INCOMPLETE expected).';
}
document.getElementById('go').onclick=verify;
async function load(){
  const r=await(await fetch('/api/published')).json();const b=document.querySelector('#pub tbody');
  if(!r.published.length){b.innerHTML='<tr><td class="note">nothing published yet</td></tr>';return}
  b.innerHTML='<tr><th>asset</th><th>platform</th><th>digest</th></tr>'+r.published.map(p=>
    '<tr><td>'+p.assetId+'</td><td>'+p.platform+'</td><td><a href="#" data-d="'+p.digest+'"><code>'+p.digest.slice(0,24)+'…</code></a></td></tr>').join('');
  b.querySelectorAll('a').forEach(a=>a.onclick=async e=>{e.preventDefault();
    const d=await(await fetch('/api/passport?digest='+encodeURIComponent(a.dataset.d))).json();
    document.getElementById('passport').value=JSON.stringify(d.passport,null,2)})
}
load();
</script></div></body></html>`;

// Run directly: node apps/verifier/server.ts  (PORT, ORIGENTRA_PUBLISH_FILE)
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.env.ORIGENTRA_PUBLISH_FILE ?? '.origentra/published.jsonl';
  const revFile = process.env.ORIGENTRA_REVOCATIONS_FILE;
  const port = Number(process.env.PORT ?? 8787);
  createVerifier(file, revFile).listen(port, () => {
    console.log(`Origentra Verify listening on http://localhost:${port}  (published: ${file})`);
  });
}
