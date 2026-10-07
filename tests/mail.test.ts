import { describe, expect, it } from 'vitest';
import { mailConfiguration } from '../services/api/src/auth/mail.js';
import { readTelegramOidc } from '../services/api/src/auth/telegram-oidc.js';

describe('provider configuration fails closed', () => {
  it('keeps missing providers unavailable and rejects partial configuration', () => {
    expect(mailConfiguration({ NETWORK_ENVIRONMENT: 'mainnet' })).toBeNull();
    expect(readTelegramOidc({ NETWORK_ENVIRONMENT: 'mainnet' })).toBeUndefined();
    expect(() => mailConfiguration({ SMTP_HOST: 'mail.example.test' })).toThrow();
    expect(() => readTelegramOidc({ TELEGRAM_OIDC_CLIENT_ID: '12345' })).toThrow();
  });
  it('permits plaintext SMTP only for a local loopback capture fixture', () => {
    const config = {
      SMTP_HOST: '127.0.0.1',
      SMTP_FROM: 'Daclify@example.test',
      SMTP_TLS_MODE: 'local-plain',
      NETWORK_ENVIRONMENT: 'local',
    };
    expect(mailConfiguration(config)?.SMTP_FROM).toBe('daclify@example.test');
    for (const environment of ['testnet', 'mainnet'])
      expect(() => mailConfiguration({ ...config, NETWORK_ENVIRONMENT: environment })).toThrow();
    expect(() => mailConfiguration({ ...config, SMTP_HOST: 'mail.example.test' })).toThrow();
    expect(() => mailConfiguration({ ...config, SMTP_USERNAME: 'partial' })).toThrow();
    expect(() =>
      mailConfiguration({ ...config, SMTP_FROM: 'sender@example.test\r\nBcc: other@example.test' }),
    ).toThrow();
  });
  it('requires an exact Telegram callback and HTTPS outside local fixtures', () => {
    const config = {
      TELEGRAM_OIDC_CLIENT_ID: '12345',
      TELEGRAM_OIDC_CLIENT_SECRET: 'fixture',
      TELEGRAM_OIDC_REDIRECT_URI: 'https://api.example.test/v1/sign-in/telegram/oidc/callback',
      NETWORK_ENVIRONMENT: 'mainnet',
    };
    expect(readTelegramOidc(config)?.clientId).toBe('12345');
    for (const uri of [
      'http://api.example.test/v1/sign-in/telegram/oidc/callback',
      'https://api.example.test/other',
      config.TELEGRAM_OIDC_REDIRECT_URI + '?redirect=other',
    ])
      expect(() => readTelegramOidc({ ...config, TELEGRAM_OIDC_REDIRECT_URI: uri })).toThrow();
  });
});
