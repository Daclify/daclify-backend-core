import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  AppBindingSchema,
  AppActivityPageSchema,
  ApiOriginSchema,
  AppSnapshotEnvelopeSchema,
  CidSchema,
} from '@daclify/core-protocol';
import { createHash } from 'node:crypto';
import { readAppResponse } from '@daclify/core-protocol/connected-apps';
import { Store } from './store.js';
import { Pool } from 'pg';
import { sqliteStore } from './database.js';
import { createPostgresStore } from './postgres-store.js';
import { verifyAppAccess } from './access.js';
const issuer = ApiOriginSchema.parse(process.env.DACLIFY_ISSUER),
  clientId = z.uuid().parse(process.env.DACLIFY_CLIENT_ID),
  appId = z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .parse(process.env.DACLIFY_APP_ID),
  daoId = z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .parse(process.env.DACLIFY_DAO_ID),
  origin = ApiOriginSchema.parse(process.env.MINI_APP_ORIGIN),
  binding = AppBindingSchema.parse({
    schemaVersion: 1,
    chainId: process.env.DACLIFY_CHAIN_ID,
    runtime: process.env.DACLIFY_RUNTIME,
    daoId,
    appId,
    issuer,
    clientId,
  }),
  database = z.string().min(1).parse(process.env.MINI_APP_DB),
  engine = z
    .enum(['sqlite', 'postgres'])
    .default('sqlite')
    .parse(process.env.MINI_APP_DATABASE_ENGINE),
  pool = engine === 'postgres' ? new Pool({ connectionString: database }) : null,
  store = pool
    ? await createPostgresStore(pool, binding)
    : sqliteStore(new Store(database, binding));
const config = {
  issuer,
  clientId,
  redirectUri: origin + '/callback',
  frontendOrigin: ApiOriginSchema.parse(process.env.DACLIFY_FRONTEND_ORIGIN),
  activityAccount: z
    .string()
    .regex(/^[a-z1-5.]{1,12}$/)
    .parse(process.env.DACLIFY_ACTIVITY_ACCOUNT),
};
const server = createServer(
  {
    key: readFileSync(z.string().parse(process.env.MINI_APP_TLS_KEY)),
    cert: readFileSync(z.string().parse(process.env.MINI_APP_TLS_CERT)),
  },
  async (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    try {
      const url = new URL(request.url ?? '/', origin);
      if (request.headers.origin) {
        if (request.headers.origin !== origin && request.headers.origin !== config.frontendOrigin)
          throw new Error('APP_ORIGIN');
        response.setHeader('access-control-allow-origin', request.headers.origin);
        response.setHeader('vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        if (request.headers.origin !== config.frontendOrigin) throw new Error('APP_ORIGIN');
        response.setHeader('access-control-allow-methods', 'GET, POST');
        response.setHeader('access-control-allow-headers', 'authorization, content-type');
        response.statusCode = 204;
        response.end();
        return;
      }

      if (
        request.method === 'GET' &&
        ['/', '/callback', '/browser.js', '/callback.js', '/config'].includes(url.pathname)
      ) {
        if (url.pathname === '/config') {
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(config));
          return;
        }
        response.setHeader(
          'content-security-policy',
          "default-src 'self'; script-src 'self'; connect-src 'self' " +
            issuer +
            "; frame-ancestors 'none'; base-uri 'none'",
        );
        response.setHeader(
          'content-type',
          url.pathname.endsWith('.js') ? 'text/javascript' : 'text/html',
        );
        if (url.pathname.endsWith('.js'))
          response.end(readFileSync(new URL('./public' + url.pathname, import.meta.url)));
        else
          response.end(
            url.pathname === '/callback'
              ? '<!doctype html><title>Sign-in complete</title><p>Returning to your app…</p><script type="module" src="/callback.js"></script>'
              : '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Community mini app</title><main><h1>Community tasks</h1><button id="login">Sign in with Daclify</button> <button id="logout">Sign out</button><p id="status" role="status"></p><div id="tasks"></div></main><script type="module" src="/browser.js"></script></html>',
          );
        return;
      }
      const authorization = request.headers.authorization ?? '';
      const { claims, actor } = await verifyAppAccess(binding, authorization);
      if (
        request.method === 'POST' &&
        !url.pathname.startsWith('/v1/evidence/') &&
        !claims.sessionId
      )
        throw new Error('APP_GRANT_REQUIRED');
      // A public DAO still requires active membership for its operational tasks.
      response.setHeader('content-type', 'application/json');
      let result: unknown;
      if (request.method === 'GET' && url.pathname === '/v1/tasks')
        result = await store.tasks(actor);
      else if (request.method === 'GET' && url.pathname === '/v1/outbox')
        result = await store.pending(actor);
      else if (request.method === 'GET' && url.pathname.startsWith('/v1/sources/'))
        result = await store.source(
          z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(url.pathname.split('/')[3]),
          actor,
        );
      else if (request.method === 'GET' && url.pathname.startsWith('/v1/outbox/'))
        result = await store.draft(
          z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(url.pathname.split('/')[3]),
          actor,
        );
      else if (request.method === 'POST' && url.pathname.startsWith('/v1/evidence/')) {
        const event = z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(url.pathname.split('/')[3]),
          draft = await store.draft(event, actor),
          chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > 5 * 1024 * 1024) throw new Error('SNAPSHOT_SIZE');
          chunks.push(bytes);
        }
        const bytes = Buffer.concat(chunks),
          snapshot = AppSnapshotEnvelopeSchema.parse(JSON.parse(bytes.toString('utf8'))),
          context = snapshot.context;
        if (
          context.appId !== appId ||
          context.dao.daoId !== daoId ||
          context.dao.chainId !== claims.dao.chainId ||
          context.dao.contract !== claims.dao.contract ||
          context.eventId !== event ||
          context.sourceId !== draft.source.sourceId ||
          context.sourceRevision !== draft.source.sourceRevision
        )
          throw new Error('SNAPSHOT_SCOPE');
        const jwt = z.string().min(1).parse(process.env.MINI_APP_PINATA_JWT),
          body = new FormData();
        body.set(
          'file',
          new File([Uint8Array.from(bytes).buffer], 'app-snapshot.bin', {
            type: 'application/octet-stream',
          }),
        );
        body.set('network', 'public');
        body.set('cid_version', 'v1');
        const pinned = await fetch('https://uploads.pinata.cloud/v3/files', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + jwt },
            body,
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
          }),
          upload = z
            .object({ data: z.object({ cid: CidSchema, size: z.literal(bytes.length) }) })
            .parse(JSON.parse(new TextDecoder().decode(await readAppResponse(pinned, 65536))));
        result = await store.evidence(
          event,
          actor,
          upload.data.cid,
          createHash('sha256').update(bytes).digest('hex'),
          context.keyEpoch,
        );
      } else if (request.method === 'POST' && url.pathname.startsWith('/v1/complete/'))
        result = await store.complete(z.string().max(64).parse(url.pathname.split('/')[3]), actor, {
          requireEvidence: url.searchParams.get('evidence') === '1',
          review: url.searchParams.get('review') === '1',
        });
      else if (request.method === 'POST' && url.pathname.startsWith('/v1/confirm/')) {
        const event = z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(url.pathname.split('/')[3]),
          native = await fetch(issuer + '/v1/connected-apps/activities?eventId=' + event, {
            headers: { authorization },
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
          });
        if (!native.ok) throw new Error('RECEIPT_UNCONFIRMED');
        result = await store.confirm(
          event,
          AppActivityPageSchema.parse(await native.json()),
          actor,
        );
      } else {
        response.statusCode = 404;
        result = { error: 'NOT_FOUND' };
      }
      response.end(JSON.stringify(result));
    } catch {
      response.statusCode = 403;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ error: 'REQUEST_DENIED' }));
    }
  },
);
server.listen(Number(process.env.MINI_APP_PORT ?? 9443), '127.0.0.1');

process.once('SIGTERM', () => {
  server.close(() => {
    store
      .close()
      .then(() => pool?.end())
      .catch(() => {
        process.exitCode = 1;
      });
  });
});
