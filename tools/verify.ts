import { spawnSync } from 'node:child_process';
import { loadCheckoutManifest, publishRelease } from './release/manifest.js';

function run(script: string): void {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
}

run('lint');
run('typecheck');
run('docs:check');
run('test');
const manifest = loadCheckoutManifest(process.cwd());
try {
  publishRelease(manifest);
} catch (error) {
  if (!(error instanceof Error) || !error.message.startsWith('PUBLICATION_REFUSED')) throw error;
  console.log(JSON.stringify({ publication: manifest.publication, qualified: manifest.qualified }));
  process.exit(0);
}
console.error('VERIFY_PUBLICATION');
process.exit(1);
