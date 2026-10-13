import { beforeAll, afterAll, it, expect } from 'vitest';
import { mcpFixture } from '../helpers/mcp-fixture.js';
import { DirectoryService } from '../../services/api/src/mini-apps/directory.js';
import { MiniAppOriginProofSchema } from '../../protocol/mini-apps.js';
import { assertErasureInventory } from '../../services/api/src/account-exit/inventory.js';
let fixture: Awaited<ReturnType<typeof mcpFixture>>;
beforeAll(async () => {
  fixture = await mcpFixture();
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('publishes only proven origins, enforces ownership/transfer/moderation, and creates no native app', async () => {
  const owner = await fixture.paired(),
    successor = await fixture.paired();
  let available = true,
    served: unknown;
  const service = new DirectoryService(
    fixture.pool,
    {
      available: async () => available,
      authorize: async (accountId) =>
        accountId === owner.account.account.id &&
        (await fixture.chain.memberships(owner.account.account)).some(
          (member) => member.admin && member.active && member.dao.daoId === owner.dao.daoId,
        ),
    },
    {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request: async () => ({ status: 200, bytes: Buffer.from(JSON.stringify(served)) }),
    },
  );
  const before = await fixture.chain.connectedApps.registry(owner.dao.daoId);
  const listing = await service.submit(owner.account.account.id, {
    origin: 'https://directory-' + owner.account.account.id + '.example',
    title: '<img src=x onerror=alert(1)>',
    description: 'Owned community app',
    releases: [],
  });
  expect(listing.status).toBe('unverified');
  await expect(
    service.submit(successor.account.account.id, {
      origin: listing.origin,
      title: 'Foreign claim',
      description: 'Duplicate origin',
      releases: [],
    }),
  ).rejects.toMatchObject({ code: 'LISTING_ORIGIN_REGISTERED' });
  await expect(service.update(successor.account.account.id, listing.id, listing)).rejects.toThrow();
  const input = {
    origin: listing.origin,
    title: listing.title,
    description: listing.description,
    releases: [],
  };
  await expect(
    service.update(successor.account.account.id, listing.id, input),
  ).rejects.toMatchObject({ code: 'LISTING_OWNER_REQUIRED' });
  const challenge = await service.verify(owner.account.account.id, listing.id);
  if (challenge.state !== 'challenge') throw Error('Challenge absent');
  served = challenge.proof;
  available = false;
  await expect(service.verify(owner.account.account.id, listing.id, true)).rejects.toMatchObject({
    code: 'LISTING_MODERATION_UNAVAILABLE',
  });
  expect((await service.list({})).listings).not.toContainEqual(
    expect.objectContaining({ id: listing.id }),
  );
  available = true;
  const verified = await service.verify(owner.account.account.id, listing.id, true);
  expect(verified.state).toBe('verified');
  await expect(service.verify(owner.account.account.id, listing.id, true)).rejects.toThrow();
  expect((await service.list({})).listings).toContainEqual(
    expect.objectContaining({ id: listing.id, status: 'published' }),
  );
  await expect(
    service.moderate(successor.account.account.id, listing.id, 'hide'),
  ).rejects.toMatchObject({ code: 'LISTING_MODERATOR_REQUIRED' });
  expect((await service.moderate(owner.account.account.id, listing.id, 'hide')).status).toBe(
    'hidden',
  );
  const renewed = await service.verify(owner.account.account.id, listing.id);
  if (renewed.state !== 'challenge') throw Error('Challenge absent');
  served = renewed.proof;
  const stillHidden = await service.verify(owner.account.account.id, listing.id, true);
  expect(stillHidden).toMatchObject({ state: 'verified', listing: { status: 'hidden' } });
  await service.moderate(owner.account.account.id, listing.id, 'restore');
  await service.report(successor.account.account.id, listing.id, 'Broken login');
  expect((await service.reports(owner.account.account.id, listing.id)).reports).toContainEqual(
    expect.objectContaining({ reason: 'Broken login' }),
  );
  await expect(service.reports(successor.account.account.id, listing.id)).rejects.toMatchObject({
    code: 'LISTING_MODERATOR_REQUIRED',
  });
  await service.transfer(owner.account.account.id, listing.id, successor.account.account.id);
  const transferred = await service.verify(successor.account.account.id, listing.id);
  if (transferred.state !== 'challenge') throw Error('Challenge absent');
  served = transferred.proof;
  await service.verify(successor.account.account.id, listing.id, true);
  await expect(service.update(owner.account.account.id, listing.id, input)).rejects.toMatchObject({
    code: 'LISTING_OWNER_REQUIRED',
  });
  expect((await service.list({ mine: '1' }, successor.account.account.id)).listings).toContainEqual(
    expect.objectContaining({ id: listing.id }),
  );
  expect(await fixture.chain.connectedApps.registry(owner.dao.daoId)).toEqual(before);
  await assertErasureInventory(fixture.pool);
  await service.update(successor.account.account.id, listing.id, input, true);
  expect(
    (await service.list({ mine: '1' }, successor.account.account.id)).listings.some(
      (item) => item.id === listing.id,
    ),
  ).toBe(false);
  await service.cleanup();
  expect(
    (await fixture.pool.query('SELECT 1 FROM mini_app_listings WHERE id=$1', [listing.id]))
      .rowCount,
  ).toBe(0);
});
it('rejects expired/mismatched proof and bounds maintainer submissions', async () => {
  const current = await fixture.paired();
  let served: unknown;
  const service = new DirectoryService(
    fixture.pool,
    { available: async () => true, authorize: async () => false },
    {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request: async () => ({ status: 200, bytes: Buffer.from(JSON.stringify(served)) }),
    },
  );
  const listings = [];
  for (let index = 0; index < 8; index++)
    listings.push(
      await service.submit(current.account.account.id, {
        origin: 'https://bounded-' + current.account.account.id + '-' + index + '.example',
        title: 'Tasks',
        description: 'Community tasks',
        releases: [],
      }),
    );
  await expect(
    service.submit(current.account.account.id, {
      origin: 'https://over-' + current.account.account.id + '.example',
      title: 'Tasks',
      description: 'Community tasks',
      releases: [],
    }),
  ).rejects.toMatchObject({ code: 'LISTING_LIMIT' });
  const first = listings[0];
  if (!first) throw Error('Fixture missing');
  const challenge = await service.verify(current.account.account.id, first.id);
  if (challenge.state !== 'challenge') throw Error('Challenge missing');
  served = MiniAppOriginProofSchema.parse({ ...challenge.proof, challenge: 'f'.repeat(64) });
  await expect(service.verify(current.account.account.id, first.id, true)).rejects.toMatchObject({
    code: 'LISTING_PROOF_INVALID',
  });
  await fixture.pool.query(
    "UPDATE mini_app_directory_proofs SET expires_at=now()-interval '1 second' WHERE listing_id=$1",
    [first.id],
  );
  await expect(service.verify(current.account.account.id, first.id, true)).rejects.toMatchObject({
    code: 'LISTING_PROOF_EXPIRED',
  });
  await service.cleanup();
  expect(
    (
      await fixture.pool.query('SELECT 1 FROM mini_app_directory_proofs WHERE listing_id=$1', [
        first.id,
      ])
    ).rowCount,
  ).toBe(0);
});
it('uses the actual governing DAO and fresh account proof at the HTTP boundary', async () => {
  const { governedDirectoryModeration } =
    await import('../../services/api/src/mini-apps/directory-moderation.js');
  const { createServer } = await import('../../services/api/src/server.js');
  const { controlledInject } = await import('../helpers/account-control.js');
  const { MiniAppDirectoryRoutes } = await import('../../protocol/mini-apps.js');
  const current = await fixture.paired();
  await fixture.native.call('daclifycore', 'setgov', { dao_id: current.dao.daoId });
  const moderation = governedDirectoryModeration(fixture.pool, fixture.chain),
    service = new DirectoryService(fixture.pool, moderation);
  expect(await moderation.available()).toBe(true);
  expect(await moderation.authorize(current.account.account.id)).toBe(true);
  const app = await createServer(fixture.pool, fixture.chain, fixture.frontend, {
    apiOrigin: fixture.api,
    miniAppDirectory: service,
  });
  try {
    expect(
      (await app.inject({ method: 'GET', url: MiniAppDirectoryRoutes.miniAppDirectory.path }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: MiniAppDirectoryRoutes.miniAppDirectory.path + '?mine=1',
        })
      ).statusCode,
    ).toBe(401);
    const listing = await service.submit(current.account.account.id, {
      origin: 'https://http-' + current.account.account.id + '.example',
      title: 'Owned',
      description: 'HTTP boundary',
      releases: [],
    });
    const payload = { id: listing.id, decision: 'hide' };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: MiniAppDirectoryRoutes.miniAppListingModerate.path,
          headers: current.headers,
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const authorized = await controlledInject(app, current.root, {
      method: 'POST',
      url: MiniAppDirectoryRoutes.miniAppListingModerate.path,
      headers: current.headers,
      payload,
    });
    expect(authorized.statusCode, authorized.body).toBe(200);
    expect(
      MiniAppDirectoryRoutes.miniAppListingModerate.response.parse(authorized.json()).status,
    ).toBe('hidden');
    await fixture.native.call('daclifycore', 'setgov', { dao_id: '0' });
    expect(await moderation.available()).toBe(false);
    expect(await moderation.authorize(current.account.account.id)).toBe(false);
  } finally {
    await app.close();
  }
});
