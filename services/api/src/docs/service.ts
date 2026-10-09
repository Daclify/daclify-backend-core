import { z } from 'zod';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import { answerHandbookQuestion } from './agent.js';
import type { DocsAgentConfiguration } from './config.js';
import { handbookTopics } from './handbook.js';
import { DocsAgentStatusSchema } from '../../../../protocol/service-api.js';
import { VERSION } from '../../../../protocol/base.js';

export const DocsQuestionSchema = z.string().trim().min(2).max(500);

export function createDocsAssistant(agent: DocsAgentConfiguration | undefined) {
  const topics = handbookTopics();
  const admit = createWindowLimiter(12, 10 * 60 * 1000, 80);
  let active = 0;
  return {
    configured: Boolean(agent),
    status: DocsAgentStatusSchema.parse({
      configured: Boolean(agent),
      profile: {
        name: 'Daxi',
        scope: ['Daclify', 'Telos', 'DAOs'],
        answerModel: agent?.model ?? null,
        decisionsModel: agent?.decisionsModel ?? null,
        knowledgeVersion: VERSION,
      },
    }),
    async ask(question: string, subject: string, previousAnswer?: string) {
      const input = DocsQuestionSchema.parse(question);
      const context = z.string().max(2500).optional().parse(previousAnswer);
      if (!agent) throw new ApiError('DOCS_AGENT_UNAVAILABLE', 503);
      if (active >= 4 || !admit(subject, Date.now())) throw new ApiError('RATE_LIMIT', 429);
      active++;
      try {
        return await answerHandbookQuestion(input, topics, agent, context);
      } catch {
        throw new ApiError('DOCS_AGENT_FAILED', 502);
      } finally {
        active--;
      }
    },
  };
}
export type DocsAssistant = ReturnType<typeof createDocsAssistant>;
