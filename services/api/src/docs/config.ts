export const DEFAULT_DOCS_MODEL = 'openai/gpt-4.1-mini';

export interface DocsAgentConfiguration {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

export function readDocsAgent(env: NodeJS.ProcessEnv): DocsAgentConfiguration | undefined {
  const apiKey = env.OPENROUTER_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) return undefined;
  const model =
    env.OPENROUTER_MODEL === undefined || env.OPENROUTER_MODEL.length === 0
      ? DEFAULT_DOCS_MODEL
      : env.OPENROUTER_MODEL;
  if (!/^\S{20,512}$/.test(apiKey) || !/^[A-Za-z0-9~][A-Za-z0-9._~/-]{1,80}$/.test(model)) {
    throw new Error('OPENROUTER_CONFIGURATION_INVALID');
  }
  return { apiKey, model };
}
