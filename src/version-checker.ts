import type { ReleaseInfo } from './types.js';
import type { Logger } from './logger.js';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO = 'anthropics/claude-code';
const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, logger: Logger, retries: number = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'claude-release-bot',
        },
      });

      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const waitMs = resetTime
          ? (parseInt(resetTime, 10) * 1000) - Date.now()
          : 60_000;
        logger.warn(`GitHub API rate limited, waiting ${Math.ceil(waitMs / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, Math.max(waitMs, 1000)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`GitHub API attempt ${attempt} failed, retrying in ${delay}ms`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
}

function parseRelease(data: Record<string, unknown>): ReleaseInfo {
  const tagName = data['tag_name'] as string;
  return {
    tagName,
    version: tagName.replace(/^v/, ''),
    name: (data['name'] as string) || tagName,
    body: (data['body'] as string) || '',
    publishedAt: data['published_at'] as string,
    htmlUrl: data['html_url'] as string,
  };
}

export async function getLatestRelease(logger: Logger): Promise<ReleaseInfo> {
  logger.debug('Fetching latest release from GitHub');
  const response = await fetchWithRetry(
    `${GITHUB_API_BASE}/repos/${REPO}/releases/latest`,
    logger,
  );
  const data = await response.json() as Record<string, unknown>;
  const release = parseRelease(data);
  logger.info(`Latest release: ${release.version}`);
  return release;
}

export async function getReleasesSince(sinceVersion: string, logger: Logger): Promise<ReleaseInfo[]> {
  logger.debug(`Fetching releases since v${sinceVersion}`);
  const response = await fetchWithRetry(
    `${GITHUB_API_BASE}/repos/${REPO}/releases?per_page=20`,
    logger,
  );
  const data = await response.json() as Record<string, unknown>[];

  const releases: ReleaseInfo[] = [];
  for (const item of data) {
    const release = parseRelease(item);
    if (release.version === sinceVersion) break;
    releases.push(release);
  }

  // Return oldest first
  releases.reverse();
  logger.info(`Found ${releases.length} new release(s) since v${sinceVersion}`);
  return releases;
}
