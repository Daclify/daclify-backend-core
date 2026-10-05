import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

async function lint(source: string, filePath: string) {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(source, { filePath });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

describe('lint policy', () => {
  it('rejects explicit any', async () => {
    const rules = await lint('export const value: any = 1;\n', 'tools/probe.ts');
    expect(rules).toContain('@typescript-eslint/no-explicit-any');
  });

  it('rejects a TypeScript suppression comment', async () => {
    const rules = await lint(
      '// @ts-expect-error hidden\nexport const value = 1;\n',
      'tools/probe.ts',
    );
    expect(rules).toContain('@typescript-eslint/ban-ts-comment');
  });

  it('rejects a non-null assertion', async () => {
    const rules = await lint('export const value = (0 as number)!;\n', 'tools/probe.ts');
    expect(rules).toContain('@typescript-eslint/no-non-null-assertion');
  });

  it('rejects an unchecked cast through unknown', async () => {
    const rules = await lint('export const value = 1 as unknown;\n', 'tools/probe.ts');
    expect(rules).toContain('no-restricted-syntax');
  });

  it('accepts an ordinary typed declaration', async () => {
    expect(await lint('export const value = 1;\n', 'tools/probe.ts')).toEqual([]);
  });

  it('does not lint generated producer output', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    expect(await eslint.isPathIgnored('sdk/generated/runtime.ts')).toBe(true);
    expect(await eslint.isPathIgnored('protocol/generated/help.ts')).toBe(true);
  });

  it('fails the GitHub workflow when the sibling checkout token is absent', () => {
    const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
    expect(workflow).toContain('DACLIFY_CHECKOUT_TOKEN');
    expect(workflow).toContain('exit 1');
    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
    expect(workflow).not.toContain('|| true');
  });
});
