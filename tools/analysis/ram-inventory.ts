// Static review evidence, not a C++ parser or proof that every lifecycle is qualified.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { runtimeAbi, RuntimeCodeHash } from '../../sdk/index.js';
import {
  decideAbi,
  worksAbi,
  payrollAbi,
  grantsAbi,
  endorseAbi,
  ModuleCodeHashes,
} from '@daclify/modules/sdk';

const producers = [
  { name: 'runtime', abi: runtimeAbi, codeHash: RuntimeCodeHash },
  { name: 'decide', abi: decideAbi, codeHash: ModuleCodeHashes.decide },
  { name: 'works', abi: worksAbi, codeHash: ModuleCodeHashes.works },
  { name: 'payroll', abi: payrollAbi, codeHash: ModuleCodeHashes.payroll },
  { name: 'grants', abi: grantsAbi, codeHash: ModuleCodeHashes['grants-rounds'] },
  { name: 'endorse', abi: endorseAbi, codeHash: ModuleCodeHashes['endorsement-admission'] },
];
const roots = [
  { label: 'core', path: 'contracts' },
  { label: 'modules', path: '../daclify-backend-modules/contracts' },
];
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path + '/' + entry.name)
      : /\.(cpp|hpp)$/.test(entry.name)
        ? [path + '/' + entry.name]
        : [],
  );
}
const sources = roots
  .flatMap((root) =>
    files(root.path)
      .sort()
      .map((path) => ({
        path: root.label + '/' + path.slice(root.path.length + 1),
        text: readFileSync(path, 'utf8'),
      })),
  )
  .filter((source) => !source.path.endsWith('/json.hpp'));
const abiSchema = z.object({
  tables: z.array(z.object({ name: z.string(), type: z.string() })),
  structs: z.array(
    z.object({
      name: z.string(),
      base: z.string(),
      fields: z.array(z.object({ name: z.string(), type: z.string() })),
    }),
  ),
});
const categorySource = readFileSync('contracts/common/resources.hpp', 'utf8');
const scopedSource = readFileSync('contracts/common/ram_table.hpp', 'utf8')
  .split('bool scoped()const{')[1]
  ?.split('void delta(')[0];
assert.ok(scopedSource);
const categories = new Map<string, number>();
for (const match of categorySource.matchAll(/((?:case "[a-z1-5]+"_n\.value:)+)return ([0-3]);/g)) {
  for (const table of match[1]?.matchAll(/"([a-z1-5]+)"_n/g) ?? [])
    if (table[1]) categories.set(table[1], Number(match[2]));
}
assert.equal(categories.get('members'), 0);
assert.equal(categories.get('obligations'), 2);
const tables = producers.flatMap((producer) => {
  const abi = abiSchema.parse(producer.abi);
  assert.equal(new Set(abi.tables.map((table) => table.name)).size, abi.tables.length);
  return abi.tables.map((table) => {
    const row = abi.structs.find((struct) => struct.name === table.type);
    assert.ok(row, `Missing canonical row: ${producer.name}/${table.name}`);
    const declarations = sources.flatMap((source) =>
      [
        ...source.text.matchAll(
          new RegExp(
            '(?:ram_table|ram_singleton|(?:eosio::)?multi_index|(?:eosio::)?singleton)<"' +
              table.name +
              '"_n,([^;]+);',
            'g',
          ),
        ),
      ]
        .filter((match) => match[1]?.includes(table.type))
        .map((match) => ({
          source: source.path,
          line: source.text.slice(0, match.index).split('\n').length,
          declaration: match[0],
        })),
    );
    assert.ok(declarations.length, `Unmapped table declaration: ${producer.name}/${table.name}`);
    const secondaryKeyBytes = [
      ...(declarations[0]?.declaration ?? '').matchAll(/const_mem_fun<\w+,\s*(\w+),/g),
    ].map((match) => {
      const bytes = { uint64_t: 8, uint128_t: 16, checksum256: 32 }[match[1] ?? ''];
      assert.ok(bytes, `Unqualified secondary key: ${match[1]}`);
      return bytes;
    });
    const scoped =
      producer.name === 'runtime' && scopedSource.includes('"' + table.name + '"_n.value');
    const explicitOwner = sources.some((source) =>
      new RegExp('struct[^;]+\\b' + table.type + '\\s*\\{[^]*?EOSLIB_SERIALIZE')
        .exec(source.text)?.[0]
        .includes('ram_owner('),
    );
    const daoBinding = explicitOwner
      ? 'explicit row.ram_owner callback'
      : row.fields.some((field) => field.name === 'dao_id')
        ? 'row.dao_id'
        : table.name === 'daos'
          ? 'row.id'
          : scoped
            ? 'DAO table scope'
            : 'platform';
    const singleton = declarations.some((declaration) =>
      /(?:ram_singleton|singleton)</.test(declaration.declaration),
    );
    return {
      producer: producer.name,
      table: table.name,
      rowType: table.type,
      fields: row.fields,
      payer: 'own contract; foreign payer rejected by qualified ram_table writes',
      daoBinding,
      nativeScope: scoped
        ? 'DAO ID'
        : producer.name === 'runtime'
          ? 'runtime account (shared)'
          : 'runtime account on module payer',
      category:
        daoBinding === 'platform'
          ? 'platform'
          : ['identity', 'activity', 'retained', 'platform'][categories.get(table.name) ?? 1],
      instrumentation: declarations.every((declaration) =>
        /ram_(table|singleton)</.test(declaration.declaration),
      )
        ? 'shared metered wrapper'
        : 'explicit observer/metadata path; inspect callers',
      kind: singleton ? 'singleton' : 'multi_index',
      secondaryKeyBytes,
      rowOverheadBytes: singleton
        ? 224
        : 112 +
          secondaryKeyBytes.reduce((sum, bytes) => sum + Math.ceil((24 + bytes + 96) / 16) * 16, 0),
      newScopeOverheadBytes: singleton ? 0 : 112 * Math.max(1, secondaryKeyBytes.length),
      sharedHeaderPolicy: scoped ? 'DAO' : 'platform',
      declarations,
      lifecycleQualification:
        'See native test evidence; static presence alone does not qualify every lifecycle.',
    };
  });
});
const writeCandidates = sources.flatMap((source) =>
  [...source.text.matchAll(/\b([a-zA-Z_]\w*)\.(emplace|modify|erase|set|remove)\s*\(/g)].map(
    (match) => ({
      source: source.path,
      line: source.text.slice(0, match.index).split('\n').length,
      receiver: match[1],
      operation: match[2],
      precedingDeclaration:
        [
          ...source.text
            .slice(0, match.index)
            .matchAll(/(?:\bACTION|inline\s+\w+|\bvoid)\s+([a-zA-Z_]\w*)\s*\(/g),
        ].at(-1)?.[1] ?? null,
    }),
  ),
);
assert.ok(tables.length > 70 && writeCandidates.length > 200);
const report = {
  schemaVersion: 2,
  billingLayout: 1,
  nativeRuntime: 'Spring 1.2.2',
  qualification:
    'Canonical current ABI coverage and source write candidates. Native conservation is separately measured; full lifecycle/enforcement/backfill qualification remains open.',
  limits: [
    'Text matching is a review aid, not semantic C++ analysis. Container/string operations can appear as candidates.',
    'Compiled shared declarations may be read-only in a producer. Inspect concrete constructors/callers before enabling quotas.',
    'No static inventory demonstrates safe completion holds or legacy-state migration.',
  ],
  producerHashes: Object.fromEntries(
    producers.map((producer) => [producer.name, producer.codeHash]),
  ),
  sources: sources.map((source) => ({
    path: source.path,
    sha256: createHash('sha256').update(source.text).digest('hex'),
  })),
  tables,
  writeCandidates,
};
writeFileSync(
  'docs/evidence/2026-10-09-ram-write-inventory.json',
  JSON.stringify(report, null, 2) + '\n',
);
process.stdout.write(
  `Inventoried ${tables.length} producer tables and ${writeCandidates.length} write candidates.\n`,
);
