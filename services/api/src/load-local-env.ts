import { loadEnvFile } from './env-file.js';

loadEnvFile(process.env.DACLIFY_ENV_FILE ?? '.env');
