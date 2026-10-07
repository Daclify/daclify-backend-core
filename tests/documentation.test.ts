import { describe, it, expect } from 'vitest';
import { HelpBundleSchema } from '../protocol/docs.js';
import { ModuleManifestSchema } from '../protocol/base.js';
import { generateDocumentation } from '../sdk/documentation.js';
const guide = {
  id: 'accounts',
  title: 'Internal accounts',
  paragraphs: ['An internal account can participate without a native account.'],
};
const source = {
  producer: 'core',
  packageVersion: '0.1.0-alpha.1',
  interfaceVersion: 1,
  topics: [guide],
};
const abi = JSON.stringify({
  version: 'eosio::abi/1.2',
  types: [],
  structs: [{ name: 'update', base: '', fields: [{ name: 'quantity', type: 'uint64' }] }],
  actions: [{ name: 'update', type: 'update', ricardian_contract: '' }],
  tables: [],
  ricardian_clauses: [],
  variants: [],
});
describe('producer-owned versioned documentation', () => {
  it('generates deterministic guide and compiled ABI references', () => {
    const output = generateDocumentation(source, [{ name: 'runtime', abi }], []);
    const again = generateDocumentation(source, [{ name: 'runtime', abi }], []);
    expect(output).toEqual(again);
    const bundle = HelpBundleSchema.parse(output.bundle);
    expect(bundle.contracts[0]?.actions[0]).toEqual({
      name: 'update',
      fields: [{ name: 'quantity', type: 'uint64' }],
    });
    expect(bundle.contracts[0]?.sourceAbiHash).toHaveLength(64);
    expect(output.markdown).toContain('quantity');
  });
  it('rejects duplicate topic identifiers', () => {
    expect(() => generateDocumentation({ ...source, topics: [guide, guide] }, [], [])).toThrow(
      'Duplicate documentation topic',
    );
  });
  it('rejects empty guides and unsupported metadata', () => {
    expect(() => generateDocumentation({ ...source, topics: [] }, [], [])).toThrow();
    expect(() =>
      generateDocumentation({ ...source, unexpectedField: 'not a document field' }, [], []),
    ).toThrow();
  });
  it('fails rather than documenting an ABI action with a missing struct', () => {
    expect(() =>
      generateDocumentation(
        source,
        [{ name: 'runtime', abi: abi.replace('"type":"update"', '"type":"missing"') }],
        [],
      ),
    ).toThrow('Undocumented ABI structure');
  });
  it('includes producer configuration and rejects an unresolved module guide', () => {
    const manifest = ModuleManifestSchema.parse({
      id: 'decide',
      version: '0.1.0-alpha.1',
      coreRange: '^0.1.0-alpha.1',
      interfaceVersion: 1,
      configVersion: 1,
      capabilities: ['ballot.create'],
      helpTopic: 'accounts',
    });
    const module = {
      manifest,
      configuration: {
        type: 'object',
        properties: { weight: { enum: ['member', 'credit', 'native-stake'] } },
      },
    };
    const output = generateDocumentation(source, [], [], [module]);
    expect(output.bundle.modules[0]?.configuration).toEqual(module.configuration);
    expect(output.markdown).toContain('native-stake');
    expect(() =>
      generateDocumentation(
        source,
        [],
        [],
        [{ ...module, manifest: { ...manifest, helpTopic: 'missing' } }],
      ),
    ).toThrow('Unknown module help topic');
  });
});

it('documents query cursors from the producer schema', () => {
  const output = generateDocumentation(
    source,
    [],
    [
      {
        method: 'GET',
        path: '/v1/daos',
        helpTopic: 'accounts',
        query: { type: 'object', properties: { after: { type: 'string' } } },
        response: { type: 'object' },
      },
    ],
  );
  expect(output.bundle.api[0]?.query).toEqual({
    type: 'object',
    properties: { after: { type: 'string' } },
  });
  expect(output.markdown).toContain('Query:');
  expect(output.markdown).toContain('after');
});

it('documents paired-login request schemas and bodyless credential removal', async () => {
  const { CoreHelpBundle } = await import('../protocol/generated/help.js');
  const finish = CoreHelpBundle.api.find((route) => route.path === '/v1/sign-in/native');
  expect(finish?.input).toMatchObject({ required: ['id', 'proof'] });
  const start = CoreHelpBundle.api.find((route) => route.path === '/v1/sign-in/email/login/start');
  expect(start?.input).toMatchObject({ required: ['email'] });
  const removal = CoreHelpBundle.api.find((route) => route.path === '/v1/sign-in/remove');
  expect(removal).toMatchObject({ status: 204, input: { required: ['method', 'subject'] } });
});
