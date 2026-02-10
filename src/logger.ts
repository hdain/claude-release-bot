import fs from 'node:fs';
import path from 'node:path';
import type { LogLevel } from './types.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_LOG_SIZE = 1024 * 1024; // 1MB

export class Logger {
  private level: number;
  private logFilePath: string;

  constructor(logsDir: string, level: LogLevel = 'info') {
    this.level = LOG_LEVELS[level];
    fs.mkdirSync(logsDir, { recursive: true });
    this.logFilePath = path.join(logsDir, 'agent.log');
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta
      ? ` ${meta instanceof Error ? meta.stack || meta.message : JSON.stringify(meta)}`
      : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  private rotateIfNeeded(): void {
    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size >= MAX_LOG_SIZE) {
        const rotatedPath = `${this.logFilePath}.1`;
        if (fs.existsSync(rotatedPath)) {
          fs.unlinkSync(rotatedPath);
        }
        fs.renameSync(this.logFilePath, rotatedPath);
      }
    } catch {
      // File doesn't exist yet, no rotation needed
    }
  }

  private writeToFile(formatted: string): void {
    this.rotateIfNeeded();
    fs.appendFileSync(this.logFilePath, formatted + '\n');
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (LOG_LEVELS[level] < this.level) return;

    const formatted = this.formatMessage(level, message, meta);

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }

    this.writeToFile(formatted);
  }

  debug(message: string, meta?: unknown): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.log('error', message, meta);
  }
}
