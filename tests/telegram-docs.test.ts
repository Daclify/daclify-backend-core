import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { readTelegramDocs } from '../services/api/src/docs/telegram-config.js';
import {
  registerTelegramDocsRoutes,
  telegramQuestion,
  TELEGRAM_DOCS_PATH,
} from '../services/api/src/docs/telegram.js';
import type { DocsAssistant } from '../services/api/src/docs/service.js';
import { setupTelegramDocs } from '../services/api/src/docs/telegram-setup.js';
import { telegramCall } from '../services/api/src/docs/telegram.js';

const environment = {
  TELEGRAM_DOCS_ENABLED: 'true',
  OPENROUTER_API_KEY: 'fixture-openrouter-key',
  TELEGRAM_BOT_TOKEN: '12345:fixture',
  TELEGRAM_BOT_USERNAME: 'daclify_test_bot',
  TELEGRAM_DOCS_WEBHOOK_SECRET: 'a'.repeat(32),
  TELEGRAM_DOCS_WEBHOOK_URL: 'https://testnet.api.daclify.com/v1/docs/telegram/webhook',
  TELEGRAM_DOCS_GROUP_IDS: '["-100123"]',
  FRONTEND_ORIGIN: 'https://testnet.app.daclify.com',
  NETWORK_ENVIRONMENT: 'testnet',
};
const config = readTelegramDocs(environment);
if (!config) throw new Error('Expected fixture config');
const groupMessage = {
  message_id: 12,
  date: Math.floor(Date.now() / 1000),
  from: { id: 987, is_bot: false },
  chat: { id: -100123, type: 'supergroup' },
  text: '/docs@daclify_test_bot How does recovery work?',
  message_thread_id: 44,
};

describe('Telegram docs-only group bot', () => {
  it('is disabled by default and requires complete isolated setup when enabled', () => {
    expect(readTelegramDocs({})).toBeUndefined();
    expect(readTelegramDocs({ ...environment, TELEGRAM_DOCS_ENABLED: 'false' })).toBeUndefined();
    for (const patch of [
      { TELEGRAM_DOCS_ENABLED: 'yes' },
      { TELEGRAM_DOCS_GROUP_IDS: '[]' },
      { TELEGRAM_DOCS_GROUP_IDS: '[123]' },
      { TELEGRAM_DOCS_GROUP_IDS: '["123"]' },
      { TELEGRAM_DOCS_WEBHOOK_SECRET: 'short' },
      { OPENROUTER_API_KEY: '' },
      { FRONTEND_ORIGIN: 'http://testnet.app.daclify.com' },
      { TELEGRAM_BOT_USERNAME: '@bad' },
      { TELEGRAM_DOCS_WEBHOOK_URL: 'http://example.com/v1/docs/telegram/webhook' },
      { TELEGRAM_DOCS_WEBHOOK_URL: 'https://example.com/other' },
    ])
      expect(() => readTelegramDocs({ ...environment, ...patch })).toThrow(
        'TELEGRAM_DOCS_CONFIGURATION_INVALID',
      );
  });

  it('accepts commands and replies with a bounded previous answer and preserves topic IDs', () => {
    expect(telegramQuestion(groupMessage, config)).toMatchObject({
      question: 'How does recovery work?',
      threadId: 44,
      messageId: 12,
    });
    expect(
      telegramQuestion({ ...groupMessage, text: '/docs What is Daclify?' }, config)?.question,
    ).toBe('What is Daclify?');
    expect(
      telegramQuestion(
        {
          ...groupMessage,
          text: 'How do I back that up?',
          reply_to_message: {
            from: { id: 12345, is_bot: true },
            text: 'Use the recovery kit.',
          },
        },
        config,
      ),
    ).toMatchObject({
      question: 'How do I back that up?',
      previousAnswer: 'Use the recovery kit.',
    });
  });

  it('ignores normal conversation, other commands/bots, unapproved chats, old messages and oversized questions', () => {
    for (const patch of [
      { text: 'Daclify is great' },
      { text: '/docs@another_bot Help' },
      { text: '/start' },
      { from: { id: 333, is_bot: true } },
      { chat: { id: -100999, type: 'supergroup' } },
      { chat: { id: -100123, type: 'private' } },
      { text: '/docs ' + 'x'.repeat(501) },
      { date: 1 },
      { date: Math.floor(Date.now() / 1000) + 10000 },
      { text: 'Hello', reply_to_message: { from: { id: 777, is_bot: true } } },
    ])
      expect(telegramQuestion({ ...groupMessage, ...patch }, config)).toBeUndefined();
  });

  it('authenticates callbacks, deduplicates before inference, and posts plain replies with a canonical source link', async () => {
    const ids = new Set<number>();
    const sent: unknown[] = [];
    const asked: unknown[] = [];
    const app = Fastify();
    const assistant: DocsAssistant = {
      configured: true,
      ask: async (...args) => {
        asked.push(args);
        return {
          status: 'answered',
          topicId: 'recovery',
          title: 'Recovery',
          answer: '<b>Back up your kit.</b>',
        };
      },
    };
    registerTelegramDocsRoutes(
      app,
      config,
      assistant,
      async (id) => {
        if (ids.has(id)) return false;
        ids.add(id);
        return true;
      },
      async (_, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ ok: true, result: {} }));
      },
    );
    const payload = { update_id: 8, message: groupMessage };
    const denied = await app.inject({ method: 'POST', url: TELEGRAM_DOCS_PATH, payload });
    expect(denied.statusCode).toBe(401);
    expect(ids.size).toBe(0);
    const headers = { 'x-telegram-bot-api-secret-token': environment.TELEGRAM_DOCS_WEBHOOK_SECRET };
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.inject({ method: 'POST', url: TELEGRAM_DOCS_PATH, headers, payload }),
      ),
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(asked).toHaveLength(1);
    expect(sent).toEqual([
      {
        chat_id: '-100123',
        message_thread_id: 44,
        reply_parameters: { message_id: 12, allow_sending_without_reply: false },
        text: '<b>Back up your kit.</b>\n\nSource: https://testnet.app.daclify.com/docs/recovery',
        link_preview_options: { is_disabled: true },
      },
    ]);
    await app.close();
  });

  it('ignores unrelated/edited updates and sends bounded usage help without calling the model', async () => {
    let calls = 0,
      sends = 0;
    const app = Fastify();
    registerTelegramDocsRoutes(
      app,
      config,
      {
        configured: true,
        ask: async () => {
          calls++;
          throw new Error('unused');
        },
      },
      async () => true,
      async () => {
        sends++;
        return new Response('{"ok":true,"result":{}}');
      },
    );
    const headers = { 'x-telegram-bot-api-secret-token': environment.TELEGRAM_DOCS_WEBHOOK_SECRET };
    for (const payload of [
      { update_id: 1, edited_message: groupMessage },
      { update_id: 2, message: { ...groupMessage, text: 'ordinary chat' } },
      { update_id: 4, message: { ...groupMessage, text: 'x'.repeat(5000) } },
      { update_id: 5, message: { unsupported: true } },
    ]) {
      expect(
        (await app.inject({ method: 'POST', url: TELEGRAM_DOCS_PATH, headers, payload }))
          .statusCode,
      ).toBe(200);
    }
    await app.inject({
      method: 'POST',
      url: TELEGRAM_DOCS_PATH,
      headers,
      payload: { update_id: 3, message: { ...groupMessage, text: '/docs' } },
    });
    expect(calls).toBe(0);
    expect(sends).toBe(1);
    await app.close();
  });

  it('checks privacy, membership and webhook conflicts before explicit registration', async () => {
    const methods: string[] = [];
    let conflict = false,
      admin = false;
    const fetchImpl: typeof fetch = async (input, init) => {
      const method = String(input).split('/').at(-1) ?? '';
      methods.push(method);
      const result =
        method === 'getMe'
          ? {
              id: 12345,
              username: 'daclify_test_bot',
              can_join_groups: true,
              can_read_all_group_messages: false,
            }
          : method === 'getWebhookInfo'
            ? { url: conflict ? 'https://other.example/hook' : '' }
            : method === 'getChat'
              ? { type: 'supergroup' }
              : method === 'getChatMember'
                ? { status: admin ? 'administrator' : 'member' }
                : true;
      if (method === 'setWebhook')
        expect(JSON.parse(String(init?.body))).toEqual({
          url: config.webhookUrl,
          secret_token: config.secret,
          allowed_updates: ['message'],
          max_connections: 4,
        });
      return new Response(JSON.stringify({ ok: true, result }));
    };
    expect(await setupTelegramDocs(config, false, fetchImpl)).toMatchObject({
      mode: 'read-only',
      approvedGroups: 1,
    });
    expect(methods).not.toContain('setWebhook');
    conflict = true;
    await expect(setupTelegramDocs(config, true, fetchImpl)).rejects.toThrow(
      'TELEGRAM_DOCS_WEBHOOK_CONFLICT',
    );
    conflict = false;
    admin = true;
    await expect(setupTelegramDocs(config, true, fetchImpl)).rejects.toThrow(
      'TELEGRAM_DOCS_GROUP_CONFIGURATION_INVALID',
    );
    expect(methods).not.toContain('setWebhook');
    admin = false;
    expect(await setupTelegramDocs(config, true, fetchImpl)).toMatchObject({
      mode: 'registered',
      webhookMatches: true,
    });
    expect(methods.filter((method) => method === 'setWebhook')).toHaveLength(1);
  });

  it('does not leak token-bearing fetch errors or oversized provider bodies', async () => {
    for (const fetchImpl of [
      async () => {
        throw new Error(`Failed https://api.telegram.org/bot${config.token}/sendMessage`);
      },
      async () => new Response('x'.repeat(70_000)),
      async () => new Response('{"ok":false,"description":"private provider detail"}'),
    ])
      await expect(telegramCall(config.token, 'sendMessage', {}, fetchImpl)).rejects.toMatchObject({
        message: 'TELEGRAM_DOCS_PROVIDER_FAILED',
      });
  });
});
