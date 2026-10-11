import { execFileSync } from 'node:child_process';
execFileSync(
  'node_modules/.bin/esbuild',
  [
    'examples/community-mini-app/browser.ts',
    'examples/community-mini-app/callback.ts',
    '--bundle',
    '--outdir=examples/community-mini-app/public',
    '--format=esm',
    '--platform=browser',
    '--target=es2022',
  ],
  { stdio: 'inherit' },
);
