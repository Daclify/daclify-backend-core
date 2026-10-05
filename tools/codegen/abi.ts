import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { generateContract } from '../../sdk/compiler.js';
const output = generateContract(
  readFileSync('.artifacts/contracts/runtime.abi', 'utf8'),
  'runtime',
  '../../protocol/base.js',
);
mkdirSync('sdk/generated', { recursive: true });
writeFileSync('sdk/generated/runtime.ts', output.types);
writeFileSync('sdk/generated/schemas.ts', output.schemas);
