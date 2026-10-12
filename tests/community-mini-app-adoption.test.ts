import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('refuses incomplete or public credential files without creating a database or leaking tokens',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mini-app-adoption-cli-'));
 try {
  const database=join(dir,'never-created.sqlite'),binding=join(dir,'binding.json'),access=join(dir,'access.json'),backup=join(dir,'backup.sqlite');
  writeFileSync(binding,JSON.stringify({schemaVersion:1,chainId:'ab'.repeat(32),runtime:'daclifycore',daoId:'1',appId:'1',issuer:'https://issuer.example',clientId:'550e8400-e29b-41d4-a716-446655440002'}));
  const secret='a'.repeat(43);writeFileSync(access,JSON.stringify([secret]),{mode:0o644});
  const result=spawnSync(process.execPath,['--import','tsx','examples/community-mini-app/adopt.ts','--database',database,'--binding',binding,'--backup',backup,'--access',access],{encoding:'utf8'});
  expect(result.status).toBe(1);expect(result.stderr).toContain('APP_DATABASE_ACCESS_FILE_PRIVATE');
  expect(result.stdout+result.stderr).not.toContain(secret);expect(existsSync(database)).toBe(false);expect(existsSync(backup)).toBe(false);
 } finally {rmSync(dir,{recursive:true});}
});
