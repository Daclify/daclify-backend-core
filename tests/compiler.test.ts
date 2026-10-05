import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateContract } from '../sdk/compiler.js';
const json = readFileSync('.artifacts/contracts/runtime.abi', 'utf8');
describe('public ABI compiler', () => {
  it('omits unused validators for small consumer ABIs', () => {
    const fixture = JSON.stringify({
      version: 'eosio::abi/1.2',
      types: [],
      structs: [{ name: 'hello', base: '', fields: [{ name: 'user', type: 'name' }] }],
      actions: [{ name: 'hello', type: 'hello', ricardian_contract: '' }],
      tables: [],
      ricardian_clauses: [],
      variants: [],
    });
    expect(generateContract(fixture, 'fixture', '@daclify/core-protocol').schemas).not.toContain(
      'SignatureSchema',
    );
  });
  it('generates the producer action and table boundaries', () => {
    const generated = generateContract(json, 'runtime', '../../protocol/base.js');
    expect(generated.types).toContain('interface RuntimeActions');
    expect(generated.schemas).toContain('RuntimeTableSchemas');
  });
  it('rejects source-injection names before generating code', () => {
    expect(() =>
      generateContract(json, 'runtime;process.exit()', '../../protocol/base.js'),
    ).toThrow('Invalid contract');
  });
  it('rejects unsupported ABI types rather than silently degrading types', () => {
    const fixture = JSON.stringify({
      version: 'eosio::abi/1.2',
      types: [],
      structs: [
        { name: 'unrecognized', base: '', fields: [{ name: 'value', type: 'unknown_type' }] },
      ],
      actions: [],
      tables: [],
      ricardian_clauses: [],
      variants: [],
    });
    expect(() => generateContract(fixture, 'fixture', '@daclify/core-protocol')).toThrow(
      'Unsupported ABI type',
    );
  });
});
