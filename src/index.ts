import cron from 'node-cron';
import { loadConfig } from './config.js';
import { Logger } from './logger.js';
import { checkForUpdates } from './check-update.js';

function hoursToCron(hours: number): string {
  if (hours <= 0 || hours > 24) return '0 */4 * * *';
  return `0 */${hours} * * *`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logsDir, config.logLevel);
  const isOnce = process.argv.includes('--once');
  const cronExpr = hoursToCron(config.checkIntervalHours);

  logger.info('Claude Release Bot starting', {
    mode: isOnce ? 'once' : 'daemon',
    intervalHours: config.checkIntervalHours,
    cron: cronExpr,
  });

  if (isOnce) {
    try {
      await checkForUpdates(config, logger);
      logger.info('Single run completed');
    } catch (err) {
      logger.error('Check failed', err);
      process.exit(1);
    }
    return;
  }

  // Daemon mode - run immediately on start, then on cron schedule
  logger.info('Running initial check...');
  try {
    await checkForUpdates(config, logger);
  } catch (err) {
    logger.error('Initial check failed', err);
  }

  logger.info(`Scheduling checks every ${config.checkIntervalHours} hour(s) (cron: ${cronExpr})`);
  cron.schedule(cronExpr, async () => {
    logger.info('Scheduled check triggered');
    try {
      await checkForUpdates(config, logger);
    } catch (err) {
      logger.error('Scheduled check failed', err);
    }
  });

  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
