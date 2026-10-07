import { loadApiEnvFile } from './env-file.js';

loadApiEnvFile(process.env.DACLIFY_ENV_FILE ?? '.env');
