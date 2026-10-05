import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SUITES = ['vert', 'native', 'integration', 'provider', 'modules', 'browser', 'unit'] as const;
type Suite = (typeof SUITES)[number];

export interface RequirementRecord {
  id: string;
  suite: Suite;
  tests: string[];
}

export interface RequirementRegister {
  requiredSuites: Suite[];
  requirements: RequirementRecord[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSuite(value: string): value is Suite {
  return SUITES.some((suite) => suite === value);
}

function assertInsideWorkspace(root: string, testPath: string): void {
  if (testPath.includes('\0') || path.isAbsolute(testPath))
    throw new Error(`REQUIREMENT_PATH: ${testPath}`);
  const workspace = path.dirname(path.resolve(root));
  const absolute = path.resolve(root, testPath);
  const relative = path.relative(workspace, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error(`REQUIREMENT_PATH: ${testPath}`);
}

export function checkRequirementRegister(root: string, register: unknown): RequirementRegister {
  if (!record(register)) throw new Error('REQUIREMENTS_SHAPE: register must be an object');
  const { requirements, requiredSuites } = register;
  if (!Array.isArray(requirements) || requirements.length === 0)
    throw new Error('REQUIREMENTS_EMPTY: the requirement register has no requirements');
  if (!Array.isArray(requiredSuites) || requiredSuites.length === 0)
    throw new Error('REQUIRED_SUITES_EMPTY: required suites are not declared');
  const seen = new Set<string>();
  const covered = new Set<Suite>();
  const normalized: RequirementRecord[] = [];
  for (const entry of requirements) {
    if (
      !record(entry) ||
      typeof entry.id !== 'string' ||
      entry.id.length === 0 ||
      typeof entry.suite !== 'string' ||
      !Array.isArray(entry.tests)
    )
      throw new Error('REQUIREMENTS_SHAPE: requirement fields are missing');
    if (!isSuite(entry.suite)) throw new Error(`REQUIREMENTS_SHAPE: unknown suite ${entry.suite}`);
    if (seen.has(entry.id)) throw new Error(`REQUIREMENT_ID_DUPLICATE: ${entry.id}`);
    seen.add(entry.id);
    covered.add(entry.suite);
    const tests: string[] = [];
    for (const testPath of entry.tests) {
      if (typeof testPath !== 'string' || testPath.length === 0)
        throw new Error('REQUIREMENT_PATH: empty path');
      assertInsideWorkspace(root, testPath);
      const absolute = path.resolve(root, testPath);
      if (!existsSync(absolute)) throw new Error(`REQUIREMENT_TEST_MISSING: ${testPath}`);
      const source = readFileSync(absolute, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      if (!/\b(?:it|test)\s*\(/.test(source))
        throw new Error(`REQUIREMENT_TEST_EMPTY: ${testPath}`);
      tests.push(testPath);
    }
    if (tests.length === 0) throw new Error(`REQUIREMENT_TEST_EMPTY: ${entry.id}`);
    normalized.push({ id: entry.id, suite: entry.suite, tests });
  }
  const suites: Suite[] = [];
  for (const suite of requiredSuites) {
    if (typeof suite !== 'string' || !isSuite(suite))
      throw new Error('REQUIREMENTS_SHAPE: required suite');
    if (!covered.has(suite)) throw new Error(`REQUIRED_SUITE_ABSENT: ${suite}`);
    suites.push(suite);
  }
  return { requiredSuites: suites, requirements: normalized };
}

export function loadRequirementRegister(root: string): RequirementRegister {
  const parsed: unknown = JSON.parse(
    readFileSync(path.join(root, 'docs/releases/requirements.json'), 'utf8'),
  );
  return checkRequirementRegister(root, parsed);
}
