import type { AppConfig, TelegramMessage } from './types.js';
import type { Logger } from './logger.js';
import { StateManager } from './state-manager.js';
import { getLatestRelease, getReleasesSince } from './version-checker.js';
import { parseChangelog } from './changelog-parser.js';
import { summarizeChangelog, buildFallbackSummary } from './ai-summarizer.js';
import { formatMessage, sendTelegramMessage } from './telegram-notifier.js';

export async function checkForUpdates(config: AppConfig, logger: Logger): Promise<void> {
  const stateManager = new StateManager(config.dataDir, logger);
  const state = stateManager.load();

  // First run: initialize state with current latest version, no notification
  if (!state) {
    logger.info('First run detected, initializing state');
    const latest = await getLatestRelease(logger);
    stateManager.save({
      lastCheckedVersion: latest.version,
      lastCheckedAt: new Date().toISOString(),
    });
    logger.info(`Initialized with version v${latest.version}. No notification sent on first run.`);
    return;
  }

  logger.info(`Current tracked version: v${state.lastCheckedVersion}`);

  // Fetch new releases since last checked
  const newReleases = await getReleasesSince(state.lastCheckedVersion, logger);

  if (newReleases.length === 0) {
    logger.info('No new updates found');
    stateManager.save({
      ...state,
      lastCheckedAt: new Date().toISOString(),
    });
    return;
  }

  // Process each new release (oldest first)
  for (const release of newReleases) {
    logger.info(`Processing release v${release.version}`);

    // Parse changelog
    const changelog = parseChangelog(release);
    logger.info(`Parsed ${changelog.items.length} change items`);

    // AI summarize (with fallback)
    let summary = await summarizeChangelog(changelog, config.geminiApiKey, logger, config.summaryLanguage);
    if (!summary) {
      logger.warn('Using fallback summary (no AI)');
      summary = buildFallbackSummary(changelog);
    }

    // Format date
    const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US' };
    const locale = localeMap[config.summaryLanguage] || 'en-US';
    const date = new Date(release.publishedAt).toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Build Telegram message
    const telegramMsg: TelegramMessage = {
      previousVersion: state.lastCheckedVersion,
      newVersion: release.version,
      date,
      changes: summary.summary,
      tips: summary.tips,
      releaseUrl: release.htmlUrl,
    };

    const formattedText = formatMessage(telegramMsg, config.summaryLanguage);
    logger.debug('Formatted message', { text: formattedText });

    // Send notification
    const sent = await sendTelegramMessage(
      config.telegramBotToken,
      config.telegramChatId,
      formattedText,
      logger,
    );

    if (sent) {
      // Update state only after successful notification
      stateManager.save({
        lastCheckedVersion: release.version,
        lastCheckedAt: new Date().toISOString(),
        lastNotifiedAt: new Date().toISOString(),
      });
      // Update previousVersion for next iteration
      state.lastCheckedVersion = release.version;
      logger.info(`Successfully notified for v${release.version}`);
    } else {
      logger.error(`Failed to send notification for v${release.version}, will retry next cycle`);
      // Stop processing further releases - will retry from this version next time
      break;
    }
  }
}
