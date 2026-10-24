import { FocusMatchResult, SupportedLang, unicodeWordRegex, detectTextLang } from './types';

const PROMPT_STOPWORDS = new Set([
  'проведи', 'анализ', 'капсулы', 'капсула', 'проверь', 'посмотри', 'скажи', 'что', 'как', 'для', 'точки', 'зрения', 'честной', 'критики',
  'check', 'analyze', 'capsule', 'review', 'tell', 'what', 'how', 'about', 'from', 'perspective', 'honest', 'critique'
]);

interface TopicDefinition {
  topic: 'finance' | 'deadline' | 'risk' | 'execution' | 'metrics';
  keywordsRegex: RegExp;
  labelRu: string;
  labelEn: string;
  missingNoticeRu: string;
  missingNoticeEn: string;
}

const TOPICS: TopicDefinition[] = [
  {
    topic: 'finance',
    keywordsRegex: unicodeWordRegex('деньг[а-я]*|бюджет[а-я]*|затрат[а-я]*|расход[а-я]*|стоимост[а-я]*|цен[а-я]*|оплат[а-я]*|инвестиц[а-я]*|выручк[а-я]*|прибыл[а-я]*|доход[а-я]*|cost[s]?|budget[s]?|price[s]?|revenue|profit|expense[s]?|money|invest[a-z]*'),
    labelRu: 'Финансы и затраты',
    labelEn: 'Finance and Budget',
    missingNoticeRu: 'Внимание: ваш запрос касается финансов и бюджета, однако в тексте капсулы нет ни одного упоминания цен, затрат или финансовых показателей. Финансовая модель не описана.',
    missingNoticeEn: 'Notice: your query asks about finance/costs, but the capsule contains zero mentions of budget, expenses, or pricing. The financial model is unaddressed.',
  },
  {
    topic: 'deadline',
    keywordsRegex: unicodeWordRegex('срок[а-я]*|дедлайн[а-я]*|когда|успе[а-я]*|график[а-я]*|время[а-я]*|этап[а-я]*|дат[а-я]*|deadline[s]?|schedule[s]?|timeline[s]?|when|time|date[s]?|delay[s]?'),
    labelRu: 'Сроки и дедлайны',
    labelEn: 'Timeline and Deadlines',
    missingNoticeRu: 'Внимание: запрос касается сроков и времени, но в тексте капсулы нет конкретных календарных дат или графика этапов.',
    missingNoticeEn: 'Notice: your query asks about deadlines, but the capsule has no specific dates or delivery milestones.',
  },
  {
    topic: 'risk',
    keywordsRegex: unicodeWordRegex('риск[а-я]*|угроз[а-я]*|ошибк[а-я]*|слома[а-я]*|провал[а-я]*|уязвим[а-я]*|проблем[а-я]*|минус[а-я]*|недостат[а-я]*|risk[s]?|threat[s]?|fail[a-z]*|flaw[s]?|vulnerab[a-z]*|problem[s]?|downside[s]?'),
    labelRu: 'Риски и слабые места',
    labelEn: 'Risks and Vulnerabilities',
    missingNoticeRu: 'Внимание: запрос касается рисков, но в капсуле не описаны возможные точки отказа или альтернативные сценарии.',
    missingNoticeEn: 'Notice: your query asks about risks, but the capsule does not outline potential points of failure.',
  },
  {
    topic: 'execution',
    keywordsRegex: unicodeWordRegex('план[а-я]*|шаг[а-я]*|действи[а-я]*|перв[а-я]*|делать|реализац[а-я]*|внедрен[а-я]*|action[s]?|step[s]?|plan[s]?|execute|implement[a-z]*'),
    labelRu: 'План и действия',
    labelEn: 'Action and Execution',
    missingNoticeRu: 'Внимание: запрос касается реализации, но в капсуле отсутствуют конкретные шаги и исполнители.',
    missingNoticeEn: 'Notice: your query asks about execution, but the capsule lacks clear sequential action steps.',
  },
];

/**
 * Matches the user prompt against the capsule content to provide targeted focus.
 */
export function matchPromptFocus(
  prompt: string | undefined,
  capsuleText: string,
  lang: SupportedLang = detectTextLang(capsuleText + ' ' + (prompt || ''))
): FocusMatchResult {
  if (!prompt || !prompt.trim()) {
    return { hasCustomPrompt: false, promptKeywords: [], matchedQuotes: [] };
  }

  const p = prompt.trim();

  // If prompt is just the default auto-generated boilerplate, treat as no custom prompt
  if (/^(проведи|conduct|run)\s+.*(капсулы|capsule)\s+[«"]/i.test(p)) {
    return { hasCustomPrompt: false, promptKeywords: [], matchedQuotes: [] };
  }
  // Extract keywords from prompt
  const rawTokens = p.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  const keywords = rawTokens.filter((t) => !PROMPT_STOPWORDS.has(t));

  // If no meaningful keywords remain
  if (keywords.length === 0) {
    return { hasCustomPrompt: false, promptKeywords: [], matchedQuotes: [] };
  }

  // Detect domain topic
  let matchedTopic: TopicDefinition | undefined;
  for (const t of TOPICS) {
    if (t.keywordsRegex.test(p)) {
      matchedTopic = t;
      break;
    }
  }

  // Search capsule sentences for prompt keywords or topic keywords
  const sentences = capsuleText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const matchedQuotes: string[] = [];

  for (const sentence of sentences) {
    const sLower = sentence.toLowerCase();
    const matchesKeyword = keywords.some((k) => sLower.includes(k));
    const matchesTopic = matchedTopic ? matchedTopic.keywordsRegex.test(sLower) : false;

    if (matchesKeyword || matchesTopic) {
      matchedQuotes.push(sentence);
      if (matchedQuotes.length >= 3) break;
    }
  }

  let missingTopicNotice: string | undefined;
  if (matchedTopic && matchedQuotes.length === 0) {
    missingTopicNotice = lang === 'en' ? matchedTopic.missingNoticeEn : matchedTopic.missingNoticeRu;
  }

  return {
    hasCustomPrompt: true,
    topic: matchedTopic?.topic || 'general',
    promptKeywords: keywords,
    matchedQuotes,
    missingTopicNotice,
  };
}
