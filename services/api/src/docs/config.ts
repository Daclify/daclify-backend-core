export const DEFAULT_DOCS_MODEL = 'openai/gpt-4.1-mini';
export const DEFAULT_DOCS_DECISIONS_MODEL = 'openai/gpt-6-luna-decisions';

export interface DocsAgentConfiguration {
  apiKey: string;
  model: string;
  decisionsModel: string;
  fetch?: typeof fetch;
}

export function readDocsAgent(env: NodeJS.ProcessEnv): DocsAgentConfiguration | undefined {
  const apiKey = env.OPENROUTER_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) return undefined;
  const model = env.OPENROUTER_MODEL || DEFAULT_DOCS_MODEL;
  const decisionsModel = env.OPENROUTER_DECISIONS_MODEL || DEFAULT_DOCS_DECISIONS_MODEL;
  if (
    !/^\S{20,512}$/.test(apiKey) ||
    ![model, decisionsModel].every((value) => /^[A-Za-z0-9~][A-Za-z0-9._~/-]{1,80}$/.test(value))
  ) {
    throw new Error('OPENROUTER_CONFIGURATION_INVALID');
  }
  return { apiKey, model, decisionsModel };
}
