import { z } from 'zod';
import type { TelegramDocsConfiguration } from './telegram-config.js';
import { telegramCall } from './telegram.js';

export async function setupTelegramDocs(
  config: TelegramDocsConfiguration,
  confirm: boolean,
  fetchImpl: typeof fetch = fetch,
) {
  const identity = z
    .object({
      id: z.number().int().safe(),
      username: z.string(),
      can_join_groups: z.boolean(),
      can_read_all_group_messages: z.boolean().optional(),
    })
    .parse(await telegramCall(config.token, 'getMe', {}, fetchImpl));
  if (
    identity.id !== config.botId ||
    identity.username.toLowerCase() !== config.username.toLowerCase() ||
    !identity.can_join_groups ||
    identity.can_read_all_group_messages
  )
    throw new Error('TELEGRAM_DOCS_BOT_CONFIGURATION_INVALID');
  const webhook = z
    .object({ url: z.string() })
    .parse(await telegramCall(config.token, 'getWebhookInfo', {}, fetchImpl));
  if (webhook.url && webhook.url !== config.webhookUrl)
    throw new Error('TELEGRAM_DOCS_WEBHOOK_CONFLICT');
  for (const chatId of config.groupIds) {
    const chat = z
      .object({ type: z.enum(['group', 'supergroup']) })
      .safeParse(await telegramCall(config.token, 'getChat', { chat_id: chatId }, fetchImpl));
    const member = z
      .object({ status: z.literal('member') })
      .safeParse(
        await telegramCall(
          config.token,
          'getChatMember',
          { chat_id: chatId, user_id: config.botId },
          fetchImpl,
        ),
      );
    if (!chat.success || !member.success)
      throw new Error('TELEGRAM_DOCS_GROUP_CONFIGURATION_INVALID');
  }
  if (confirm) {
    const result = await telegramCall(
      config.token,
      'setWebhook',
      {
        url: config.webhookUrl,
        secret_token: config.secret,
        allowed_updates: ['message'],
        max_connections: 4,
      },
      fetchImpl,
    );
    if (result !== true) throw new Error('TELEGRAM_DOCS_WEBHOOK_FAILED');
  }
  return {
    mode: confirm ? 'registered' : 'read-only',
    approvedGroups: config.groupIds.length,
    privacyMode: true,
    webhookMatches: confirm || webhook.url === config.webhookUrl,
  };
}
