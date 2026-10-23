// Types for Co-Thinker Thought Inspectors and Cognitive Analysis

export type SupportedLang = 'ru' | 'en';

export interface InspectorFinding {
  rule: string;
  category: 'clarity' | 'actionability' | 'balance' | 'readability' | 'data';
  severity: 'hint' | 'warning' | 'alert';
  title: string;
  detail: string;
  quote?: string;
  suggestion?: string;
}

export interface FocusMatchResult {
  hasCustomPrompt: boolean;
  topic?: 'finance' | 'deadline' | 'risk' | 'execution' | 'metrics' | 'general';
  promptKeywords: string[];
  matchedQuotes: string[];
  missingTopicNotice?: string;
}

export interface DataAnomalyFinding {
  column: string;
  type: 'spike' | 'drop' | 'plateau' | 'missing';
  rowIndex?: number;
  value?: number;
  expected?: number;
  message: string;
}

/**
 * Detect language based on character frequency (Cyrillic vs Latin).
 */
export function detectTextLang(text: string): SupportedLang {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return cyrillic >= latin && cyrillic > 0 ? 'ru' : 'en';
}

/**
 * Creates a Unicode-aware word boundary RegExp that works reliably for both Cyrillic and Latin alphabets.
 * (JS standard \b fails on Cyrillic because \w only matches ASCII [a-zA-Z0-9_]).
 */
export function unicodeWordRegex(pattern: string): RegExp {
  return new RegExp(`(?<=^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}
