import { z } from 'zod';
import {
  ABI,
  Action,
  Checksum256,
  Name,
  Serializer,
  UInt64,
  UInt128,
  PrivateKey,
  Transaction,
  SignedTransaction,
} from '@wharfkit/antelope';
import {
  QuickAccountContextSchema,
  QuickAccountPreparedSchema,
  QuickAccountProofsSchema,
  type QuickAccountAnchor,
  type QuickAccountPrepared,
} from '../../../../protocol/quick-accounts.js';
import { ChainIdSchema, IdSchema } from '../../../../protocol/base.js';
import { RuntimeCodeHash, RuntimeRawAbiHash, RuntimeTableSchemas } from '../../../../sdk/index.js';
import {
  QuickAuthCodeHash,
  QuickAuthRawAbiHash,
  QuickAuthTableSchemas,
  quickAuthAbi,
  quickAccountAction,
  encodeQuickAnchor,
} from '../../../../sdk/quick-accounts.js';
import { QuickBallotRoutes } from '@daclify/modules';
import {
  ModuleCodeHashes,
  QuickBallotTableSchemas,
  quickvoteAbi,
  encodeQuickBallot,
  verifyQuickBallotResult,
} from '@daclify/modules/sdk';
import { createRpcClient } from '../rpc.js';
import { ApiError } from '../errors.js';
import { validEncryptionKey } from '../auth.js';
import { NativeProofSchema } from '../../../../protocol/sign-in.js';
import { ExitSubmissionSchema, type ExitSubmission } from '../../../../protocol/account-exit.js';
import { executedChainResult } from '../chain-result.js';
import { reconcileChainSubmission } from '../chain-confirmation.js';

const maxId = '18446744073709551615';
const ConfigurationSchema = QuickAccountContextSchema.omit({
  anchor: true,
  identity: true,
  frozen: true,
  record: true,
});
const NativeConfigurationSchema = ConfigurationSchema.pick({
  chainId: true,
  runtime: true,
  authority: true,
  source: true,
  gateway: true,
}).extend({ rpcUrl: z.url() });
type NativeConfiguration = z.infer<typeof NativeConfigurationSchema>;
const sourceAbiHash = Checksum256.hash(
  Serializer.encode({ object: ABI.from(quickvoteAbi) }),
).toString();

export class NativeQuickBallots {
  private readonly config: NativeConfiguration;
  private readonly api;
  constructor(
    value: NativeConfiguration,
    private readonly operator: {
      key: PrivateKey;
      resources: () => Promise<void>;
      confirm: (block: number) => Promise<void>;
    },
  ) {
    this.config = NativeConfigurationSchema.parse(value);
    const url = new URL(value.rpcUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
    )
      throw new Error('RPC_PUBLIC_ENDPOINT_REQUIRED');
    this.api = createRpcClient(value.rpcUrl);
  }
  async prepareSubmission(
    value: QuickAccountPrepared,
    proofs: unknown,
    nativeValue?: unknown,
  ): Promise<ExitSubmission> {
    await this.configuration();
    await this.operator.resources();
    const prepared = QuickAccountPreparedSchema.parse(value),
      action = quickAccountAction(prepared, proofs),
      info = await this.api.v1.chain.get_info();
    const nativeRequired = action.authorization.some(
      (permission) =>
        permission.actor.toString() !== this.config.gateway.actor ||
        permission.permission.toString() !== this.config.gateway.permission,
    );
    let transaction: Transaction,
      signatures: string[] = [];
    if (nativeValue !== undefined) {
      if (!nativeRequired) throw new ApiError('QUICK_NATIVE_PACKET', 403);
      const native = NativeProofSchema.parse(nativeValue);
      transaction = Serializer.decode({ type: Transaction, data: native.packedTransaction });
      if (Serializer.encode({ object: transaction }).hexString !== native.packedTransaction)
        throw new ApiError('QUICK_NATIVE_PACKET', 403);
      signatures = native.signatures;
    } else {
      if (nativeRequired) throw new ApiError('NATIVE_PROOF_REQUIRED', 409);
      transaction = Transaction.from({ ...info.getTransactionHeader(60), actions: [action] });
    }
    if (
      transaction.actions.length !== 1 ||
      !transaction.actions[0]?.equals(action) ||
      transaction.context_free_actions.length ||
      transaction.transaction_extensions.length ||
      Number(transaction.delay_sec) !== 0 ||
      transaction.expiration.toMilliseconds() <= Date.now() ||
      transaction.expiration.toMilliseconds() > Date.now() + 61000 ||
      transaction.expiration.toMilliseconds() > Date.parse(prepared.expiresAt)
    )
      throw new ApiError('QUICK_NATIVE_PACKET', 403);
    const signed = SignedTransaction.from({
      ...transaction,
      signatures: [
        ...signatures,
        this.operator.key.signDigest(transaction.signingDigest(this.config.chainId)).toString(),
      ],
    });
    return ExitSubmissionSchema.parse({
      transactionId: transaction.id.toString(),
      packet: Serializer.encode({ object: signed }).hexString,
      firstBlock: info.head_block_num.toNumber(),
      cursor: info.head_block_num.toNumber(),
      expiresAt: transaction.expiration.toDate().toISOString(),
    });
  }
  private packet(value: QuickAccountPrepared, input: ExitSubmission) {
    const prepared = QuickAccountPreparedSchema.parse(value),
      packet = ExitSubmissionSchema.parse(input),
      transaction = Serializer.decode({ type: SignedTransaction, data: packet.packet });
    if (
      Serializer.encode({ object: transaction }).hexString !== packet.packet ||
      transaction.id.toString() !== packet.transactionId ||
      transaction.actions.length !== 1 ||
      transaction.signatures.length < 1 ||
      transaction.signatures.length > 9 ||
      transaction.context_free_actions.length ||
      transaction.context_free_data.length ||
      transaction.transaction_extensions.length ||
      Number(transaction.delay_sec) !== 0 ||
      transaction.expiration.toDate().toISOString() !== packet.expiresAt
    )
      throw new ApiError('QUICK_NATIVE_PACKET', 403);
    const action = transaction.actions[0];
    if (
      !action ||
      action.account.toString() !== this.config.authority ||
      action.name.toString() !== prepared.action
    )
      throw new ApiError('QUICK_NATIVE_PACKET', 403);
    // Compare original action bytes; objectified uint64 fields can become JSON numbers.
    const data = z
      .object({
        proof: QuickAccountProofsSchema.shape.proof,
        incoming: QuickAccountProofsSchema.shape.incoming.optional(),
      })
      .parse(
        Serializer.objectify(
          Serializer.decode({
            abi: ABI.from(quickAuthAbi),
            type: prepared.action,
            data: action.data,
          }),
        ),
      );
    const expected = quickAccountAction(prepared, {
      proof: data.proof,
      incoming: data.incoming ?? '',
    });
    if (
      !action.equals(expected) ||
      !transaction.signatures.some((signature) =>
        signature.verifyDigest(
          transaction.transaction.signingDigest(this.config.chainId),
          this.operator.key.toPublic(),
        ),
      )
    )
      throw new ApiError('QUICK_NATIVE_PACKET', 403);
    return { transaction, packet };
  }
  async submit(
    prepared: QuickAccountPrepared,
    input: ExitSubmission,
  ): Promise<{ transactionId: string }> {
    const { transaction, packet } = this.packet(prepared, input);
    await this.configuration();
    await this.operator.resources();
    const result = executedChainResult(
      await this.api.v1.chain.push_transaction(transaction),
      packet.transactionId,
    );
    await this.operator.confirm(result.blockNum);
    return { transactionId: result.transactionId };
  }
  async reconcile(prepared: QuickAccountPrepared, input: ExitSubmission) {
    const { packet } = this.packet(prepared, input);
    await this.configuration();
    return reconcileChainSubmission(this.api, this.config.chainId, packet);
  }
  private async page<T>(
    code: string,
    scope: string,
    table: string,
    schema: z.ZodType<T>,
    lower: string,
    upper: string,
    index: 1 | 2 | 3 = 1,
    keyType: 'i64' | 'i128' | 'sha256' = 'i64',
    limit = 26,
  ) {
    const bound = (value: string) =>
      keyType === 'sha256'
        ? Checksum256.from(value)
        : keyType === 'i128'
          ? UInt128.from(value)
          : UInt64.from(value);
    const response = await this.api.v1.chain.get_table_rows({
      code,
      scope,
      table,
      json: true,
      index_position: index === 1 ? 'primary' : index === 2 ? 'secondary' : 'tertiary',
      key_type: keyType,
      limit,
      lower_bound: bound(lower),
      upper_bound: bound(upper),
    });
    const parsed = z
      .object({ rows: z.array(schema).max(limit), more: z.boolean() })
      .safeParse(response);
    if (!parsed.success) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return parsed.data;
  }
  async configuration() {
    const config = this.config;
    const [info, runtime, auth, source, settings, clock] = await Promise.all([
      this.api.v1.chain.get_info(),
      this.api.v1.chain.get_raw_abi(config.runtime),
      this.api.v1.chain.get_raw_abi(config.authority),
      this.api.v1.chain.get_raw_abi(config.source),
      this.page(
        config.authority,
        config.runtime,
        'qcfg',
        QuickAuthTableSchemas.qcfg,
        '0',
        '0',
        1,
        'i64',
        1,
      ),
      this.page(
        config.source,
        config.runtime,
        'qclock',
        QuickBallotTableSchemas.qclock,
        '0',
        '0',
        1,
        'i64',
        1,
      ),
    ]);
    const upstream = settings.rows[0],
      local = clock.rows[0];
    if (
      info.chain_id.toString() !== config.chainId ||
      runtime.code_hash.toString() !== RuntimeCodeHash ||
      runtime.abi_hash.toString() !== RuntimeRawAbiHash ||
      auth.code_hash.toString() !== QuickAuthCodeHash ||
      auth.abi_hash.toString() !== QuickAuthRawAbiHash ||
      source.code_hash.toString() !== ModuleCodeHashes['quick-ballots'] ||
      source.abi_hash.toString() !== sourceAbiHash ||
      settings.more ||
      clock.more ||
      !upstream ||
      !local ||
      upstream.source !== config.source ||
      upstream.code_hash !== ModuleCodeHashes['quick-ballots'] ||
      upstream.gateway.actor !== config.gateway.actor ||
      upstream.gateway.permission !== config.gateway.permission ||
      local.authority !== config.authority ||
      local.authority_hash !== QuickAuthCodeHash
    )
      throw new ApiError('QUICK_UNAVAILABLE', 503);
    return ConfigurationSchema.parse({
      chainId: config.chainId,
      runtime: config.runtime,
      authority: config.authority,
      authorityCodeHash: QuickAuthCodeHash,
      source: config.source,
      sourceCodeHash: ModuleCodeHashes['quick-ballots'],
      gateway: config.gateway,
    });
  }
  async account(identityValue: string) {
    const identity = ChainIdSchema.parse(identityValue);
    await this.configuration();
    const page = await this.page(
      this.config.authority,
      this.config.runtime,
      'qaccounts',
      QuickAuthTableSchemas.qaccounts,
      identity,
      'ff'.repeat(32),
      2,
      'sha256',
      1,
    );
    return page.rows.find((row) => row.identity === identity) ?? null;
  }
  async defaultOwner(method: QuickAccountAnchor) {
    await this.configuration();
    const expected = encodeQuickAnchor(method);
    // shortcut: scan at most5000 current defaults only during setup; index if the registry cap grows.
    let after = 0n,
      visited = 0;
    while (visited < 5000) {
      const page = await this.page(
        this.config.authority,
        this.config.runtime,
        'qaccounts',
        QuickAuthTableSchemas.qaccounts,
        String(after + 1n),
        maxId,
        1,
        'i64',
        Math.min(100, 5000 - visited),
      );
      for (const row of page.rows) {
        if (BigInt(row.id) <= after) throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
        after = BigInt(row.id);
        ++visited;
        if (
          row.active &&
          row.approval.kind === expected.kind &&
          row.approval.credential === expected.credential
        )
          return row.identity;
      }
      if (!page.more) return null;
      if (!page.rows.length) break;
    }
    throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
  }
  async list(value: unknown) {
    const query = QuickBallotRoutes.quickList.query.parse(value),
      config = await this.configuration();
    const after = BigInt(query.after ?? '0'),
      base = query.daoId ? BigInt(query.daoId) << 64n : 0n;
    const page =
      after === BigInt(maxId)
        ? { rows: [], more: false }
        : await this.page(
            config.source,
            config.runtime,
            'qballots',
            QuickBallotTableSchemas.qballots,
            String(base + after + 1n),
            String(base + BigInt(maxId)),
            query.daoId ? 2 : 1,
            query.daoId ? 'i128' : 'i64',
          );
    if (page.rows.some((row) => query.daoId && row.dao_id !== query.daoId))
      throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return QuickBallotRoutes.quickList.response.parse({
      available: true,
      experimental: true,
      domain: { chainId: config.chainId, runtime: config.runtime, source: config.source },
      ballots: page.rows.slice(0, 25),
      next: page.more || page.rows.length > 25 ? (page.rows[24]?.id ?? null) : null,
    });
  }
  async detail(idValue: string) {
    const id = IdSchema.parse(idValue),
      config = await this.configuration();
    const [ballots, grants] = await Promise.all([
      this.page(
        config.source,
        config.runtime,
        'qballots',
        QuickBallotTableSchemas.qballots,
        id,
        id,
        1,
        'i64',
        1,
      ),
      this.page(
        config.source,
        config.runtime,
        'qgrants',
        QuickBallotTableSchemas.qgrants,
        id,
        id,
        1,
        'i64',
        1,
      ),
    ]);
    const ballot = ballots.rows.find((row) => row.id === id);
    if (!ballot) throw new ApiError('QUICK_BALLOT_UNKNOWN', 404);
    return QuickBallotRoutes.quickDetail.response.parse({
      chainId: config.chainId,
      runtime: config.runtime,
      source: config.source,
      ballot,
      grants: grants.rows.find((row) => row.id === id) ?? null,
    });
  }
  async responses(idValue: string, value: unknown) {
    const id = IdSchema.parse(idValue),
      query = QuickBallotRoutes.quickResponses.query.parse(value),
      { ballot } = await this.detail(id);
    const after = BigInt(query.after ?? '0'),
      base = BigInt(id) << 64n;
    const page =
      after === BigInt(maxId)
        ? { rows: [], more: false }
        : await this.page(
            this.config.source,
            this.config.runtime,
            'qresponses',
            QuickBallotTableSchemas.qresponses,
            String(base + after + 1n),
            String(base + BigInt(maxId)),
            3,
            'i128',
          );
    if (page.rows.some((row) => row.ballot_id !== id || row.dao_id !== ballot.dao_id))
      throw new ApiError('CHAIN_RESPONSE_INVALID', 503);
    return QuickBallotRoutes.quickResponses.response.parse({
      responses: page.rows.slice(0, 25),
      next: page.more || page.rows.length > 25 ? (page.rows[24]?.id ?? null) : null,
      pruned: ballot.pruned,
      root: ballot.response_root,
    });
  }
  private async maintenance(name: 'prepare' | 'finalize', data: Uint8Array) {
    await this.configuration();
    await this.operator.resources();
    const info = await this.api.v1.chain.get_info(),
      action = Action.from({
        account: this.config.source,
        name,
        authorization: [this.config.gateway],
        data,
      }),
      transaction = Transaction.from({ ...info.getTransactionHeader(60), actions: [action] });
    const signed = SignedTransaction.from({
      ...transaction,
      signatures: [this.operator.key.signDigest(transaction.signingDigest(this.config.chainId))],
    });
    const result = executedChainResult(
      await this.api.v1.chain.push_transaction(signed),
      transaction.id.toString(),
    );
    await this.operator.confirm(result.blockNum);
    return result.transactionId;
  }
  async needsAdvance(ballot: z.infer<typeof QuickBallotTableSchemas.qballots>) {
    if (ballot.closed_at) return true;
    const info = await this.api.v1.chain.get_info();
    if (
      ballot.definition.closes &&
      ballot.definition.closes <= Math.floor(info.head_block_time.toDate().getTime() / 1000)
    )
      return true;
    const [life, module] = await Promise.all([
      this.page(
        this.config.runtime,
        this.config.runtime,
        'daolife',
        RuntimeTableSchemas.daolife,
        ballot.dao_id,
        ballot.dao_id,
        1,
        'i64',
        1,
      ),
      this.page(
        this.config.runtime,
        ballot.dao_id,
        'modules',
        RuntimeTableSchemas.modules,
        Name.from(this.config.source).value.toString(),
        maxId,
        1,
        'i64',
        1,
      ),
    ]);
    return (
      life.rows.some((row) => row.dao_id === ballot.dao_id && row.state !== 0) ||
      !module.rows.some((row) => row.account === this.config.source && row.actions.length > 0)
    );
  }
  async advance(idValue: string) {
    const { ballot } = await this.detail(idValue);
    if (ballot.prepared || !(await this.needsAdvance(ballot)))
      return { transactionId: null, prepared: ballot.prepared };
    const transactionId = await this.maintenance(
      'prepare',
      encodeQuickBallot('prepare', {
        runtime: this.config.runtime,
        ballot_id: ballot.id,
        limit: 25,
      }),
    );
    return QuickBallotRoutes.quickAdvance.response.parse({
      transactionId,
      prepared: (await this.detail(ballot.id)).ballot.prepared,
    });
  }
  async finalize(idValue: string, value: unknown) {
    const input = QuickBallotRoutes.quickFinalize.input.parse(value),
      detail = await this.detail(idValue),
      { ballot } = detail;
    if (
      ballot.definition_hash !== input.expectedDefinitionHash ||
      ballot.response_root !== input.expectedRoot ||
      !ballot.prepared
    )
      throw new ApiError('QUICK_SNAPSHOT_CHANGED', 409);
    try {
      verifyQuickBallotResult({
        chainId: detail.chainId,
        runtime: detail.runtime,
        source: detail.source,
        ballot: { ...ballot, up: input.up, final_proof: input.proof, verified: true },
      });
    } catch {
      throw new ApiError('QUICK_TALLY_PROOF', 409);
    }
    if (ballot.verified) {
      if (ballot.up !== input.up || ballot.final_proof !== input.proof)
        throw new ApiError('QUICK_FINALIZED', 409);
      return { transactionId: null, prepared: true };
    }
    const transactionId = await this.maintenance(
      'finalize',
      encodeQuickBallot('finalize', {
        runtime: this.config.runtime,
        ballot_id: ballot.id,
        up: input.up,
        proof: input.proof,
      }),
    );
    return QuickBallotRoutes.quickFinalize.response.parse({ transactionId, prepared: true });
  }
  async dueBallots() {
    await this.configuration();
    const info = await this.api.v1.chain.get_info();
    return (
      await this.page(
        this.config.source,
        this.config.runtime,
        'qballots',
        QuickBallotTableSchemas.qballots,
        '1',
        String(Math.floor(info.head_block_time.toDate().getTime() / 1000)),
        3,
        'i64',
        25,
      )
    ).rows.map((row) => row.id);
  }
  async ownResponse(idValue: string, value: unknown) {
    const id = IdSchema.parse(idValue),
      query = QuickBallotRoutes.quickOwnResponse.query.parse(value);
    await this.detail(id);
    const packed = Serializer.encode({ object: UInt64.from(id) }).hexString + query.identity,
      key = Checksum256.hash(Buffer.from(packed, 'hex')).toString();
    const page = await this.page(
      this.config.source,
      this.config.runtime,
      'qresponses',
      QuickBallotTableSchemas.qresponses,
      key,
      'ff'.repeat(32),
      2,
      'sha256',
      1,
    );
    return QuickBallotRoutes.quickOwnResponse.response.parse({
      response:
        page.rows.find((row) => row.ballot_id === id && row.identity === query.identity) ?? null,
    });
  }
  async readers(daoValue: string) {
    const dao = IdSchema.parse(daoValue),
      config = await this.configuration();
    const [offices, policies, info] = await Promise.all([
      this.page(
        config.runtime,
        dao,
        'executives',
        RuntimeTableSchemas.executives,
        '0',
        maxId,
        1,
        'i64',
        8,
      ),
      this.page(
        config.runtime,
        config.runtime,
        'execpols',
        RuntimeTableSchemas.execpols,
        dao,
        dao,
        1,
        'i64',
        1,
      ),
      this.api.v1.chain.get_info(),
    ]);
    const policy = policies.rows.find((row) => row.dao_id === dao),
      now = Math.floor(info.head_block_time.toDate().getTime() / 1000);
    if (!policy || offices.more) throw new ApiError('EXECUTIVE_REQUIRED', 409);
    const readers = [];
    for (const office of offices.rows) {
      if (
        office.last_active > now ||
        (policy.inactivity_seconds && now - office.last_active >= policy.inactivity_seconds)
      )
        continue;
      const page = await this.page(
          config.runtime,
          dao,
          'members',
          RuntimeTableSchemas.members,
          office.member_id,
          office.member_id,
          1,
          'i64',
          1,
        ),
        member = page.rows.find((row) => row.id === office.member_id);
      if (!member?.active) continue;
      try {
        if (new TextEncoder().encode(member.encryption_key).length > 256) throw Error('KEY_SIZE');
        validEncryptionKey(JSON.parse(member.encryption_key));
      } catch {
        throw new ApiError('QUICK_READER_KEY', 409);
      }
      readers.push({ member_id: member.id, encryption_key: member.encryption_key });
    }
    if (!readers.length) throw new ApiError('EXECUTIVE_REQUIRED', 409);
    return QuickBallotRoutes.quickReaders.response.parse({
      dao: { chainId: config.chainId, contract: config.runtime, daoId: dao, interfaceVersion: 1 },
      readers,
    });
  }
}
