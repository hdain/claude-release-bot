# Claude Release Bot

[English](README.md)

Claude Code의 새 버전을 자동 감지하여 **AI 요약 알림**을 Telegram으로 전송하는 에이전트입니다. (한국어/영어 지원)

## 주요 기능

- GitHub Releases 폴링으로 새 버전 자동 감지 (하루 6회)
- Gemini AI를 활용한 변경사항 요약 (한국어/영어 지원)
- 실용적 활용 팁 포함 (새 명령어, 설정 변경법 등)
- AI 요약 실패 시 raw 변경사항으로 fallback
- 프로세스 재시작 후에도 마지막 상태에서 이어서 동작

## 사전 요구사항

- Node.js 18+
- pnpm

## 설치

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 아래 3개 키를 설정합니다:

| 변수 | 설명 | 발급 방법 |
|------|------|----------|
| `GEMINI_API_KEY` | Google Gemini API Key | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | [@BotFather](https://t.me/BotFather)에서 봇 생성 |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | 봇에 메시지 전송 후 `https://api.telegram.org/bot<TOKEN>/getUpdates` 에서 확인 |

### 3. 실행

```bash
# 1회 실행 (테스트용)
pnpm once
```

봇을 지속적으로 실행하는 방법은 두 가지입니다. **둘 중 하나만 선택하세요:**

#### 방법 A: 상주 모드 (`pnpm start`)

프로세스가 계속 떠있으면서 내부 node-cron으로 스케줄링합니다. 체크 간격은 `CHECK_INTERVAL_HOURS` 환경변수로 조절합니다 (기본: 4시간).

```bash
pnpm start
```

- 간단 — 터미널에서 바로 실행
- 터미널을 닫거나 재부팅하면 종료됨
- 테스트나 단기 사용에 적합

#### 방법 B: macOS launchd (권장)

macOS가 정해진 시각에 `--once` 모드로 봇을 실행하고, 완료되면 프로세스가 종료됩니다. 기본 스케줄은 하루 6회 (1:00, 5:00, 9:00, 13:00, 17:00, 21:00)이며, 시각을 변경하려면 plist 파일의 `StartCalendarInterval`을 직접 수정하세요.

`StartCalendarInterval`을 사용하므로, Mac이 잠자기 중 놓친 스케줄이 있으면 깨어날 때 **1회만** catch-up 실행됩니다 (놓친 횟수만큼 실행되지 않음).

> **참고:** plist 파일명의 `dani`를 본인 유저이름으로 변경하고 (예: `com.yourname.claude-release-bot.plist`), 내부 경로도 본인 환경에 맞게 수정하세요 (Node.js 경로, 프로젝트 디렉토리).

```bash
# plist 심볼릭 링크 생성
ln -s "$(pwd)/com.{username}.claude-release-bot.plist" ~/Library/LaunchAgents/

# 서비스 등록 및 시작
launchctl load ~/Library/LaunchAgents/com.{username}.claude-release-bot.plist

# 서비스 중지
launchctl unload ~/Library/LaunchAgents/com.{username}.claude-release-bot.plist
```

- 터미널 없이 백그라운드 실행
- 로그인 시 자동 시작, 재부팅에도 유지
- 체크 사이에 프로세스가 종료되어 메모리 절약
- `CHECK_INTERVAL_HOURS`는 launchd에 **영향 없음** — 스케줄 변경은 plist 직접 수정

**서비스 상태 확인:**

```bash
# 서비스 상태 (PID / 종료 코드 / 라벨)
# "-" = 현재 실행 중 아님, "0" = 마지막 실행 성공
launchctl list | grep claude-release-bot

# 최근 실행 로그 확인
cat logs/launchd-stdout.log
```

## 설정

`.env`에서 선택적으로 설정 가능:

```bash
# 요약 언어 (기본: ko)
# ko (한국어), en (English)
SUMMARY_LANGUAGE=ko

# 체크 간격 - pnpm start 전용, 시간 단위 (기본: 4)
# 권장값: 1, 2, 3, 4, 6, 8, 12, 24
# 참고: launchd 사용 시 무시됨 — plist를 직접 수정하세요
CHECK_INTERVAL_HOURS=4

# 로그 레벨 (debug, info, warn, error)
LOG_LEVEL=info
```

## 프로젝트 구조

```
src/
├── index.ts              # 진입점 (--once / cron 모드)
├── check-update.ts       # 오케스트레이터
├── version-checker.ts    # GitHub Releases API
├── changelog-parser.ts   # 마크다운 파싱
├── ai-summarizer.ts      # Gemini API 다국어 요약
├── telegram-notifier.ts  # Telegram 메시지 전송
├── state-manager.ts      # 상태 관리 (JSON)
├── config.ts             # 환경변수 설정
├── logger.ts             # 로깅 (rotation 지원)
└── types.ts              # 공유 인터페이스
```

## 동작 방식

1. GitHub Releases API에서 `anthropics/claude-code` 최신 릴리스 확인
2. `data/state.json`에 저장된 마지막 버전과 비교
3. 새 버전 발견 시 릴리스 노트를 파싱하고 Gemini로 설정된 언어의 요약 생성
4. Telegram으로 포맷팅된 알림 전송
5. 상태 파일 업데이트

> 첫 실행 시에는 현재 최신 버전으로 초기화만 하고 알림을 보내지 않습니다.

## 테스트

```bash
# 버전 체크 테스트 (GitHub API)
pnpm test:version

# Gemini 요약 테스트
pnpm test:gemini

# Telegram 전송 테스트
pnpm test:telegram
```

업데이트 감지 테스트: `data/state.json`의 `lastCheckedVersion`을 이전 버전으로 수동 변경 후 `pnpm once` 실행.
