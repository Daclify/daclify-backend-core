import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import { answerHandbookQuestion } from './agent.js';
import type { DocsAgentConfiguration } from './config.js';
import { handbookTopics } from './handbook.js';

const QuestionSchema = z.strictObject({ question: z.string().trim().min(2).max(500) });

export function registerDocsRoutes(
  app: FastifyInstance,
  agent: DocsAgentConfiguration | undefined,
): void {
  const topics = handbookTopics();
  const admit = createWindowLimiter(12, 10 * 60 * 1000, 80);
  app.get('/v1/docs/agent', async () => ({ configured: Boolean(agent) }));
  app.post('/v1/docs/ask', async (request) => {
    if (!agent) throw new ApiError('DOCS_AGENT_UNAVAILABLE', 503);
    if (!admit(request.ip || 'unknown', Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const input = QuestionSchema.parse(request.body);
    try {
      return await answerHandbookQuestion(input.question, topics, agent);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'DOCS_AGENT_FAILED') {
        throw new ApiError('DOCS_AGENT_FAILED', 502);
      }
      throw cause;
    }
  });
}
