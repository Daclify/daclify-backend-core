import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { readMailDelivery } from '../../services/api/src/auth/mail.js';
const port = process.env.DACLIFY_MAIL_FIXTURE_SMTP_PORT;
const api = process.env.DACLIFY_MAIL_FIXTURE_API;
if (!port || !api || new URL(api).hostname !== '127.0.0.1')
  throw new Error('Owned loopback Mailpit fixture required');
it('delivers a real SMTP message to local capture and refuses downgrade to plaintext', async () => {
  const config = {
    NETWORK_ENVIRONMENT: 'local',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: port,
    SMTP_FROM: 'daclify@example.test',
    SMTP_TLS_MODE: 'local-plain',
  };
  const deliver = readMailDelivery(config);
  if (!deliver) throw new Error('Missing fixture delivery');
  const recipient = `smtp-${randomUUID()}@example.test`;
  await deliver(recipient, '01234567');
  const response = await fetch(new URL('/api/v1/message/latest/raw', api));
  expect(response.ok).toBe(true);
  const raw = await response.text();
  expect(raw).toContain(recipient);
  expect(raw).toContain('01234567');
  expect(raw).toContain('Subject: Your Daclify sign-in code');
  const tlsOnly = readMailDelivery({ ...config, SMTP_TLS_MODE: 'starttls' });
  if (!tlsOnly) throw new Error('Missing TLS transport');
  await expect(tlsOnly(recipient, '76543210')).rejects.toMatchObject({
    code: 'EMAIL_DELIVERY_FAILED',
  });
});
