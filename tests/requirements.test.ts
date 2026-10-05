import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkRequirementRegister,
  loadRequirementRegister,
} from '../tools/release/requirements.js';

const root = mkdtempSync(join(tmpdir(), 'daclify-requirements-'));

describe('requirement register', () => {
  it('rejects an empty register', () => {
    expect(() =>
      checkRequirementRegister(root, { requiredSuites: ['vert'], requirements: [] }),
    ).toThrow('REQUIREMENTS_EMPTY');
  });

  it('rejects a required suite that cites no test', () => {
    writeFileSync(join(root, 'present.test.ts'), "it('keeps the row', () => {});\n");
    expect(() =>
      checkRequirementRegister(root, {
        requiredSuites: ['vert', 'native'],
        requirements: [{ id: 'WP03-CALLBACK', suite: 'vert', tests: ['present.test.ts'] }],
      }),
    ).toThrow('REQUIRED_SUITE_ABSENT');
  });

  it('rejects a cited test file that is not in the checkout', () => {
    expect(() =>
      checkRequirementRegister(root, {
        requiredSuites: ['vert'],
        requirements: [{ id: 'WP03-CALLBACK', suite: 'vert', tests: ['missing.test.ts'] }],
      }),
    ).toThrow('REQUIREMENT_TEST_MISSING');
  });

  it('rejects a cited file that contains no test', () => {
    writeFileSync(
      join(root, 'empty.test.ts'),
      "describe('empty', () => {});\n// it('commented');\n",
    );
    expect(() =>
      checkRequirementRegister(root, {
        requiredSuites: ['vert'],
        requirements: [{ id: 'WP03-EMPTY', suite: 'vert', tests: ['empty.test.ts'] }],
      }),
    ).toThrow('REQUIREMENT_TEST_EMPTY');
  });

  it('rejects a path that leaves the workspace', () => {
    expect(() =>
      checkRequirementRegister(root, {
        requiredSuites: ['vert'],
        requirements: [{ id: 'WP03-ESCAPE', suite: 'vert', tests: ['../../outside.test.ts'] }],
      }),
    ).toThrow('REQUIREMENT_PATH');
  });

  it('accepts the committed register and its cited tests', () => {
    expect(loadRequirementRegister(process.cwd()).requirements.length).toBeGreaterThan(0);
  });
});
