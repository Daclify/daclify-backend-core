import { z } from 'zod';
import { createTransport } from 'nodemailer';
import { normalizeMailbox } from './email.js';
import { ApiError } from '../errors.js';

const MailSchema = z.object({
  SMTP_HOST: z.string().min(1).max(253),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_TLS_MODE: z.enum(['starttls', 'tls', 'local-plain']).default('starttls'),
  SMTP_FROM: z.string().min(3).max(254),
  SMTP_USERNAME: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  NETWORK_ENVIRONMENT: z.enum(['local', 'testnet', 'mainnet']),
});
export function mailConfiguration(input: Record<string, string | undefined>) {
  if (
    ![
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_TLS_MODE',
      'SMTP_FROM',
      'SMTP_USERNAME',
      'SMTP_PASSWORD',
    ].some((field) => input[field] !== undefined)
  )
    return null;
  const result = MailSchema.safeParse(input);
  if (!result.success) throw new Error('MAIL_CONFIGURATION_INVALID');
  const value = result.data;
  if (
    !!value.SMTP_USERNAME !== !!value.SMTP_PASSWORD ||
    (value.SMTP_TLS_MODE === 'local-plain' &&
      (value.NETWORK_ENVIRONMENT !== 'local' ||
        !['127.0.0.1', 'localhost', '::1'].includes(value.SMTP_HOST)))
  )
    throw new Error('MAIL_CONFIGURATION_INVALID');
  return { ...value, SMTP_FROM: normalizeMailbox(value.SMTP_FROM) };
}
export function readMailDelivery(input: Record<string, string | undefined>) {
  const config = mailConfiguration(input);
  if (!config) return undefined;
  const transport = createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_TLS_MODE === 'tls',
    requireTLS: config.SMTP_TLS_MODE !== 'local-plain',
    ignoreTLS: config.SMTP_TLS_MODE === 'local-plain',
    ...(config.SMTP_USERNAME && config.SMTP_PASSWORD
      ? { auth: { user: config.SMTP_USERNAME, pass: config.SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  return async (to: string, code: string): Promise<void> => {
    if (!/^\d{8}$/.test(code)) throw new ApiError('EMAIL_INVALID', 400);
    try {
      const result = await transport.sendMail({
        from: config.SMTP_FROM,
        to: normalizeMailbox(to),
        subject: 'Your Daclify sign-in code',
        text: `Your Daclify code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
      });
      if (result.rejected.length > 0) throw new Error('Recipient rejected');
    } catch {
      throw new ApiError('EMAIL_DELIVERY_FAILED', 503);
    }
  };
}
