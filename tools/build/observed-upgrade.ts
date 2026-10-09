import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const modules = resolve('../daclify-backend-modules');
for (const [required, script] of [
  ['.artifacts/document-upgrade-old/grants.wasm', 'tools/build-document-upgrade.ts'],
  ['.artifacts/archive-upgrade-old/decide.wasm', 'tools/build-upgrade.ts'],
] as const)
  if (!existsSync(resolve(modules, required)))
    execFileSync('npm', ['exec', '--', 'tsx', script], { cwd: modules, stdio: 'inherit' });

const destination = '.artifacts/observed-upgrade';
mkdirSync(destination, { recursive: true });
for (const contract of ['runtime', 'works', 'payroll', 'decide', 'grants'])
  for (const extension of ['abi', 'wasm'])
    copyFileSync(
      resolve(
        modules,
        contract === 'decide'
          ? '.artifacts/archive-upgrade-old'
          : '.artifacts/document-upgrade-old',
        `${contract}.${extension}`,
      ),
      `${destination}/${contract}.${extension}`,
    );
console.log('Staged actual historical observed core/modules for the owned native upgrade drill.');
