// GitHub Release data
export interface ReleaseInfo {
  tagName: string;
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
}

// Parsed changelog categories
export type ChangeCategory = 'Fixed' | 'Added' | 'Improved' | 'Changed' | 'Removed';

export interface ChangeItem {
  category: ChangeCategory;
  description: string;
}

export interface ParsedChangelog {
  version: string;
  items: ChangeItem[];
  rawBody: string;
}

// AI summary output
export interface AiSummary {
  summary: string[];
  tips: string[];
  impact: 'major' | 'minor' | 'patch';
}

// Telegram message payload
export interface TelegramMessage {
  previousVersion: string;
  newVersion: string;
  date: string;
  changes: string[];
  tips: string[];
  releaseUrl: string;
}

// Persistent state
export interface AppState {
  lastCheckedVersion: string;
  lastCheckedAt: string;
  lastNotifiedAt?: string;
}

// Config
export interface AppConfig {
  geminiApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  checkIntervalHours: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  summaryLanguage: string;
  dataDir: string;
  logsDir: string;
}

// Logger levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
