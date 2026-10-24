import { InspectorFinding, SupportedLang, unicodeWordRegex, detectTextLang } from '../types';

const FRICTION_AND_RISK_WORDS = unicodeWordRegex('но|однако|если|риск[а-я]*|буфер[а-я]*|резерв[а-я]*|просадк[а-я]*|минус[а-я]*|проблем[а-я]*|угроз[а-я]*|ограничени[а-я]*|препятстви[а-я]*|ошибк[а-я]*|сбой[а-я]*|отказ[а-я]*|сложн[а-я]*|сомнева[а-я]*|but|however|risk[s]?|buffer[s]?|downside[s]?|issue[s]?|threat[s]?|limitation[s]?|flaw[s]?|failure[s]?|obstacle[s]?|doubt[s]?');

const POSITIVE_ASSERTION_WORDS = unicodeWordRegex('успех[а-я]*|рост[а-я]*|прибыл[а-я]*|взлетит|прорыв[а-я]*|выгод[а-я]*|лидер[а-я]*|лучш[а-я]*|побед[а-я]*|рекорд[а-я]*|удвоени[а-я]*|growth|success|profit|win|lead|best|benefit|record');

const ABSOLUTE_CLAIMS = unicodeWordRegex('всегда|никогда|гарантированно|гарантирует|стопроцентн[а-я]*|100%|обязательно|без сомнений|always|never|guaranteed|definitely|without doubt');

/**
 * Checks for blind spots, unhedged optimism, and absolute claims.
 */
export function inspectBalance(
  text: string,
  lang: SupportedLang = detectTextLang(text)
): InspectorFinding[] {
  if (!text || text.length < 25) return [];

  const findings: InspectorFinding[] = [];

  // 1. Check for absolute claims
  const absMatch = text.match(ABSOLUTE_CLAIMS);
  if (absMatch) {
    findings.push({
      rule: 'absolute-claim',
      category: 'balance',
      severity: 'warning',
      title: lang === 'en' ? `Absolute phrasing ("${absMatch[0]}")` : `Абсолютная формулировка («${absMatch[0]}»)`,
      detail:
        lang === 'en'
          ? `Words like "${absMatch[0]}" create an illusion of invulnerability. Real-world systems always have edge conditions where the model breaks down.`
          : `Слова вроде «${absMatch[0]}» создают иллюзию неуязвимости. В реальных условиях у любого процесса есть граничные условия, где модель ломается.`,
      suggestion:
        lang === 'en'
          ? 'Describe an edge-case failure mode: under what exact conditions does this assumption stop working?'
          : 'Опишите сценарий исключения: при каких граничных условиях это утверждение перестает работать?',
    });
  }

  // 2. Check for over-optimism (positive words present, but zero friction words)
  const hasPositive = POSITIVE_ASSERTION_WORDS.test(text);
  const hasFriction = FRICTION_AND_RISK_WORDS.test(text);

  if (hasPositive && !hasFriction && text.length > 80) {
    findings.push({
      rule: 'over-optimism',
      category: 'balance',
      severity: 'alert',
      title: lang === 'en' ? 'Unhedged optimism ("rose-colored glasses")' : 'Однобокий оптимизм («розовые очки»)',
      detail:
        lang === 'en'
          ? 'The capsule focuses entirely on upside and growth, without mentioning downside risks, friction, or the cost of failure.'
          : 'В тексте описываются только выгоды и рост, но нет ни одного упоминания рисков, трения или цены ошибки.',
      suggestion:
        lang === 'en'
          ? 'Conduct a mini pre-mortem: if this plan fails completely in 6 months, what would be the #1 cause?'
          : 'Проведите мини-pre-mortem: если представить, что идея с треском провалилась, какова будет причина #1?',
    });
  }

  return findings;
}
