import { InspectorFinding, SupportedLang, detectTextLang } from '../types';

/**
 * Checks for overloaded sentences (>35 words) that hinder clear thinking.
 */
export function inspectReadability(
  text: string,
  limit = 1,
  lang: SupportedLang = detectTextLang(text)
): InspectorFinding[] {
  if (!text || text.length < 120) return [];

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const findings: InspectorFinding[] = [];

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 35) {
      findings.push({
        rule: 'overloaded-sentence',
        category: 'readability',
        severity: 'hint',
        title: lang === 'en' ? `Overloaded sentence (${wordCount} words)` : `Перегруженное предложение (${wordCount} слов)`,
        detail:
          lang === 'en'
            ? 'Long, convoluted sentences hinder comprehension and often hide logical inconsistencies between the premise and conclusion.'
            : 'Длинные предложения затрудняют восприятие мысли и часто скрывают логические несоответствия между началом и концом.',
        quote: sentence.length > 130 ? sentence.slice(0, 127) + '...' : sentence,
        suggestion:
          lang === 'en'
            ? 'Split this sentence into two clear, distinct propositions.'
            : 'Разбейте это предложение на два простых, ясных тезиса.',
      });
      if (findings.length >= limit) break;
    }
  }

  return findings;
}
