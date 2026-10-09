import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadCheckoutManifest,
  releaseSubject,
  qualifyRelease,
  ReleaseChecks,
  publishRelease,
} from '../tools/release/manifest.js';
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function evidence() {
  const root = mkdtempSync(join(tmpdir(), 'daclify-release-'));
  directories.push(root);
  const manifest = loadCheckoutManifest(process.cwd()),
    subject = releaseSubject(manifest);
  const checks = Object.keys(ReleaseChecks).map((id) => {
    const report = {
      schemaVersion: 1,
      check: id,
      subject,
      status: 'passed',
      method: 'command',
      assertions: 1,
      failed: 0,
      skipped: 0,
      exitCode: 0,
    };
    const data = JSON.stringify(report),
      path = id + '.json';
    writeFileSync(join(root, path), data);
    return { id, path, sha256: createHash('sha256').update(data).digest('hex') };
  });
  return { root, manifest, bundle: { schemaVersion: 1, subject, checks } };
}
it('qualifies exact pins only after every required report passes and records its provenance', () => {
  const f = evidence(),
    qualified = qualifyRelease(f.manifest, f.root, f.bundle);
  expect(qualified).toMatchObject({
    publication: 'eligible',
    qualified: true,
    checks: { held: [] },
  });
  expect(qualified.checks.evidence).toHaveLength(Object.keys(ReleaseChecks).length);
  expect(() => publishRelease(qualified)).not.toThrow();
  expect(f.manifest.qualified).toBe(false);
});
it('does not permit qualification from missing, duplicate or unknown checks', () => {
  const f = evidence(),
    first = f.bundle.checks[0];
  if (!first) throw new Error('RELEASE_TEST_CHECK_REQUIRED');
  for (const checks of [
    f.bundle.checks.slice(1),
    [...f.bundle.checks, first],
    [...f.bundle.checks, { ...first, id: 'unknown' }],
  ])
    expect(() => qualifyRelease(f.manifest, f.root, { ...f.bundle, checks })).toThrow(
      'RELEASE_EVIDENCE',
    );
});
it('rejects stale pins and changed evidence bytes', () => {
  const f = evidence(),
    first = f.bundle.checks[0];
  if (!first) throw new Error('RELEASE_TEST_CHECK_REQUIRED');
  expect(() =>
    qualifyRelease(f.manifest, f.root, { ...f.bundle, subject: 'ab'.repeat(32) }),
  ).toThrow('RELEASE_EVIDENCE');
  writeFileSync(join(f.root, first.path), 'changed');
  expect(() => qualifyRelease(f.manifest, f.root, f.bundle)).toThrow('RELEASE_EVIDENCE');
});
it.each([
  { status: 'failed' },
  { assertions: 0 },
  { failed: 1 },
  { skipped: 1 },
  { exitCode: 1 },
  { subject: 'cd'.repeat(32) },
  { check: 'ram' },
])('rejects a report that cannot establish its declared check: %j', (change) => {
  const f = evidence(),
    first = f.bundle.checks[0];
  if (!first) throw new Error('RELEASE_TEST_CHECK_REQUIRED');
  const report = {
    schemaVersion: 1,
    check: first.id,
    subject: f.bundle.subject,
    status: 'passed',
    method: 'command',
    assertions: 1,
    failed: 0,
    skipped: 0,
    exitCode: 0,
    ...change,
  };
  const data = JSON.stringify(report);
  writeFileSync(join(f.root, first.path), data);
  first.sha256 = createHash('sha256').update(data).digest('hex');
  expect(() => qualifyRelease(f.manifest, f.root, f.bundle)).toThrow('RELEASE_EVIDENCE');
});
it('rejects paths outside the evidence directory, including symlinks', () => {
  const f = evidence(),
    first = f.bundle.checks[0],
    outside = mkdtempSync(join(tmpdir(), 'daclify-outside-'));
  if (!first) throw new Error('RELEASE_TEST_CHECK_REQUIRED');
  directories.push(outside);
  writeFileSync(join(outside, 'report.json'), '{}');
  symlinkSync(join(outside, 'report.json'), join(f.root, 'linked.json'));
  for (const path of ['../report.json', join(outside, 'report.json'), 'linked.json'])
    expect(() =>
      qualifyRelease(f.manifest, f.root, {
        ...f.bundle,
        checks: f.bundle.checks.map((check) => (check === first ? { ...first, path } : check)),
      }),
    ).toThrow('RELEASE_EVIDENCE');
});
it('revalidates qualification rather than trusting a forged passed flag', () => {
  const f = evidence();
  expect(() =>
    publishRelease({
      ...f.manifest,
      qualified: true,
      publication: 'eligible',
      checks: { ...f.manifest.checks, held: [] },
    }),
  ).toThrow('PUBLICATION_REFUSED');
});

it('rejects changing source/artifact pins after qualification', () => {
  const f = evidence(),
    qualified = qualifyRelease(f.manifest, f.root, f.bundle);
  expect(() =>
    publishRelease({
      ...qualified,
      artifacts: { ...qualified.artifacts, runtimeCodeHash: 'ef'.repeat(32) },
    }),
  ).toThrow('PUBLICATION_REFUSED');
});

it('permits explicit operator review evidence without pretending it was a command', () => {
  const f = evidence(),
    first = f.bundle.checks[0];
  if (!first) throw new Error('RELEASE_TEST_CHECK_REQUIRED');
  const data = JSON.stringify({
    schemaVersion: 1,
    check: first.id,
    subject: f.bundle.subject,
    status: 'passed',
    method: 'operator',
    reviewer: 'synthetic qualification-policy test',
    assertions: 1,
    failed: 0,
    skipped: 0,
  });
  writeFileSync(join(f.root, first.path), data);
  first.sha256 = createHash('sha256').update(data).digest('hex');
  expect(qualifyRelease(f.manifest, f.root, f.bundle).qualified).toBe(true);
});
