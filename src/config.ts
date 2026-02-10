import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenvConfig({ path: path.join(PROJECT_ROOT, '.env') });

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

function validateIntervalHours(value: string | undefined): number {
  const hours = Number(value || '4');
  if (isNaN(hours) || hours <= 0 || hours > 24) {
    throw new Error(`Invalid CHECK_INTERVAL_HOURS: "${value}". Must be a number between 1 and 24.`);
  }
  return hours;
}

function validateLogLevel(value: string | undefined): AppConfig['logLevel'] {
  const level = value || 'info';
  if (!VALID_LOG_LEVELS.includes(level as AppConfig['logLevel'])) {
    throw new Error(`Invalid LOG_LEVEL: "${value}". Must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
  }
  return level as AppConfig['logLevel'];
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    geminiApiKey: requireEnv('GEMINI_API_KEY'),
    telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    telegramChatId: requireEnv('TELEGRAM_CHAT_ID'),
    checkIntervalHours: validateIntervalHours(process.env['CHECK_INTERVAL_HOURS']),
    logLevel: validateLogLevel(process.env['LOG_LEVEL']),
    summaryLanguage: process.env['SUMMARY_LANGUAGE'] || 'ko',
    dataDir: path.join(PROJECT_ROOT, 'data'),
    logsDir: path.join(PROJECT_ROOT, 'logs'),
  };
}
