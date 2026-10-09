import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DocsQuestionSchema, type DocsAssistant } from './service.js';

const QuestionSchema = z.strictObject({ question: DocsQuestionSchema });

export function registerDocsRoutes(app: FastifyInstance, assistant: DocsAssistant): void {
  app.get('/v1/docs/agent', async () => ({ configured: assistant.configured }));
  app.post('/v1/docs/ask', async (request) => {
    const input = QuestionSchema.parse(request.body);
    return assistant.ask(input.question, `web:${request.ip || 'unknown'}`);
  });
}
