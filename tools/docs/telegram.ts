import '../../services/api/src/load-local-env.js';
import { readTelegramDocs } from '../../services/api/src/docs/telegram-config.js';
import { setupTelegramDocs } from '../../services/api/src/docs/telegram-setup.js';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--confirm') || args.length > 1)
    throw new Error('TELEGRAM_DOCS_ARGUMENTS_INVALID');
  const config = readTelegramDocs(process.env);
  if (!config) throw new Error('TELEGRAM_DOCS_DISABLED');
  console.log(JSON.stringify(await setupTelegramDocs(config, args.includes('--confirm'))));
} catch (cause) {
  const message =
    cause instanceof Error && /^TELEGRAM_DOCS_[A-Z_]+$/.test(cause.message)
      ? cause.message
      : 'TELEGRAM_DOCS_SETUP_FAILED';
  console.error(message);
  process.exitCode = 1;
}
