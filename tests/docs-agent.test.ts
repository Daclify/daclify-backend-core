import { describe, expect, it } from 'vitest';
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
    expect(readDocsAgent({ OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key' })?.model).toBe(
      'openai/gpt-4.1-mini',
    );
  });

  it('uses Jev to select one guide and answers only from that guide', async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      seen.push(url);
      const body = JSON.parse(String(init?.body)) as {
        model?: string;
        messages?: { content: string }[];
      };
      if (url.endsWith('/decisions')) {
        expect(body.model).toBe('typesafe/jev-1.13');
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
    const answer = await answerHandbookQuestion('Where are my keys?', topics, {
      apiKey: 'sk-or-v1-local-fixture-key',
      model: 'openai/gpt-4.1-mini',
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

  it('does not call the language model when Jev marks the question outside the handbook', async () => {
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
        fetch: fetchImpl,
      }),
    ).rejects.toThrow('DOCS_AGENT_FAILED');
  });
});
