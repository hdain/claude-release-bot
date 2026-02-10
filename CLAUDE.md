# Claude Release Bot

A bot that automatically detects new `anthropics/claude-code` releases and sends AI-summarized notifications via Telegram.

## Architecture

```
index.ts ──→ check-update.ts (orchestrator)
                ├── version-checker.ts  — GitHub Releases API (exponential backoff, 3 retries)
                ├── changelog-parser.ts — Release body markdown → ParsedChangelog
                ├── ai-summarizer.ts    — Gemini 2.5 Flash-Lite → summary in configured language (fallback: raw items)
                ├── telegram-notifier.ts — HTML formatted message → Telegram Bot API
                └── state-manager.ts    — data/state.json (last checked version)
             config.ts  — .env loading/validation
             logger.ts  — Console + file logging (1MB rotation)
             types.ts   — Shared interfaces
```

## Data Flow

1. Fetch latest releases from GitHub Releases API (`anthropics/claude-code`)
2. Compare with `lastCheckedVersion` in `data/state.json`
3. New version found → parse changelog → generate AI summary (raw fallback on failure)
4. Send Telegram message → update state only on successful delivery
5. First run initializes with current latest version without sending notifications

## Tech Stack

- **Runtime**: Node.js 18+ / TypeScript (ESM)
- **AI**: `@google/genai` (Gemini 2.5 Flash-Lite)
- **HTTP**: Node.js native `fetch`
- **Scheduling**: `node-cron` (daemon) or macOS `launchd` (single run)
- **Package manager**: pnpm

## Key Design Decisions

- **Oldest-first processing**: When multiple versions are missed, process them in chronological order
- **Fail-safe state**: State is updated only after successful Telegram delivery — prevents missed notifications
- **Graceful degradation**: Gemini failure → raw changelog fallback; Telegram failure → log and retry next cycle
- **No auth for GitHub**: Unauthenticated API (60 req/hr) — sufficient for 4-hour intervals

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API Key |
| `TELEGRAM_BOT_TOKEN` | Yes | — | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | Yes | — | Telegram Chat ID |
| `SUMMARY_LANGUAGE` | No | `ko` | Summary language (`ko`, `en`) |
| `CHECK_INTERVAL_HOURS` | No | `4` | Polling interval in hours (1, 2, 3, 4, 6, 8, 12, 24) |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |

## Commands

```bash
pnpm once              # Single run (--once mode)
pnpm start             # Daemon mode (cron)
pnpm test:version      # Test GitHub API fetch
pnpm test:gemini       # Test Gemini summarization
pnpm test:telegram     # Test Telegram delivery
```

## Error Handling Strategy

| Layer | Strategy |
|-------|----------|
| GitHub API | Exponential backoff, 3 retries, rate limit aware |
| Gemini API | 2 retries, fallback to raw changelog |
| Telegram API | 3 retries, final failure → log only |
| State file | Read fail → reinitialize, write fail → allow duplicate next cycle |

## Conventions

- TypeScript strict mode
- ESM imports with `.js` extensions
- No hardcoded API keys — `.env` only
- Minimal dependencies (3 runtime deps)
