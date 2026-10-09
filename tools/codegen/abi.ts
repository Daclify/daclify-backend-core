import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ABI, Serializer } from '@wharfkit/antelope';
import { generateContract } from '../../sdk/compiler.js';
const output = generateContract(
  readFileSync('.artifacts/contracts/runtime.abi', 'utf8'),
  'runtime',
  '../../protocol/base.js',
);
mkdirSync('sdk/generated', { recursive: true });
writeFileSync('sdk/generated/runtime.ts', output.types);
writeFileSync('sdk/generated/schemas.ts', output.schemas);
const names = generateContract(
  readFileSync('.artifacts/contracts/names.abi', 'utf8'),
  'names',
  '../../protocol/base.js',
);
writeFileSync('sdk/generated/names.ts', names.types);
writeFileSync('sdk/generated/names-schemas.ts', names.schemas);
writeFileSync(
  'sdk/generated/names-release.ts',
  `// Generated from compiled names artifact; do not edit.\nexport const NamesCodeHash='${createHash('sha256').update(readFileSync('.artifacts/contracts/names.wasm')).digest('hex')}';\n`,
);
writeFileSync(
  'sdk/generated/releases.ts',
  `// Generated from compiled runtime artifacts; do not edit.\nexport const RuntimeCodeHash='${createHash('sha256').update(readFileSync('.artifacts/contracts/runtime.wasm')).digest('hex')}';\nexport const RuntimeRawAbiHash='${createHash(
    'sha256',
  )
    .update(
      Serializer.encode({
        object: ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8')),
      }).array,
    )
    .digest('hex')}';\n`,
);
