import { GoogleGenAI } from '@google/genai';
import type { AiSummary, ParsedChangelog } from './types.js';
import type { Logger } from './logger.js';

const MODEL = 'gemini-2.5-flash-lite';
const MAX_RETRIES = 2;

const LANGUAGE_CONFIG: Record<string, { name: string; example: { summary: string[]; tips: string[] } }> = {
  ko: {
    name: 'Korean',
    example: { summary: ['변경사항 1', '변경사항 2'], tips: ['실용 팁 1', '실용 팁 2'] },
  },
  en: {
    name: 'English',
    example: { summary: ['Change 1', 'Change 2'], tips: ['Practical tip 1', 'Practical tip 2'] },
  },
};

function buildSystemPrompt(language: string): string {
  const lang = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG['en'];

  return `You are a technical writer who summarizes software changelogs in ${lang.name}.
Given a list of changes for Claude Code (an AI coding assistant CLI tool), you must:

1. Summarize key changes in ${lang.name} (keep technical terms like API, CLI, hook, MCP in English)
2. Provide practical tips on how users can benefit from these changes
3. Assess the impact level: "major" (breaking changes or significant features), "minor" (new features or improvements), "patch" (bug fixes only)

Respond ONLY with valid JSON in this exact format:
{
  "summary": ["${lang.example.summary[0]}", "${lang.example.summary[1]}"],
  "tips": ["${lang.example.tips[0]}", "${lang.example.tips[1]}"],
  "impact": "patch"
}

Keep summaries concise (1 line each, max 8 items).
Keep tips actionable and practical (max 3 items).`;
}

function buildUserPrompt(changelog: ParsedChangelog): string {
  const categorized: Record<string, string[]> = {};
  for (const item of changelog.items) {
    if (!categorized[item.category]) categorized[item.category] = [];
    categorized[item.category].push(item.description);
  }

  let prompt = `Claude Code v${changelog.version} changelog:\n\n`;
  for (const [category, items] of Object.entries(categorized)) {
    prompt += `### ${category}\n`;
    for (const item of items) {
      prompt += `- ${item}\n`;
    }
    prompt += '\n';
  }

  return prompt;
}

function parseSummaryResponse(text: string): AiSummary {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = (jsonMatch[1] || text).trim();
  const parsed = JSON.parse(jsonStr) as AiSummary;

  if (!Array.isArray(parsed.summary) || !Array.isArray(parsed.tips) || !parsed.impact) {
    throw new Error('Invalid AI summary format');
  }

  return parsed;
}

export async function summarizeChangelog(
  changelog: ParsedChangelog,
  apiKey: string,
  logger: Logger,
  language: string = 'ko',
): Promise<AiSummary | null> {
  if (changelog.items.length === 0) {
    logger.info('No changelog items to summarize');
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = buildUserPrompt(changelog);
  const systemPrompt = buildSystemPrompt(language);
  logger.debug('AI prompt', { prompt: userPrompt, language });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Empty response from Gemini');

      logger.debug('AI raw response', { text });
      const summary = parseSummaryResponse(text);
      logger.info('AI summary generated', { impact: summary.impact, items: summary.summary.length });
      return summary;
    } catch (err) {
      logger.warn(`AI summarize attempt ${attempt} failed`, err);
      if (attempt === MAX_RETRIES) {
        logger.error('AI summarization failed, will use fallback');
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  return null;
}

export function buildFallbackSummary(changelog: ParsedChangelog): AiSummary {
  return {
    summary: changelog.items.map(item => `[${item.category}] ${item.description}`),
    tips: [],
    impact: 'patch',
  };
}
