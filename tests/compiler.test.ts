import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { generateContract } from '../sdk/compiler.js';
const json = readFileSync('.artifacts/contracts/runtime.abi', 'utf8');
describe('public ABI compiler', () => {
  it('lets a typed legacy caller omit a trailing binary extension', () => {
    const directory = mkdtempSync(join(process.cwd(), '.artifacts', 'compiler-extension-'));
    try {
      const fixture = JSON.stringify({
        version: 'eosio::abi/1.2',
        types: [],
        structs: [
          {
            name: 'hello',
            base: '',
            fields: [
              { name: 'id', type: 'uint64' },
              { name: 'founder', type: 'uint64$' },
            ],
          },
        ],
        actions: [{ name: 'hello', type: 'hello', ricardian_contract: '' }],
        tables: [],
        ricardian_clauses: [],
        variants: [],
      });
      writeFileSync(
        join(directory, 'generated.ts'),
        generateContract(fixture, 'fixture', '@daclify/core-protocol').types,
      );
      writeFileSync(
        join(directory, 'consumer.ts'),
        "import type {hello} from './generated.js';\nconst legacy:hello={id:'1'};\nvoid legacy;\n",
      );
      const program = ts.createProgram([join(directory, 'consumer.ts')], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      });
      expect(
        ts
          .getPreEmitDiagnostics(program)
          .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
      ).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
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
