import { InspectorFinding, SupportedLang, unicodeWordRegex, detectTextLang } from '../types';
import nlp from 'compromise';

const RU_ACTION_VERBS = unicodeWordRegex('сделать|проверить|написать|запустить|созвониться|протестировать|согласовать|подготовить|внедрить|измерить|опубликовать|отправить|собрать|создать|добавить|исправить');

const EN_ACTION_VERBS = unicodeWordRegex('do|test|build|launch|implement|write|measure|verify|deploy|contact|create|check|fix|setup|prepare');

const CHECKBOX_OR_LIST_PATTERN = /(\[[\sXx]?\]|^\s*[-*•]\s+\S+)/m;

/**
 * Checks whether a thought or plan contains actionable next steps.
 */
export function inspectActionability(
  text: string,
  blocksCount = 0,
  lang: SupportedLang = detectTextLang(text)
): InspectorFinding[] {
  if (!text || text.length < 80) return [];

  const hasRuActions = RU_ACTION_VERBS.test(text);
  const hasEnActions = EN_ACTION_VERBS.test(text);

  let hasCompromiseAction = false;
  try {
    const doc = nlp(text);
    const verbs = doc.verbs().out('array');
    const terms = ['do', 'test', 'build', 'launch', 'implement', 'write', 'measure', 'verify', 'deploy', 'contact', 'create', 'check', 'fix', 'setup', 'prepare'];
    hasCompromiseAction = verbs.some((v: string) => terms.some((t) => v.toLowerCase().includes(t)));
  } catch {
    hasCompromiseAction = false;
  }

  const hasChecklist = CHECKBOX_OR_LIST_PATTERN.test(text);

  const findings: InspectorFinding[] = [];

  if (!hasRuActions && !hasEnActions && !hasCompromiseAction && !hasChecklist && blocksCount >= 2) {
    findings.push({
      rule: 'no-next-action',
      category: 'actionability',
      severity: 'hint',
      title: lang === 'en' ? 'No clear next action' : 'Нет явного первого шага',
      detail:
        lang === 'en'
          ? 'The capsule outlines theoretical thoughts, but lacks any concrete action verbs or checklist items. The idea risks staying abstract.'
          : 'В капсуле сформулированы рассуждения, но нет ни одного конкретного глагола действия (сделать, проверить, протестировать) или чек-листа. Мысль рискует остаться теорией.',
      suggestion:
        lang === 'en'
          ? 'Formulate 1 concrete physical action that can be executed within the next 24 hours.'
          : 'Сформулируйте 1 конкретное физическое действие, которое можно выполнить в ближайшие 24 часа.',
    });
  }

  return findings;
}
