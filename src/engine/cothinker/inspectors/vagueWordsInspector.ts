import { InspectorFinding, SupportedLang, unicodeWordRegex, detectTextLang } from '../types';

interface VaguePattern {
  regex: RegExp;
  hintRu: string;
  hintEn: string;
}

const VAGUE_PATTERNS: VaguePattern[] = [
  // Russian & English pairs
  {
    regex: unicodeWordRegex('скоро|в будущем|в ближайшее время|со временем|как-нибудь|soon|in the future|eventually|someday'),
    hintRu: 'Укажите конкретную дату или дедлайн вместо размытого горизонта',
    hintEn: 'Replace vague horizon with a concrete date or milestone',
  },
  {
    regex: unicodeWordRegex('значительно|существенно|заметно|сильно|намного|significantly|substantially|greatly|dramatically'),
    hintRu: 'Замените субъективную оценку («значительно») на число или процент',
    hintEn: 'Replace subjective adverb with an exact metric or percentage',
  },
  {
    regex: unicodeWordRegex('улучшить|оптимизировать|повысить эффективность|масштабировать|optimize|improve|scale up|streamline'),
    hintRu: 'Уточните критерий: по какому показателю будет видно улучшение?',
    hintEn: 'Specify measurable criterion: which indicator proves improvement?',
  },
  {
    regex: unicodeWordRegex('некоторые|определенные|ряд|многие|большинство|various|several|many|some|a number of'),
    hintRu: 'Укажите точный объем или долю вместо неопределенного количества',
    hintEn: 'Quantify the volume or exact proportion',
  },
  {
    regex: unicodeWordRegex('постараемся|попробуем|надеемся|вероятно|скорее всего|hopefully|probably|we hope|we will try'),
    hintRu: 'Формулировка выражает неуверенность — опишите план проверки гипотезы',
    hintEn: 'Uncertain commitment — define a validation experiment',
  },
  {
    regex: unicodeWordRegex('качественный|высокий уровень|лучший|уникальный|передовой|cutting-edge|high-quality|best|unique'),
    hintRu: 'Оценочное суждение без доказательства — приведите факт или сравнение',
    hintEn: 'Value claim without proof — cite a benchmark or concrete fact',
  },
];

/**
 * Inspect text for vague words and return findings for sentences with unmeasurable phrasing.
 */
export function inspectVagueWords(
  text: string,
  limit = 2,
  lang: SupportedLang = detectTextLang(text)
): InspectorFinding[] {
  if (!text || text.length < 20) return [];

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const findings: InspectorFinding[] = [];

  for (const sentence of sentences) {
    for (const pattern of VAGUE_PATTERNS) {
      const match = sentence.match(pattern.regex);
      if (match) {
        const hint = lang === 'en' ? pattern.hintEn : pattern.hintRu;
        const title = lang === 'en' ? `Vague phrasing ("${match[0]}")` : `Размытая формулировка («${match[0]}»)`;
        const detail =
          lang === 'en'
            ? `Sentence contains vague phrasing "${match[0]}": ${hint}.`
            : `Фраза содержит неконкретное слово «${match[0]}»: ${hint}.`;

        findings.push({
          rule: 'vague-phrasing',
          category: 'clarity',
          severity: 'warning',
          title,
          detail,
          quote: sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence,
          suggestion: hint,
        });
        break;
      }
    }
    if (findings.length >= limit) break;
  }

  return findings;
}
