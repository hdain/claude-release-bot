import type { TelegramMessage } from './types.js';
import type { Logger } from './logger.js';

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;
const MAX_RETRIES = 3;

interface MessageLabels {
  title: string;
  changes: string;
  tips: string;
  link: string;
  truncated: string;
}

const LABELS: Record<string, MessageLabels> = {
  ko: { title: 'Claude Code 업데이트', changes: '주요 변경사항', tips: '실용 팁', link: '전체 변경사항 보기', truncated: '메시지가 잘림' },
  en: { title: 'Claude Code Update', changes: 'Key Changes', tips: 'Practical Tips', link: 'View full changelog', truncated: 'Message truncated' },
};

function getLabels(language: string): MessageLabels {
  return LABELS[language] || LABELS['en'];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatMessage(msg: TelegramMessage, language: string = 'ko'): string {
  const l = getLabels(language);
  let text = '';

  text += `<b>☁️ ${escapeHtml(l.title)}</b>\n`;
  text += `<code>v${escapeHtml(msg.previousVersion)}</code> → <code>v${escapeHtml(msg.newVersion)}</code>\n`;
  text += `📅 ${escapeHtml(msg.date)}\n`;

  if (msg.changes.length > 0) {
    text += `\n<b>📋 ${escapeHtml(l.changes)}</b>\n`;
    for (const change of msg.changes) {
      text += `• ${escapeHtml(change)}\n`;
    }
  }

  if (msg.tips.length > 0) {
    text += `\n<b>💡 ${escapeHtml(l.tips)}</b>\n`;
    for (const tip of msg.tips) {
      text += `• ${escapeHtml(tip)}\n`;
    }
  }

  text += `\n<a href="${escapeHtml(msg.releaseUrl)}">${escapeHtml(l.link)}</a>`;

  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.substring(0, MAX_MESSAGE_LENGTH - 30) + `\n\n... (${l.truncated})`;
  }

  return text;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  logger: Logger,
): Promise<boolean> {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const result = await response.json() as { ok: boolean; description?: string };

      if (result.ok) {
        logger.info('Telegram message sent successfully');
        return true;
      }

      throw new Error(`Telegram API error: ${result.description || 'unknown'}`);
    } catch (err) {
      logger.warn(`Telegram send attempt ${attempt} failed`, err);
      if (attempt === MAX_RETRIES) {
        logger.error('Failed to send Telegram message after all retries');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  return false;
}
