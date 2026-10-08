import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
import {
  StorageAlerts,
  readStorageAlertEmail,
} from '../../services/api/src/content/storage-alerts.js';
import type { MailSender } from '../../services/api/src/auth/mail.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Isolated local test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
it('requires configured mail and validates the operations destination', () => {
  expect(readStorageAlertEmail({}, false)).toBeNull();
  expect(() =>
    readStorageAlertEmail({ DACLIFY_STORAGE_ALERT_EMAIL: 'ops@example.test' }, false),
  ).toThrow('STORAGE_ALERT_CONFIGURATION_INVALID');
  expect(() =>
    readStorageAlertEmail({ DACLIFY_STORAGE_ALERT_EMAIL: 'bad\r\nheader' }, true),
  ).toThrow('STORAGE_ALERT_CONFIGURATION_INVALID');
  expect(readStorageAlertEmail({ DACLIFY_STORAGE_ALERT_EMAIL: 'ops@example.test' }, true)).toBe(
    'ops@example.test',
  );
});
it('queues a scope-bound incident once, preserves staged bytes, retries mail and cancels only a terminal incident', async () => {
  const scope = 'alert-' + randomUUID(),
    id = randomUUID(),
    pin = randomUUID(),
    other = randomUUID();
  const insert = async (object: string, providerScope: string) => {
    await pool.query(
      "INSERT INTO hosted_objects(id,provider_scope,cid,verified_bytes,commitment,import_profile,state) VALUES($1,$2,$3,4,$4,'public-cidv1-file-v1','removing')",
      [
        object,
        providerScope,
        'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'aa'.repeat(32),
      ],
    );
    await pool.query(
      "INSERT INTO hosted_removals(object_id,generation,lease_token,lease_until,state,staged_bytes,provider_ids,affected_daos,last_error_code) VALUES($1,1,$2,now(),'review',$3,$4,'[]','STORAGE_REMOVAL_REVIEW')",
      [object, randomUUID(), Buffer.from('test'), [pin]],
    );
  };
  await insert(id, scope);
  await insert(other, scope + '-other');
  const send = vi.fn<MailSender>(async () => {}),
    alerts = new StorageAlerts(pool, scope, 'ops@example.test', send),
    owner = randomUUID();
  await alerts.queue();
  await alerts.queue();
  const foreignKey = 'foreign-alert-' + randomUUID();
  await pool.query(
    "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-storage-alerts','deliver',$1,$2,now())",
    [foreignKey, { providerScope: scope + '-other', objectId: other, generation: '1' }],
  );
  const jobs = await pool.query(
    "SELECT id,payload FROM jobs WHERE module_id='core-storage-alerts' AND payload->>'providerScope'=$1",
    [scope],
  );
  expect(jobs.rows).toHaveLength(1);
  send.mockRejectedValueOnce(new Error('private SMTP detail'));
  expect(await alerts.process(owner)).toBe('retry');
  await pool.query('UPDATE jobs SET due_at=now() WHERE id=$1', [jobs.rows[0]?.id]);
  expect(await alerts.process(owner)).toBe('completed');
  expect(send.mock.calls[1]?.[0]).toMatchObject({
    to: 'ops@example.test',
    subject: 'Daclify storage recovery needs operator review',
  });
  expect(send.mock.calls[1]?.[0].text).not.toContain('test');
  expect(
    (await pool.query('SELECT staged_bytes,state FROM hosted_removals WHERE object_id=$1', [id]))
      .rows[0],
  ).toMatchObject({ state: 'review', staged_bytes: Buffer.from('test') });
  await pool.query("UPDATE jobs SET state='pending',due_at=now() WHERE id=$1", [jobs.rows[0]?.id]);
  await pool.query(
    "UPDATE hosted_removals SET state='canceled',staged_bytes=NULL,completed_at=now() WHERE object_id=$1",
    [id],
  );
  expect(await alerts.process(owner)).toBe('completed');
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    (await pool.query('SELECT state FROM jobs WHERE job_key=$1', [foreignKey])).rows[0]?.state,
  ).toBe('pending');
});
