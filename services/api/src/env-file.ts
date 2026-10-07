import { readFileSync } from 'node:fs';

// Read a local env file without printing it. Existing process values win, so a
// shell export is never replaced by a file.
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const body = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separator = body.indexOf('=');
    if (separator <= 0) throw new Error('ENV_FILE_INVALID');
    const key = body.slice(0, separator).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error('ENV_FILE_INVALID');
    let value = body.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function applyEnvFile(text: string, target: NodeJS.ProcessEnv = process.env): void {
  for (const [key, value] of Object.entries(parseEnvFile(text))) {
    if (target[key] === undefined) target[key] = value;
  }
}

export function loadEnvFile(path: string, target: NodeJS.ProcessEnv = process.env): boolean {
  try {
    applyEnvFile(readFileSync(path, 'utf8'), target);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export function loadApiEnvFile(path: string, target: NodeJS.ProcessEnv = process.env): boolean {
  const loaded = loadEnvFile(path, target);
  if (target.DEPLOYER_PRIVATE_KEY !== undefined) throw new Error('DEPLOYER_KEY_IN_API_ENVIRONMENT');
  return loaded;
}
