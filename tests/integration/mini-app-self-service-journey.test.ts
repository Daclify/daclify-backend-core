import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { createRecoveryRecipient } from '../../sdk/recovery.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mcpFixture } from '../helpers/mcp-fixture.js';
import { ProfileKeys } from '../../services/api/src/profiles/keys.js';
import { Pool } from 'pg';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { nativeModules } from '../helpers/native-contracts.js';
import { FileProfileExclusions } from '../../services/api/src/profiles/exclusions.js';
import { AccountExit } from '../../services/api/src/account-exit/service.js';
import { ProfileContextSchema } from '../../protocol/profiles.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import {
  encryptProfile,
  profileCiphertextCommitment,
  sealProfileKey,
  openProfileKey,
  decryptProfile,
} from '../../sdk/profiles.js';
import {
  encodeAction,
  exitOperationCommitment,
  exitStepCommitment,
  exitInstructionDigest,
} from '../../sdk/index.js';
import { LocalCommunityClient } from '../../packages/community-mcp/src/local-client.js';
let fixture: Awaited<ReturnType<typeof mcpFixture>>;
beforeAll(async () => {
  fixture = await mcpFixture();
}, 90000);
afterAll(async () => {
  await fixture?.stop();
}, 30000);
it('completes native profile key writes, reads and removal with one available database connection', async () => {
  const current = await fixture.paired(),
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 1000,
    }),
    directory = await mkdtemp(join(tmpdir(), 'owned-profile-pool-')),
    exclusions = new FileProfileExclusions(directory);
  try {
    const chain = new NativeChainGateway(
        {
          rpcUrl: fixture.native.url,
          chainId: fixture.native.chainId,
          runtime: 'daclifycore',
          hub: 'daclifyhub',
          environment: 'local',
          relayActor: 'relay',
          relayKey: fixture.native.key('relay'),
          modules: nativeModules,
        },
        pool,
      ),
      profiles = new ProfileKeys(pool, chain, { backupRetentionSeconds: 86400, exclusions });
    const context = ProfileContextSchema.parse({
        version: 2,
        chainId: current.dao.reference.chainId,
        runtime: current.dao.reference.contract,
        daoId: current.dao.daoId,
        memberId: '1',
        profileRevision: randomUUID(),
      }),
      key = Uint8Array.from(randomBytes(32)),
      cipher = await encryptProfile(
        new TextEncoder().encode('Owned single connection profile'),
        key,
        context,
      ),
      commitment = await profileCiphertextCommitment(cipher),
      grant = await sealProfileKey(
        key,
        EncryptionPublicKeySchema.parse(current.account.account.encryptionKey),
        context,
        commitment,
      );
    await profiles.put(current.account.account.id, [grant]);
    await current.dao.act(
      'daclifycore',
      'setencprof',
      encodeAction('setencprof', {
        actor: current.dao.actor(),
        account_name:
          'p' + current.dao.daoId.replace(/[0-9]/g, (digit) => 'abcdefghij'[Number(digit)] ?? 'a'),
        profile: JSON.stringify(cipher),
      }),
    );
    expect(await profiles.reconcile(context)).toBe('completed');
    expect(await profiles.get(current.account.account.id, context)).toEqual(grant);
    await profiles.remove(current.account.account.id, context);
  } finally {
    await pool.end();
    await exclusions.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
it('renews an AI connection after expired delegates fill its member slots without operator help', async () => {
  const current = await fixture.paired();
  for (let id = 1; id <= 15; id++)
    await current.dao.act(
      'daclifycore',
      'addsession',
      encodeAction('addsession', {
        ...current.dao.actor(),
        session_id: String(id),
        signing_key: PrivateKey.generate('K1').toPublic().toString(),
        expires: Math.floor(Date.now() / 1000) + 4,
        permissions: [{ target: 'decide', action: 'vote', code_hash: ModuleCodeHashes.decide }],
      }),
    );
  await new Promise((resolve) => setTimeout(resolve, 4500));
  const nonce = (await current.dao.member()).nonce,
    delegate = PrivateKey.generate('K1'),
    verifier = randomBytes(32).toString('base64url');
  const request = await fixture.pairings.begin({
    dao: current.dao.reference,
    memberId: '1',
    scopes: ['vote'],
    delegatePublicKey: delegate.toPublic().toString(),
    codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
  });
  const consent = await fixture.pairings.consent(current.account.account, request.id);
  expect(
    (await fixture.chain.governance(current.dao.daoId)).sessions.map((value) => value.id),
  ).toEqual(['701']);
  expect((await current.dao.member()).nonce).toBe(nonce);
  await current.dao.act(
    'daclifycore',
    'addsession',
    encodeAction('addsession', {
      ...current.dao.actor(),
      session_id: '702',
      signing_key: delegate.toPublic().toString(),
      expires: consent.grantExpires,
      permissions: consent.permissions,
    }),
  );
}, 60000);
it('measures a real 64-recipient audience without multiplying the native ciphertext', async () => {
  const recipients = await Promise.all(Array.from({ length: 63 }, () => createRecoveryRecipient()));
  const current = await fixture.paired(
      0,
      recipients.map((value) => JSON.stringify(value.publicKey)),
    ),
    directory = await mkdtemp(join(tmpdir(), 'owned-profile-audience-')),
    exclusions = new FileProfileExclusions(directory);
  try {
    const context = ProfileContextSchema.parse({
        version: 2,
        chainId: current.dao.reference.chainId,
        runtime: current.dao.reference.contract,
        daoId: current.dao.daoId,
        memberId: '1',
        profileRevision: randomUUID(),
      }),
      key = Uint8Array.from(randomBytes(32)),
      cipher = await encryptProfile(
        new TextEncoder().encode('Owned 64-recipient synthetic profile'),
        key,
        context,
      ),
      commitment = await profileCiphertextCommitment(cipher);
    const grants = await Promise.all(
      [
        EncryptionPublicKeySchema.parse(current.account.account.encryptionKey),
        ...recipients.map((value) => value.publicKey),
      ].map((value) => sealProfileKey(key, value, context, commitment)),
    );
    const profiles = new ProfileKeys(fixture.pool, fixture.chain, {
      backupRetentionSeconds: 86400,
      exclusions,
    });
    await profiles.put(current.account.account.id, grants);
    await current.dao.act(
      'daclifycore',
      'setencprof',
      encodeAction('setencprof', {
        actor: current.dao.actor(),
        account_name:
          'p' + current.dao.daoId.replace(/[0-9]/g, (digit) => 'abcdefghij'[Number(digit)] ?? 'a'),
        profile: JSON.stringify(cipher),
      }),
    );
    expect(await profiles.reconcile(context)).toBe('completed');
    const measurement = await fixture.pool.query<{ bytes: number; count: number }>(
      'SELECT pg_column_size(grants) AS bytes,jsonb_array_length(grants) AS count FROM profile_key_revisions WHERE owner_account_id=$1',
      [current.account.account.id],
    );
    expect(measurement.rows[0]?.count).toBe(64);
    await writeFile(
      '.artifacts/mini-app-audience-native.json',
      JSON.stringify(
        {
          recipients: 64,
          wrappedGrantsJsonBytes: Buffer.byteLength(JSON.stringify(grants)),
          storedGrantsBytes: measurement.rows[0]?.bytes,
          nativeCiphertextBytes: Buffer.byteLength(JSON.stringify(cipher)),
          nativeProfileRows: 1,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await exclusions.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 90000);
it('publishes an encrypted native profile with a controlled audience and erases its hosted identity and MCP access without reviving ownership', async () => {
  const current = await fixture.paired(),
    directory = await mkdtemp(join(tmpdir(), 'owned-profile-journey-')),
    exclusions = new FileProfileExclusions(directory);
  try {
    const context = ProfileContextSchema.parse({
        version: 2,
        chainId: current.dao.reference.chainId,
        runtime: current.dao.reference.contract,
        daoId: current.dao.daoId,
        memberId: '1',
        profileRevision: randomUUID(),
      }),
      key = Uint8Array.from(randomBytes(32)),
      privateText = 'Owned synthetic confidential profile';
    const cipher = await encryptProfile(new TextEncoder().encode(privateText), key, context),
      commitment = await profileCiphertextCommitment(cipher),
      grant = await sealProfileKey(
        key,
        EncryptionPublicKeySchema.parse(current.account.account.encryptionKey),
        context,
        commitment,
      );
    const profiles = new ProfileKeys(fixture.pool, fixture.chain, {
      backupRetentionSeconds: 86400,
      exclusions,
    });
    await profiles.put(current.account.account.id, [grant]);
    await current.dao.act(
      'daclifycore',
      'setencprof',
      encodeAction('setencprof', {
        actor: current.dao.actor(),
        account_name: 'alice',
        profile: JSON.stringify(cipher),
      }),
    );
    expect(await profiles.reconcile(context)).toBe('completed');
    expect(await profiles.get(current.account.account.id, context)).toEqual(grant);
    const opened = await openProfileKey(grant, current.encryptionPrivateKey, context, commitment);
    expect(new TextDecoder().decode(await decryptProfile(cipher, opened, context))).toBe(
      privateText,
    );
    const publicPage = await fixture.chain.people({ daoId: current.dao.daoId });
    expect(JSON.stringify(publicPage)).not.toContain(privateText);
    expect(JSON.stringify(publicPage)).not.toContain(cipher.ciphertext);
    const client = new LocalCommunityClient({
      version: 1,
      api: fixture.api,
      grantToken: current.grant.token,
      delegateKey: current.delegate.toString(),
      grantId: current.grant.grant.id,
    });
    expect(await client.status()).toMatchObject({ id: current.grant.grant.id });
    await current.dao.act(
      'daclifycore',
      'setroles',
      encodeAction('setroles', {
        ...current.dao.actor(),
        target: '2',
        admin: true,
        reviewer: true,
      }),
    );
    const nativeBefore = await current.dao.member();
    const exit = new AccountExit(fixture.pool, fixture.chain, {
        backupRetentionSeconds: 86400,
        profileExclusions: exclusions,
      }),
      operation = await exit.begin(
        current.account.account.id,
        {
          version: 1,
          mode: 'delete-account',
          memberships: [
            {
              chainId: context.chainId,
              runtime: context.runtime,
              daoId: context.daoId,
              memberId: '1',
              choice: 'leave',
            },
          ],
        },
        { reauthenticated: true },
      );
    await exit.eraseHosted(operation.id);
    await expect(client.status()).rejects.toThrow();
    await expect(profiles.get(current.account.account.id, context)).rejects.toThrow();
    expect(
      (
        await fixture.pool.query('SELECT erasure_state FROM accounts WHERE id=$1', [
          current.account.account.id,
        ])
      ).rows[0],
    ).toMatchObject({ erasure_state: 'erased' });
    expect(
      (
        await fixture.pool.query('SELECT 1 FROM mcp_local_grants WHERE account_id=$1', [
          current.account.account.id,
        ])
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await fixture.pool.query('SELECT 1 FROM profile_key_revisions WHERE owner_account_id=$1', [
          current.account.account.id,
        ])
      ).rowCount,
    ).toBe(0);
    for (const action of ['delprofile', 'leave'] as const) {
      const payload =
        action === 'delprofile'
          ? encodeAction('delprofile', { actor: current.dao.actor() })
          : encodeAction('leave', current.dao.actor());
      const request = await current.dao.request('daclifycore', action, payload),
        stepId = 'journey-' + action,
        operationCommitment = exitOperationCommitment(operation.id),
        stepDigest = exitStepCommitment(operation.id, stepId, request),
        signed = {
          operation: operationCommitment,
          step_digest: stepDigest,
          request,
          sig: current.root
            .signDigest(exitInstructionDigest(operationCommitment, stepDigest, request))
            .toString(),
        };
      await exit.submitNativeStep(operation.id, stepId, signed);
      const nonce = (await current.dao.member()).nonce;
      await exit.submitNativeStep(operation.id, stepId, signed);
      expect((await current.dao.member()).nonce).toBe(nonce);
    }
    const nativeAfter = await current.dao.member();
    expect(nativeAfter.active).toBe(false);
    expect(nativeAfter.claim).toBe(nativeBefore.claim);
    expect(nativeAfter.stake).toBe(nativeBefore.stake);
    expect((await fixture.chain.memberProfile(context.daoId, '1')).profile).toBeNull();
    expect(await exit.status(operation.statusCapability)).toMatchObject({ id: operation.id });
  } finally {
    await exclusions.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
