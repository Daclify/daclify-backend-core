import { z } from 'zod';

const ConfigurationSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().regex(/^[1-9][0-9]{0,15}:[A-Za-z0-9_-]+$/),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
  TELEGRAM_DOCS_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
  TELEGRAM_DOCS_WEBHOOK_URL: z.url(),
  FRONTEND_ORIGIN: z.url(),
  OPENROUTER_API_KEY: z.string().min(20),
});
const ChatIdsSchema = z
  .array(z.string().regex(/^-?[1-9][0-9]{0,15}$/))
  .max(20)
  .refine(
    (ids) =>
      new Set(ids).size === ids.length && ids.every((id) => Number.isSafeInteger(Number(id))),
  );

export function readTelegramDocs(env: NodeJS.ProcessEnv) {
  const enabled = env.TELEGRAM_DOCS_ENABLED || 'false';
  if (enabled === 'false') return undefined;
  try {
    if (enabled !== 'true') throw new Error();
    const config = ConfigurationSchema.parse(env);
    const groupIds = ChatIdsSchema.refine((ids) => ids.every((id) => id.startsWith('-'))).parse(
      JSON.parse(env.TELEGRAM_DOCS_GROUP_IDS || '[]'),
    );
    const privateChatIds = ChatIdsSchema.refine((ids) =>
      ids.every((id) => !id.startsWith('-')),
    ).parse(JSON.parse(env.TELEGRAM_DOCS_PRIVATE_CHAT_IDS || '[]'));
    if (!groupIds.length && !privateChatIds.length) throw new Error();
    const origin = new URL(config.FRONTEND_ORIGIN);
    const webhook = new URL(config.TELEGRAM_DOCS_WEBHOOK_URL);
    if (
      webhook.protocol !== 'https:' ||
      webhook.username ||
      webhook.password ||
      webhook.search ||
      webhook.hash ||
      webhook.pathname !== '/v1/docs/telegram/webhook'
    )
      throw new Error();
    if (
      origin.origin !== config.FRONTEND_ORIGIN.replace(/\/$/, '') ||
      (origin.protocol !== 'https:' &&
        !(
          env.NETWORK_ENVIRONMENT === 'local' &&
          ['localhost', '127.0.0.1'].includes(origin.hostname)
        ))
    )
      throw new Error();
    const botId = Number(config.TELEGRAM_BOT_TOKEN.split(':')[0]);
    if (!Number.isSafeInteger(botId)) throw new Error();
    return {
      token: config.TELEGRAM_BOT_TOKEN,
      username: config.TELEGRAM_BOT_USERNAME,
      botId,
      groupIds,
      privateChatIds,
      secret: config.TELEGRAM_DOCS_WEBHOOK_SECRET,
      frontendOrigin: origin.origin,
      webhookUrl: webhook.href,
    };
  } catch {
    throw new Error('TELEGRAM_DOCS_CONFIGURATION_INVALID');
  }
}
export type TelegramDocsConfiguration = NonNullable<ReturnType<typeof readTelegramDocs>>;
