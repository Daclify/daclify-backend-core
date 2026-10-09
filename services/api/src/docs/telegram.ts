import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { readBoundedResponse } from '../http.js';
import { createWindowLimiter } from '../limits.js';
import type { DocsAssistant } from './service.js';
import type { TelegramDocsConfiguration } from './telegram-config.js';

export const TELEGRAM_DOCS_PATH = '/v1/docs/telegram/webhook';
const UserSchema = z.object({ id: z.number().int().positive().safe(), is_bot: z.boolean() });
const MessageSchema = z.object({
  message_id: z.number().int().positive().safe(),
  date: z.number().int().nonnegative().safe(),
  from: UserSchema.optional(),
  chat: z.object({ id: z.number().int().safe(), type: z.string() }),
  text: z.string().max(4096).optional(),
  message_thread_id: z.number().int().positive().safe().optional(),
  reply_to_message: z
    .object({ from: UserSchema.optional(), text: z.string().max(4096).optional() })
    .optional(),
});
const UpdateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z.unknown().optional(),
});

export function telegramQuestion(
  value: unknown,
  config: TelegramDocsConfiguration,
  now = Date.now(),
) {
  const parsed = MessageSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const message = parsed.data;
  if (
    !message.from ||
    message.from.is_bot ||
    !message.text ||
    message.date * 1000 > now + 60_000 ||
    message.date * 1000 < now - 86_400_000
  )
    return undefined;
  const privateChat =
    message.chat.type === 'private' &&
    message.chat.id === message.from.id &&
    config.privateChatIds.includes(String(message.chat.id));
  const groupChat =
    ['group', 'supergroup'].includes(message.chat.type) &&
    config.groupIds.includes(String(message.chat.id));
  if (!privateChat && !groupChat) return undefined;
  const command = message.text.match(/^\/docs(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
  let previousAnswer: string | undefined;
  if (command?.[1] && command[1].toLowerCase() !== config.username.toLowerCase()) return undefined;
  if (!command) {
    const replyToBot =
      message.reply_to_message?.from?.id === config.botId && message.reply_to_message.from.is_bot;
    if (message.text.startsWith('/') || (!privateChat && !replyToBot)) return undefined;
    if (replyToBot) previousAnswer = message.reply_to_message?.text?.slice(0, 2500);
  }
  const question = (command ? (command[2] ?? '') : message.text).trim();
  if (question.length > 500) return undefined;
  return {
    question,
    previousAnswer,
    chatId: String(message.chat.id),
    userId: String(message.from.id),
    messageId: message.message_id,
    threadId: message.message_thread_id,
  };
}

export async function telegramCall(
  token: string,
  method: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const result = z
      .object({ ok: z.literal(true), result: z.unknown() })
      .parse(JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 65_536))));
    if (!response.ok) throw new Error();
    return result.result;
  } catch {
    // Never expose fetch errors: Telegram request URLs contain the bot token.
    throw new ApiError('TELEGRAM_DOCS_PROVIDER_FAILED', 502);
  }
}

export async function claimTelegramUpdate(
  pool: Pool,
  botId: number,
  updateId: number,
): Promise<boolean> {
  await pool.query(
    "DELETE FROM telegram_docs_receipts WHERE received_at < now() - interval '2 days'",
  );
  const result = await pool.query(
    'INSERT INTO telegram_docs_receipts(bot_id,update_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING update_id',
    [botId, updateId],
  );
  return result.rowCount === 1;
}

export function registerTelegramDocsRoutes(
  app: FastifyInstance,
  config: TelegramDocsConfiguration,
  assistant: DocsAssistant,
  claim: (updateId: number) => Promise<boolean>,
  fetchImpl: typeof fetch = fetch,
): void {
  const admit = createWindowLimiter(30, 600_000, 80);
  app.post(
    TELEGRAM_DOCS_PATH,
    {
      bodyLimit: 65_536,
      onRequest: async (request) => {
        const value = request.headers['x-telegram-bot-api-secret-token'];
        if (
          typeof value !== 'string' ||
          Buffer.byteLength(value) !== Buffer.byteLength(config.secret) ||
          !timingSafeEqual(Buffer.from(value), Buffer.from(config.secret))
        )
          throw new ApiError('TELEGRAM_DOCS_UNAUTHORIZED', 401);
      },
    },
    async (request) => {
      const update = UpdateSchema.parse(request.body);
      const input = telegramQuestion(update.message, config);
      if (!input || !(await claim(update.update_id))) return { ok: true };
      if (!admit(input.chatId, Date.now())) return { ok: true };
      let text = `Ask /docs@${config.username} followed by a Daclify question, or reply to my answer. I cover only the Daclify handbook and documented setup. Do not send passwords, recovery kits or provider keys.`;
      if (input.question.length >= 2) {
        try {
          const answer = await assistant.ask(
            input.question,
            `telegram:${input.chatId}:${input.userId}`,
            input.previousAnswer,
          );
          text =
            answer.answer +
            (answer.topicId
              ? `\n\nSource: ${config.frontendOrigin}/docs/${encodeURIComponent(answer.topicId)}`
              : '');
        } catch (cause) {
          if (cause instanceof ApiError && cause.code === 'RATE_LIMIT') return { ok: true };
          text =
            'The Daclify handbook assistant is temporarily unavailable. Please try /docs again later. Do not send secrets.';
          console.error('TELEGRAM_DOCS_ANSWER_FAILED');
        }
      }
      // shortcut: claim before send prevents duplicates; a crash can lose a reply. Retry /docs manually.
      try {
        await telegramCall(
          config.token,
          'sendMessage',
          {
            chat_id: input.chatId,
            ...(input.threadId ? { message_thread_id: input.threadId } : {}),
            reply_parameters: { message_id: input.messageId, allow_sending_without_reply: false },
            text,
            link_preview_options: { is_disabled: true },
          },
          fetchImpl,
        );
      } catch {
        console.error('TELEGRAM_DOCS_SEND_FAILED');
      }
      return { ok: true };
    },
  );
}
