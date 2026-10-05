import { CID } from 'multiformats/cid';
import { sha256, sha512 } from 'multiformats/hashes/sha2';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DaoRefSchema,
  AssetRefSchema,
  ModuleManifestSchema,
  MetadataSchema,
  DocumentSchema,
  parseUnits,
  formatUnits,
  checkedAdd,
  compatible,
  Uint64Schema,
  CidSchema,
} from '../protocol/index.js';

const dao = { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '7', interfaceVersion: 1 };
describe('canonical protocol boundaries', () => {
  it('accepts a namespaced DAO reference', () => expect(DaoRefSchema.parse(dao)).toEqual(dao));
  it.each(['0', '-1', '01', '1.5', '18446744073709551616'])('rejects invalid DAO id %s', (daoId) =>
    expect(DaoRefSchema.safeParse({ ...dao, daoId }).success).toBe(false),
  );
  it.each(['Daclify', 'bad-account', 'longaccountaaa', 'abcdefghijklz'])(
    'rejects noncanonical native account %s',
    (contract) => expect(DaoRefSchema.safeParse({ ...dao, contract }).success).toBe(false),
  );
  it('rejects an unknown authority field', () =>
    expect(DaoRefSchema.safeParse({ ...dao, admin: 'alice' }).success).toBe(false));
  it('rejects a numeric uint64 even when currently small', () =>
    expect(Uint64Schema.safeParse(7).success).toBe(false));
  it('keeps asset identity independent of a ticker', () => {
    const a = AssetRefSchema.parse({
      chainId: dao.chainId,
      contract: 'eosio.token',
      symbol: 'TLOS',
      precision: 4,
    });
    const b = AssetRefSchema.parse({ ...a, contract: 'rogue.token' });
    expect(a).not.toEqual(b);
  });
  it.each([-1, 19, 2.5])('rejects invalid token precision %s', (precision) =>
    expect(
      AssetRefSchema.safeParse({
        chainId: dao.chainId,
        contract: 'eosio.token',
        symbol: 'TLOS',
        precision,
      }).success,
    ).toBe(false),
  );
  it('rejects metadata larger than the contract byte boundary', () =>
    expect(
      MetadataSchema.safeParse({ schemaVersion: 1, title: 'DAO', description: '🙂'.repeat(1500) })
        .success,
    ).toBe(false));
  it('rejects executable metadata fields', () =>
    expect(
      MetadataSchema.safeParse({ schemaVersion: 1, title: 'DAO', script: '<script>' }).success,
    ).toBe(false));
  it('requires a supported CID for an IPFS document', () =>
    expect(
      DocumentSchema.safeParse({
        dao,
        id: '1',
        version: 1,
        cid: 'https://example.com/file',
        commitment: 'ab'.repeat(32),
        size: 4,
        envelopeVersion: 0,
      }).success,
    ).toBe(false));
  it('rejects arbitrary frontend code in module metadata', () =>
    expect(
      ModuleManifestSchema.safeParse({
        id: 'works',
        version: '0.1.0',
        coreRange: '^0.1.0',
        interfaceVersion: 1,
        configVersion: 1,
        capabilities: ['obligation.create'],
        helpTopic: 'works.overview',
        remoteComponent: 'https://evil.example/code.js',
      }).success,
    ).toBe(false));
  it('rejects wildcard authority in module capabilities', () =>
    expect(
      ModuleManifestSchema.safeParse({
        id: 'works',
        version: '0.1.0',
        coreRange: '^0.1.0',
        interfaceVersion: 1,
        configVersion: 1,
        capabilities: ['*'],
        helpTopic: 'works.overview',
      }).success,
    ).toBe(false));
});
describe('checked monetary encoding', () => {
  it('preserves exact precision without floating point', () =>
    expect(parseUnits('900719925474.0991', 4)).toBe(9007199254740991n));
  it.each(['1e3', 'NaN', '-1', '01', '1.00001', '1.', '.5', ' 1'])(
    'rejects noncanonical amount %s',
    (value) => expect(() => parseUnits(value, 4)).toThrow(),
  );
  it('rejects native asset overflow', () =>
    expect(() => checkedAdd((1n << 62n) - 1n, 1n)).toThrow());
  it('rejects a negative balance', () => expect(() => checkedAdd(0n, -1n)).toThrow());
  it('round-trips base units across supported precision', () =>
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: (1n << 62n) - 1n }),
        fc.integer({ min: 0, max: 18 }),
        (units, precision) => parseUnits(formatUnits(units, precision), precision) === units,
      ),
      { numRuns: 400, seed: 20261005 },
    ));
});
describe('contract-compatible content identifiers', () => {
  it('accepts each supported canonical CIDv1 codec with SHA-256', async () => {
    for (const codec of [0x55, 0x70, 0x71])
      expect(
        CidSchema.safeParse(
          CID.createV1(codec, await sha256.digest(new Uint8Array([1]))).toString(),
        ).success,
      ).toBe(true);
  });
  it('rejects a canonical CIDv0 that the contract cannot store', async () => {
    expect(
      CidSchema.safeParse(CID.createV0(await sha256.digest(new Uint8Array([1]))).toString())
        .success,
    ).toBe(false);
  });
  it('rejects unsupported hashes and codecs before signing a contract action', async () => {
    expect(
      CidSchema.safeParse(CID.createV1(0x55, await sha512.digest(new Uint8Array([1]))).toString())
        .success,
    ).toBe(false);
    expect(
      CidSchema.safeParse(CID.createV1(0x0129, await sha256.digest(new Uint8Array([1]))).toString())
        .success,
    ).toBe(false);
  });
});
describe('release compatibility', () => {
  it('supports a tested compatible release range', () =>
    expect(compatible('1.2.3', '^1.2.0')).toBe(true));
  it('rejects an incompatible major', () => expect(compatible('2.0.0', '^1.2.0')).toBe(false));
  it('rejects malformed versions', () => expect(compatible('latest', '*')).toBe(false));
  it('does not enable prerelease capabilities for a stable range', () =>
    expect(compatible('1.3.0-beta.1', '^1.2.0')).toBe(false));
});
