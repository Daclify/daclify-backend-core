import { z } from 'zod';
import { AccountErasureExclusions } from './exclusions.js';
export async function readAccountExitConfiguration(env:Record<string,string|undefined>){
 if(!env.ACCOUNT_EXIT_ENABLED||env.ACCOUNT_EXIT_ENABLED==='0')return undefined;
 try{
  if(env.ACCOUNT_EXIT_ENABLED!=='1')throw Error();
  const backupRetentionSeconds=z.coerce.number().int().min(1).max(90*86400).parse(env.ACCOUNT_EXIT_MAX_BACKUP_AGE_SECONDS);
  const directory=z.string().startsWith('/').max(4096).parse(env.ACCOUNT_EXIT_EXCLUSIONS_DIRECTORY);
  if(env.NETWORK_ENVIRONMENT==='mainnet'&&['/tmp','/var/tmp'].some(path=>directory===path||directory.startsWith(path+'/')))throw Error();
  const exclusions=new AccountErasureExclusions(directory);
  await exclusions.read('00000000-0000-4000-8000-000000000000');
  return {backupRetentionSeconds,exclusions};
 }catch{throw Error('ACCOUNT_EXIT_CONFIGURATION_INVALID');}
}
