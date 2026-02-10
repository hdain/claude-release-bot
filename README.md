# Claude Release Bot

[한국어](README.ko.md)

An agent that automatically detects new Claude Code releases and sends **AI-summarized notifications** via Telegram. (Korean / English)

## Features

- Auto-detect new releases via GitHub Releases polling (default: every 4 hours)
- AI-powered changelog summary using Gemini (Korean / English)
- Practical usage tips included (new commands, config changes, etc.)
- Graceful fallback to raw changelog when AI summarization fails
- Resumes from last state after process restart

## Prerequisites

- Node.js 18+
- pnpm

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Set the following 3 required keys in `.env`:

| Variable | Description | How to get |
|----------|-------------|------------|
| `GEMINI_API_KEY` | Google Gemini API Key | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | Create a bot via [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | Send a message to your bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates` |

### 3. Run

```bash
# Single run (for testing)
pnpm once
```

There are two ways to run the bot continuously. **Choose one, not both:**

#### Option A: Daemon mode (`pnpm start`)

The process stays alive and uses node-cron for scheduling internally.

```bash
pnpm start
```

- Simple — just run and leave the terminal open
- Stops when the terminal is closed or the machine reboots
- Good for testing or short-term use

#### Option B: macOS launchd (recommended)

macOS launches the bot every 4 hours in `--once` mode, then the process exits. Survives reboots automatically.

> **Note:** Rename the plist file replacing `dani` with your username (e.g. `com.yourname.claude-release-bot.plist`), and update the paths inside to match your environment (Node.js path, project directory).

```bash
# Create symlink for plist
ln -s "$(pwd)/com.{username}.claude-release-bot.plist" ~/Library/LaunchAgents/

# Load and start the service
launchctl load ~/Library/LaunchAgents/com.{username}.claude-release-bot.plist

# Stop the service
launchctl unload ~/Library/LaunchAgents/com.{username}.claude-release-bot.plist
```

- Runs in the background without a terminal
- Auto-starts on login, survives reboots
- Lower memory usage (process exits between checks)

**Check service status:**

```bash
# Service status (PID / exit code / label)
# "-" = not running, "0" = last run succeeded
launchctl list | grep claude-release-bot

# View recent run logs
cat logs/launchd-stdout.log
```

## Configuration

Optional settings in `.env`:

```bash
# Summary language (default: ko)
# ko (Korean), en (English)
SUMMARY_LANGUAGE=ko

# Check interval in hours (default: 4)
# Recommended: 1, 2, 3, 4, 6, 8, 12, 24
CHECK_INTERVAL_HOURS=4

# Log level (debug, info, warn, error)
LOG_LEVEL=info
```

## Project Structure

```
src/
├── index.ts              # Entry point (--once / cron mode)
├── check-update.ts       # Orchestrator
├── version-checker.ts    # GitHub Releases API
├── changelog-parser.ts   # Markdown parsing
├── ai-summarizer.ts      # Gemini API multilingual summary
├── telegram-notifier.ts  # Telegram message delivery
├── state-manager.ts      # Persistent state (JSON)
├── config.ts             # Environment config
├── logger.ts             # Logging with rotation
└── types.ts              # Shared interfaces
```

## How It Works

1. Fetch latest releases from GitHub Releases API (`anthropics/claude-code`)
2. Compare with last checked version in `data/state.json`
3. Parse release notes and generate AI summary in configured language
4. Send formatted notification via Telegram
5. Update state file

> On first run, initializes with the current latest version without sending a notification.

## Testing

```bash
# Test GitHub API fetch
pnpm test:version

# Test Gemini summarization
pnpm test:gemini

# Test Telegram delivery
pnpm test:telegram
```

To test update detection: manually set `lastCheckedVersion` in `data/state.json` to an older version, then run `pnpm once`.
