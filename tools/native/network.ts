import { readFileSync } from 'node:fs';
import { z } from 'zod';
export const FixtureContainerSchema = z.enum([
  'daclify-names-native',
  'daclify-integration-native',
  'daclify-executives-native',
  'daclify-resources-native',
  'daclify-ram-native',
  'daclify-payments-native',
  'daclify-v2-native',
  'daclify-dao-presets-native',
  'daclify-platform-native',
  'daclify-access-native',
  'daclify-research-native',
  'daclify-research-paid-native',
]);
export function fixtureNetwork() {
  return z
    .strictObject({
      container: FixtureContainerSchema,
      url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
      chainId: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
}
