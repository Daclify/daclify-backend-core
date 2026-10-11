import { expect, it } from 'vitest';
import {
  ConnectedAppConfigSchema,
  AppAuthorizationSchema,
  appConfigurationHash,
} from '../protocol/connected-apps.js';
const config = {
  dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  appId: '1',
  revision: '1',
  name: 'Garden',
  origins: ['https://garden.example'],
  redirectUris: ['https://garden.example/login/callback'],
  activityAccount: 'activity',
  enabled: true,
};
it('allows exact HTTPS callbacks only within approved origins', () => {
  expect(ConnectedAppConfigSchema.safeParse(config).success).toBe(true);
  for (const callback of [
    'http://garden.example/callback',
    'https://evil.example/callback',
    'https://garden.example/callback#token',
    'https://user:password@garden.example/callback',
  ])
    expect(
      ConnectedAppConfigSchema.safeParse({ ...config, redirectUris: [callback] }).success,
    ).toBe(false);
  expect(
    ConnectedAppConfigSchema.safeParse({ ...config, origins: ['https://garden.example/path'] })
      .success,
  ).toBe(false);
});
it('commits all authority configuration while ignoring input property order', () => {
  const hash = appConfigurationHash(config);
  expect(appConfigurationHash({ ...config, enabled: false })).not.toBe(hash);
  expect(
    appConfigurationHash({ ...config, redirectUris: ['https://garden.example/another'] }),
  ).not.toBe(hash);
  expect(appConfigurationHash({ ...config, name: 'Other' })).not.toBe(hash);
  expect(
    appConfigurationHash({
      ...config,
      dao: { interfaceVersion: 1, daoId: '1', contract: 'daclifycore', chainId: 'ab'.repeat(32) },
    }),
  ).toBe(hash);
});
it('requires S256 PKCE, nonce, state and an explicit narrow scope', () => {
  const login = {
    client_id: '550e8400-e29b-41d4-a716-446655440000',
    redirect_uri: config.redirectUris[0],
    response_type: 'code',
    scope: 'openid membership',
    code_challenge: 'x'.repeat(43),
    code_challenge_method: 'S256',
    state: 'state-with-entropy',
    nonce: 'nonce-with-entropy',
  };
  expect(AppAuthorizationSchema.safeParse(login).success).toBe(true);
  for (const change of [
    { code_challenge_method: 'plain' },
    { state: '' },
    { nonce: '' },
    { scope: 'openid email profile' },
    { response_type: 'token' },
  ])
    expect(AppAuthorizationSchema.safeParse({ ...login, ...change }).success).toBe(false);
});
