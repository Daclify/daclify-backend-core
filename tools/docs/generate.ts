import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { generateDocumentation } from '../../sdk/documentation.js';
import { ApiRoutes } from '../../protocol/routes.js';
import { VERSION } from '../../protocol/base.js';
const topics: unknown = JSON.parse(await readFile('docs/guides/topics.json', 'utf8'));
const contracts = await Promise.all(
  ['runtime', 'hub'].map(async (name) => ({
    name,
    abi: await readFile(`.artifacts/contracts/${name}.abi`, 'utf8'),
  })),
);
const api = Object.values(ApiRoutes).map((endpoint) => ({
  method: endpoint.method,
  path: endpoint.path,
  helpTopic: endpoint.helpTopic,
  ...('input' in endpoint ? { input: z.toJSONSchema(endpoint.input, { io: 'input' }) } : {}),
  response: z.toJSONSchema(endpoint.response, { io: 'output' }),
}));
const output = generateDocumentation(
  { producer: 'core', packageVersion: VERSION, interfaceVersion: 1, topics },
  contracts,
  api,
);
const files = new Map([
  ['docs/generated/reference.json', JSON.stringify(output.bundle, null, 2) + '\n'],
  ['docs/generated/reference.md', output.markdown],
  [
    'protocol/generated/help.ts',
    `// Generated from producer-owned guides, compiled ABI and API schemas.\nimport type {HelpBundle} from '../docs.js';\nexport const CoreHelpBundle=${JSON.stringify(output.bundle, null, 2)} satisfies HelpBundle;\n`,
  ],
]);
const check = process.argv.includes('--check');
for (const [path, content] of files) {
  if (check) {
    if ((await readFile(path, 'utf8')) !== content)
      throw new Error(`Generated documentation changed: ${path}`);
  } else {
    await mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
    await writeFile(path, content);
  }
}
console.log(
  check
    ? 'Generated core documentation is unchanged.'
    : 'Generated core documentation and versioned guide bundle.',
);
