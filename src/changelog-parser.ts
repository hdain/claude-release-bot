import type { ChangeCategory, ChangeItem, ParsedChangelog, ReleaseInfo } from './types.js';

const CATEGORY_PATTERNS: [RegExp, ChangeCategory][] = [
  [/^###?\s*(?:bug\s*)?fix(?:e[sd])?/i, 'Fixed'],
  [/^###?\s*add(?:ed)?/i, 'Added'],
  [/^###?\s*(?:new\s*)?feature/i, 'Added'],
  [/^###?\s*improve(?:d|ments?)?/i, 'Improved'],
  [/^###?\s*enhance(?:d|ments?)?/i, 'Improved'],
  [/^###?\s*change(?:d|s)?/i, 'Changed'],
  [/^###?\s*(?:breaking\s*)?change/i, 'Changed'],
  [/^###?\s*remov(?:ed?|al)/i, 'Removed'],
  [/^###?\s*deprecat(?:ed?|ion)/i, 'Removed'],
];

function detectCategory(heading: string): ChangeCategory | null {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(heading.trim())) return category;
  }
  return null;
}

function inferCategoryFromItem(text: string): ChangeCategory {
  const lower = text.toLowerCase();
  if (/\bfix(?:e[sd])?\b/.test(lower)) return 'Fixed';
  if (/\badd(?:ed|s)?\b/.test(lower) || /\bnew\b/.test(lower)) return 'Added';
  if (/\bimprov(?:e[sd]?|ement)\b/.test(lower) || /\benhance/.test(lower)) return 'Improved';
  if (/\bremov(?:e[sd]?|al)\b|deprecat/.test(lower)) return 'Removed';
  if (/\bchang(?:e[sd]?)\b|updat(?:e[sd]?)\b/.test(lower)) return 'Changed';
  return 'Improved';
}

export function parseChangelog(release: ReleaseInfo): ParsedChangelog {
  const { body, version } = release;
  const items: ChangeItem[] = [];

  if (!body || body.trim().length === 0) {
    return { version, items, rawBody: body };
  }

  const lines = body.split('\n');
  let currentCategory: ChangeCategory | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for category headings
    const detected = detectCategory(trimmed);
    if (detected) {
      currentCategory = detected;
      continue;
    }

    // Check for list items
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      const description = listMatch[1].trim();
      if (!description) continue;

      const category = currentCategory || inferCategoryFromItem(description);
      items.push({ category, description });
    }
  }

  return { version, items, rawBody: body };
}
