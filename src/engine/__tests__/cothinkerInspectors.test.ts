import { describe, it, expect } from 'vitest';
import {
  inspectVagueWords,
  inspectActionability,
  inspectBalance,
  inspectReadability,
  inspectDataAnomalies,
  matchPromptFocus,
} from '../cothinker';
import { generateOfflineAiResponse } from '../offlineAi';

describe('inspectVagueWords (Детектор размытых формулировок)', () => {
  it('flags vague words in Russian text', () => {
    const text = 'В будущем мы планируем значительно улучшить все показатели платформы.';
    const findings = inspectVagueWords(text, 2, 'ru');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('clarity');
    expect(findings[0].rule).toBe('vague-phrasing');
  });

  it('flags vague words in English text', () => {
    const text = 'We will significantly optimize and improve the system soon.';
    const findings = inspectVagueWords(text, 2, 'en');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('clarity');
    expect(findings[0].title).toContain('Vague phrasing');
  });

  it('stays quiet on concrete, measurable sentences', () => {
    const text = 'Конверсия составила 4.2% за март при 1200 визитах.';
    const findings = inspectVagueWords(text, 2, 'ru');
    expect(findings).toEqual([]);
  });
});

describe('inspectActionability (Проверка наличия первого шага)', () => {
  it('flags thought without next actions if text is long and lacks verbs/checklists', () => {
    const text =
      'Архитектура распределенных систем строится вокруг консистентности и доступности. ' +
      'Многие разработчики рассуждают о CAP-теореме, однако на практике компромиссы неизбежны. ' +
      'Сетевые разделы случаются чаще, чем ожидают проектировщики.';
    const findings = inspectActionability(text, 3, 'ru');
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe('no-next-action');
    expect(findings[0].suggestion).toContain('Сформулируйте 1 конкретное физическое действие');
  });

  it('approves text with Russian action verbs', () => {
    const text =
      'Архитектура распределенных систем требует проверки. ' +
      'Нужно протестировать репликацию на стенде и проверить задержки сети.';
    const findings = inspectActionability(text, 2, 'ru');
    expect(findings).toEqual([]);
  });

  it('approves English text with action verbs parsed via compromise', () => {
    const text =
      'Distributed systems require validation. ' +
      'We must deploy the cluster to staging and test network partitions.';
    const findings = inspectActionability(text, 2, 'en');
    expect(findings).toEqual([]);
  });

  it('approves text with markdown checkboxes', () => {
    const text =
      'План миграции:\n- [ ] Подготовить резервную копию базы данных.\n- [ ] Запустить скрипт обновления.';
    const findings = inspectActionability(text, 2, 'ru');
    expect(findings).toEqual([]);
  });
});

describe('inspectBalance (Однобокий оптимизм и абсолютные формулировки)', () => {
  it('flags absolute assertions like "гарантированно" or "всегда"', () => {
    const text = 'Этот подход гарантированно принесет результат в любых условиях.';
    const findings = inspectBalance(text, 'ru');
    expect(findings.some((f) => f.rule === 'absolute-claim')).toBe(true);
  });

  it('flags over-optimism when benefits are touted without a single risk or friction word', () => {
    const text =
      'Проект ждет грандиозный успех и взрывной рост выручки. ' +
      'Наша победа на рынке неизбежна, прибыль утроится в следующем квартале, клиенты в восторге от выгоды.';
    const findings = inspectBalance(text, 'ru');
    expect(findings.some((f) => f.rule === 'over-optimism')).toBe(true);
    const optimism = findings.find((f) => f.rule === 'over-optimism')!;
    expect(optimism.title).toContain('розовые очки');
  });

  it('stays quiet when text mentions friction, risks, or buffer', () => {
    const text =
      'Ожидается рост выручки, но есть риск задержки поставок. Заложен буфер на непредвиденные расходы.';
    const findings = inspectBalance(text, 'ru');
    expect(findings.filter((f) => f.rule === 'over-optimism')).toEqual([]);
  });
});

describe('inspectReadability (Перегруженные предложения)', () => {
  it('detects sentences with more than 35 words', () => {
    const longSentence =
      'Когда мы рассматриваем развитие сложных систем управления знаниями в условиях непрерывного изменения технологий ' +
      'и растущих требований пользователей к скорости и качеству взаимодействия с персональными данными в локальном хранилище, ' +
      'становится очевидным, что классические реляционные базы данных уступают простым плоским файлам.';
    const findings = inspectReadability(longSentence, 1, 'ru');
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe('overloaded-sentence');
    expect(findings[0].detail).toContain('Длинные предложения затрудняют восприятие');
  });

  it('reports overloaded sentences in English when lang is en', () => {
    const longSentence =
      'When we thoroughly examine the long-term architectural evolution of complex personal knowledge management systems under continuous technological change ' +
      'and rapidly evolving user expectations regarding local data ownership and privacy in modern desktop operating systems, it becomes obvious that flat plain text files are superior.';
    const findings = inspectReadability(longSentence, 1, 'en');
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Overloaded sentence');
  });
});

describe('inspectDataAnomalies with simple-statistics (Поиск аномалий)', () => {
  it('detects sharp spikes using robust IQR thresholds', () => {
    const values = [10, 11, 12, 10, 11, 120, 11, 10, 12];
    const anomalies = inspectDataAnomalies('CAC', values, 'ru');
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].type).toBe('spike');
    expect(anomalies[0].rowIndex).toBe(6);
    expect(anomalies[0].value).toBe(120);
    expect(anomalies[0].message).toContain('резкий скачок');
  });

  it('detects stagnation / plateau at the tail in English', () => {
    const values = [10, 20, 35, 50, 70, 70.1, 70.2, 70.1];
    const anomalies = inspectDataAnomalies('Users', values, 'en');
    expect(anomalies.some((a) => a.type === 'plateau')).toBe(true);
    expect(anomalies[0].message).toContain('plateau');
  });
});

describe('matchPromptFocus (Связка с кастомным запросом пользователя)', () => {
  it('flags missing financial topic when user asks about budget but capsule has zero money words', () => {
    const text = 'Мы планируем обновить дизайн интерфейса и перерисовать иконки.';
    const res = matchPromptFocus('Что у нас по деньгам и бюджету?', text, 'ru');
    expect(res.hasCustomPrompt).toBe(true);
    expect(res.topic).toBe('finance');
    expect(res.missingTopicNotice).toContain('запрос касается финансов и бюджета');
    expect(res.matchedQuotes).toEqual([]);
  });

  it('matches relevant sentences when user asks about finance and capsule has budget words', () => {
    const text = 'Бюджет редизайна составит 50000 рублей. Иконки нарисуем сами.';
    const res = matchPromptFocus('Что по бюджету?', text, 'ru');
    expect(res.hasCustomPrompt).toBe(true);
    expect(res.topic).toBe('finance');
    expect(res.missingTopicNotice).toBeUndefined();
    expect(res.matchedQuotes[0]).toContain('50000 рублей');
  });

  it('finds custom topic quotes in English', () => {
    const text = 'User retention analysis in the enterprise cohort reached 85% after six months.';
    const res = matchPromptFocus('Check retention scenario', text, 'en');
    expect(res.hasCustomPrompt).toBe(true);
    expect(res.matchedQuotes[0]).toContain('retention analysis');
  });
});

describe('Co-Thinker Integration with Thought Linters and Bilingual output', () => {
  it('critique mode reports thought linter findings and custom query notices in Russian', () => {
    const capsule = {
      subject: 'Суперплан развития',
      blocks: [
        {
          type: 'paragraph',
          data: {
            text: 'В будущем мы планируем значительно улучшить продукт. Проект ждет грандиозный успех и рост прибыли.',
          },
        },
      ],
    };

    const res = generateOfflineAiResponse('critique', capsule, 'Что по деньгам?');
    expect(res.criticism).toContain('По вашему вопросу: «Что по деньгам?»');
    expect(res.criticism).toContain('Линтер мысли и формулировок:');
    expect(res.criticism).toContain('Размытая формулировка');
  });

  it('critique mode responds in English when capsule is in English', () => {
    const capsule = {
      subject: 'Quarterly Growth Strategy',
      blocks: [
        {
          type: 'paragraph',
          data: {
            text: 'We plan to significantly optimize the pipeline soon. The initiative will guarantee market leadership and profit.',
          },
        },
      ],
    };

    const res = generateOfflineAiResponse('critique', capsule, 'What about budget?');
    expect(res.criticism).toContain('Analysis of "Quarterly Growth Strategy"');
    expect(res.criticism).toContain('Regarding your query: "What about budget?"');
    expect(res.criticism).toContain('Thought & Phrasing Linter:');
  });

  it('continue mode includes next action advice when capsule lacks physical steps', () => {
    const capsule = {
      subject: 'Теоретические размышления',
      blocks: [
        { type: 'paragraph', data: { text: 'Тут длинные теоретические рассуждения без единого шага действия...' } },
        { type: 'paragraph', data: { text: 'Продолжение абстрактных мыслей об устройстве мироздания и бытия...' } },
      ],
    };

    const res = generateOfflineAiResponse('continue', capsule);
    expect(res.text).toContain('Ближайший шаг');
  });

  it('data_insight mode reports data anomalies detected by simple-statistics', () => {
    const csvWithSpike = `Month,Metric\nJan,10\nFeb,12\nMar,11\nApr,150\nMay,11\nJun,10`;
    const capsule = {
      subject: 'Замеры',
      attachments: [{ name: 'metrics.csv', mimeType: 'text/csv', content: csvWithSpike }],
    };

    const res = generateOfflineAiResponse('data_insight', capsule);
    expect(res.text).toContain('Аномалии и особенности выборки:');
    expect(res.text).toContain('резкий скачок');
  });
});
