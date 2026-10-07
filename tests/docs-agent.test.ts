import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { answerHandbookQuestion } from '../services/api/src/docs/agent.js';
import { readDocsAgent } from '../services/api/src/docs/config.js';
import { handbookTopics } from '../services/api/src/docs/handbook.js';
import type { HandbookTopic } from '../services/api/src/docs/handbook.js';

const topics: HandbookTopic[] = [
  {
    id: 'accounts',
    title: 'Two clearly labelled account modes',
    paragraphs: ['User-controlled keys stay in the browser vault.'],
  },
  {
    id: 'recovery',
    title: 'Recover without changing identity',
    paragraphs: ['The recovery kit restores the same signing key. Secret marker stays here.'],
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('handbook assistant', () => {
  it('loads the bundled guides', () => {
    const ids = handbookTopics().map((topic) => topic.id);
    expect(ids).toContain('accounts');
    expect(ids).toContain('decide');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves the assistant unconfigured until a key is present', () => {
    expect(readDocsAgent({})).toBeUndefined();
    expect(() => readDocsAgent({ OPENROUTER_API_KEY: 'short' })).toThrow(
      'OPENROUTER_CONFIGURATION_INVALID',
    );
    expect(readDocsAgent({ OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key' })).toEqual({
      apiKey: 'sk-or-v1-local-fixture-key',
      model: 'openai/gpt-4.1-mini',
      decisionsModel: 'openai/gpt-6-luna-decisions',
    });
  });

  it('configures the selector independently from the answer model', () => {
    expect(
      readDocsAgent({
        OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key',
        OPENROUTER_MODEL: 'openai/gpt-6-luna',
        OPENROUTER_DECISIONS_MODEL: 'typesafe/jev-1.13',
      }),
    ).toMatchObject({
      model: 'openai/gpt-6-luna',
      decisionsModel: 'typesafe/jev-1.13',
    });
    expect(
      readDocsAgent({
        OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key',
        OPENROUTER_MODEL: '',
        OPENROUTER_DECISIONS_MODEL: '',
      }),
    ).toMatchObject({
      model: 'openai/gpt-4.1-mini',
      decisionsModel: 'openai/gpt-6-luna-decisions',
    });
  });

  it.each(['bad model', 'bad\nmodel', 'a'.repeat(82)])(
    'rejects an invalid Decisions model name (%j)',
    (model) => {
      expect(() =>
        readDocsAgent({
          OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key',
          OPENROUTER_DECISIONS_MODEL: model,
        }),
      ).toThrow('OPENROUTER_CONFIGURATION_INVALID');
    },
  );

  it.each([
    [undefined, 'openai/gpt-6-luna-decisions'],
    ['typesafe/jev-1.13', 'typesafe/jev-1.13'],
  ])('selects one guide with %s and answers only from that guide', async (configured, model) => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      seen.push(url);
      const body = z
        .object({
          model: z.string(),
          messages: z.array(z.object({ content: z.string() })).optional(),
        })
        .parse(JSON.parse(String(init?.body)));
      if (url.endsWith('/decisions')) {
        expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
        expect(body.model).toBe(model);
        return json({
          answers: {
            in_handbook: { noul: 0.91 },
            topic: {
              choice: 'accounts',
              probabilities: { accounts: 0.8, recovery: 0.1, unlisted: 0.1 },
            },
          },
        });
      }
      const system = body.messages?.[0]?.content ?? '';
      expect(system).toContain('User-controlled keys stay in the browser vault.');
      expect(system).not.toContain('Secret marker stays here.');
      expect(body.model).toBe('openai/gpt-4.1-mini');
      return json({ choices: [{ message: { content: 'The vault holds the keys.' } }] });
    };
    const agent = readDocsAgent({
      OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key',
      OPENROUTER_DECISIONS_MODEL: configured,
    });
    if (!agent) throw new Error('Expected configured assistant');
    const answer = await answerHandbookQuestion('Where are my keys?', topics, {
      ...agent,
      fetch: fetchImpl,
    });
    expect(answer).toEqual({
      status: 'answered',
      topicId: 'accounts',
      title: 'Two clearly labelled account modes',
      answer: 'The vault holds the keys.',
    });
    expect(seen).toHaveLength(2);
  });

  it('does not call the language model when Decisions marks the question outside the handbook', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      expect(String(input)).toContain('/decisions');
      return json({
        answers: {
          in_handbook: { noul: 0.1 },
          topic: { choice: 'unlisted', probabilities: { unlisted: 0.9, accounts: 0.1 } },
        },
      });
    };
    const answer = await answerHandbookQuestion('What is my balance?', topics, {
      apiKey: 'sk-or-v1-local-fixture-key',
      model: 'openai/gpt-4.1-mini',
      decisionsModel: 'openai/gpt-6-luna-decisions',
      fetch: fetchImpl,
    });
    expect(answer.status).toBe('outside');
    expect(calls).toBe(1);
  });

  it('fails closed when OpenRouter rejects the call', async () => {
    const fetchImpl: typeof fetch = async () => json({ error: 'no' }, 401);
    await expect(
      answerHandbookQuestion('Where are my keys?', topics, {
        apiKey: 'sk-or-v1-local-fixture-key',
        model: 'openai/gpt-4.1-mini',
        decisionsModel: 'openai/gpt-6-luna-decisions',
        fetch: fetchImpl,
      }),
    ).rejects.toThrow('DOCS_AGENT_FAILED');
  });

  it('does not spend a chat call for a malformed Decisions response', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return json({ answers: { in_handbook: { noul: 'yes' }, topic: { choice: 'accounts' } } });
    };
    await expect(
      answerHandbookQuestion('Where are my keys?', topics, {
        apiKey: 'sk-or-v1-local-fixture-key',
        model: 'openai/gpt-4.1-mini',
        decisionsModel: 'openai/gpt-6-luna-decisions',
        fetch: fetchImpl,
      }),
    ).rejects.toThrow('DOCS_AGENT_FAILED');
    expect(calls).toBe(1);
  });
});
