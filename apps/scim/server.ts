/**
 * Origentra SCIM 2.0 provisioning endpoint (Node.js stdlib only).
 *
 * An enterprise IdP calls this to provision/deprovision users; each maps to an
 * Origentra identity (issue on create/activate, revoke on deactivate/delete).
 * Bearer-token authenticated. A subset of RFC 7644:
 *   POST   /scim/v2/Users            create
 *   GET    /scim/v2/Users            list
 *   GET    /scim/v2/Users/{id}       read
 *   PATCH  /scim/v2/Users/{id}       replace active / roles
 *   DELETE /scim/v2/Users/{id}       deprovision
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { ScimProvisioner } from '../../packages/enterprise/src/index.ts';

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { 'content-type': 'application/scim+json', 'cache-control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? (JSON.parse(s) as Record<string, unknown>) : {};
}

interface PatchOp {
  op: string;
  path?: string;
  value?: unknown;
}

export function createScimServer(provisioner: ScimProvisioner, bearerToken: string): Server {
  return createServer((req, res) => {
    void handle(req, res).catch((err) => send(res, 400, { detail: String(err?.message ?? err) }));
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') return send(res, 200, { ok: true });

    if (req.headers['authorization'] !== `Bearer ${bearerToken}`) return send(res, 401, { detail: 'unauthorised' });

    const usersMatch = url.pathname.match(/^\/scim\/v2\/Users(?:\/([^/]+))?$/);
    if (!usersMatch) return send(res, 404, { detail: 'not_found' });
    const id = usersMatch[1];

    if (req.method === 'POST' && !id) {
      const body = await readJson(req);
      const user = provisioner.create({
        userName: String(body.userName),
        active: body.active as boolean | undefined,
        name: body.name as never,
        emails: body.emails as never,
        roles: body.roles as string[] | undefined,
      });
      return send(res, 201, user);
    }
    if (req.method === 'GET' && !id) {
      const resources = provisioner.list();
      return send(res, 200, { schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'], totalResults: resources.length, Resources: resources });
    }
    if (req.method === 'GET' && id) {
      const user = provisioner.get(id);
      return user ? send(res, 200, user) : send(res, 404, { detail: 'not_found' });
    }
    if (req.method === 'PATCH' && id) {
      if (!provisioner.get(id)) return send(res, 404, { detail: 'not_found' });
      const body = await readJson(req);
      const ops = (body.Operations as PatchOp[] | undefined) ?? [];
      let user = provisioner.get(id)!;
      for (const op of ops) {
        if (op.op?.toLowerCase() === 'replace' && op.path === 'active') user = provisioner.setActive(id, Boolean(op.value));
        else if (op.op?.toLowerCase() === 'replace' && op.path === 'roles') user = provisioner.replaceRoles(id, op.value as string[]);
      }
      return send(res, 200, user);
    }
    if (req.method === 'DELETE' && id) {
      provisioner.delete(id);
      return send(res, 204);
    }
    return send(res, 405, { detail: 'method_not_allowed' });
  }
}
