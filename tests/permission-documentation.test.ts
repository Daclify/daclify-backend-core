import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { CoreHelpBundle } from '../protocol/generated/help.js';
import { contextPermissionPlan } from '../tools/deploy/permissions.js';

it('ships searchable permission examples and a safe offline illustration in the public package', () => {
  const topic = CoreHelpBundle.topics.find((topic) => topic.id === 'contract-permissions');
  expect(topic?.paragraphs.join(' ')).toContain('execctx');
  expect(topic?.paragraphs.join(' ')).toContain('independent');
  const svg = readFileSync('docs/generated/contract-permissions.svg', 'utf8');
  expect(svg).toContain('<title');
  expect(svg).toContain('<desc');
  expect(svg).not.toMatch(/<script|<foreignObject|onload=|href="https?:/);
  for (const name of ['owner', 'active', 'creator', 'execctx', 'service', 'eosio.code'])
    expect(svg).toContain(name);
  const manifest = z
    .object({ exports: z.record(z.string(), z.unknown()) })
    .parse(JSON.parse(readFileSync('sdk/public-package.json', 'utf8')));
  expect(manifest.exports['./diagrams/contract-permissions.svg']).toBe(
    './docs/generated/contract-permissions.svg',
  );
});

it('documents the actual generated execution permission rather than a relayer key', () => {
  const plan = contextPermissionPlan('daclifycore1', []);
  expect(plan.authority.keys).toEqual([]);
  const text = readFileSync('docs/guides/contract-permissions.md', 'utf8');
  expect(text).toContain('daclifycore1@eosio.code');
  expect(text).toContain('does not grant');
});
