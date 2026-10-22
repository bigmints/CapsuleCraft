import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  textContentOf,
  findClaims,
  detectRisks,
  parseCsv,
  analyzeCsv,
  correlation,
  describeCsvReport,
  relatedFromVault,
  generateOfflineAiResponse,
  offlineAiResponse,
} from '../offlineAi';
import { Bm25Index } from '../bm25';

const DEMO_CSV = `Month,CAC,LTV,Margin,ARR_K
Jan,120,450,0.42,85
Feb,115,480,0.45,110
Mar,110,510,0.48,145
Apr,105,530,0.50,190
May,98,560,0.52,240
Jun,92,590,0.55,310`;

describe('extractKeywords', () => {
  it('drops stopwords, counts TF, sorts by frequency', () => {
    const kw = extractKeywords('анализ рынка анализ юнит-экономика рынок', 5);
    expect(kw[0]).toBe('анализ');
    expect(kw).toContain('рынка');
    expect(kw).toContain('юнит-экономика');
  });

  it('filters stopwords in EN and RU', () => {
    const kw = extractKeywords('the analysis of the market and the vault', 10);
    expect(kw).toEqual(['analysis', 'market', 'vault']);
  });
});

describe('textContentOf / findClaims', () => {
  it('collects text from subject, paragraphs, callouts and criticism', () => {
    const text = textContentOf({
      subject: 'Тема',
      tags: ['#a'],
      blocks: [
        { type: 'paragraph', data: { text: 'Абзац про рынок' } },
        { type: 'callout', data: { title: 'Вывод', content: 'рынок растёт' } },
        { type: 'ai_opponent_block', data: { criticism: 'критика рынка' } },
        { type: 'data_grid_view', data: { view: 'chart' } },
      ],
    });
    expect(text).toContain('Тема');
    expect(text).toContain('Абзац про рынок');
    expect(text).toContain('рынок растёт');
    expect(text).toContain('критика рынка');
  });

  it('finds sentences with numbers, prefers percentages/ratios', () => {
    const claims = findClaims(
      'Здесь нет ничего числового вообще. LTV/CAC достиг 4.1x в феврале. Мы верим в лучшее.',
    );
    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0]).toContain('4.1x');
  });

  it('returns [] for text without numeric claims', () => {
    expect(findClaims('Никаких цифр в этом тексте нет вовсе.')).toEqual([]);
  });
});

describe('detectRisks', () => {
  it('flags absolute claims and missing downside', () => {
    const risks = detectRisks('Этот подход всегда сработает и гарантированно принесёт рост.');
    const rules = risks.map((r) => r.rule);
    expect(rules).toContain('absolute-claim');
    expect(rules).toContain('no-downside');
  });

  it('flags thin extrapolation on few data points', () => {
    const risks = detectRisks('Выручка вырастет в следующем квартале', 3);
    expect(risks.map((r) => r.rule)).toContain('thin-extrapolation');
  });

  it('stays quiet on a well-hedged text', () => {
    const risks = detectRisks(
      'Возможен риск оттока, заложен буфер на удержание и резерв по срокам на случай просадки.',
      10,
    );
    expect(risks).toEqual([]);
  });
});

describe('CSV math (real numbers, not invented)', () => {
  it('parses CSV with quoted cells', () => {
    const p = parseCsv('Name,Note\n"A,B","x""y"\nC,D');
    expect(p?.headers).toEqual(['Name', 'Note']);
    expect(p?.rows).toEqual([['A,B', 'x"y'], ['C', 'D']]);
  });

  it('analyzes a tiny dataset exactly', () => {
    const r = analyzeCsv('Month,Value\nJan,100\nFeb,110\nMar,120', 'tiny.csv')!;
    expect(r.rowCount).toBe(3);
    const c = r.columns[0];
    expect(c.name).toBe('Value');
    expect(c.n).toBe(3);
    expect(c.min).toBe(100);
    expect(c.max).toBe(120);
    expect(c.mean).toBeCloseTo(110, 5);
    expect(c.first).toBe(100);
    expect(c.last).toBe(120);
    expect(c.deltaPct).toBeCloseTo(20, 5);
    expect(c.trend).toBe('up');
  });

  it('analyzes the demo dataset: CAC falls, LTV grows, strong negative correlation', () => {
    const r = analyzeCsv(DEMO_CSV, 'dataset_q4.csv')!;
    const cac = r.columns.find((c) => c.name === 'CAC')!;
    const ltv = r.columns.find((c) => c.name === 'LTV')!;
    expect(cac.mean).toBeCloseTo(106.67, 1);
    expect(cac.trend).toBe('down');
    expect(cac.deltaPct).toBeCloseTo(-23.33, 1);
    expect(ltv.trend).toBe('up');
    expect(ltv.deltaPct).toBeCloseTo(31.11, 1);
    expect(r.correlation!).toBeLessThan(-0.95);
    expect(r.correlationPair).toEqual(['CAC', 'LTV']);
  });

  it('ignores non-numeric columns and returns null for garbage', () => {
    const r = analyzeCsv('Month,Name\nJan,Alex\nFeb,Bob');
    expect(r).toBeNull();
    expect(analyzeCsv('')).toBeNull();
  });

  it('correlation: perfect line → 1, constant → 0', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
    expect(correlation([5, 5, 5], [1, 2, 3])).toBe(0);
  });

  it('describeCsvReport quotes real computed numbers', () => {
    const r = analyzeCsv(DEMO_CSV, 'dataset_q4.csv')!;
    const s = describeCsvReport(r);
    expect(s).toMatch(/106[.,]67/); // CAC mean
    expect(s).toContain('n=6');
    expect(s).toMatch(/−23[.,]33%/); // CAC drop
    expect(s).toMatch(/Корреляция CAC ↔ LTV/);
  });
});

describe('relatedFromVault', () => {
  const capsule = {
    messageId: 'a',
    subject: 'Анализ рынка и юнит-экономики',
    blocks: [{ type: 'paragraph', data: { text: 'анализ рынка юнит-экономика LTV CAC' } }],
  };

  it('finds overlapping capsules with a similarity > 0', () => {
    const rel = relatedFromVault(capsule, {
      vaultNodes: [
        { messageId: 'b', subject: 'Юнит-экономика рынка', blocks: capsule.blocks },
        { messageId: 'c', subject: 'Готика и барокко', blocks: [{ type: 'paragraph', data: { text: 'собор шпиль витраж' } }] },
      ],
    });
    expect(rel.map((r) => r.messageId)).toEqual(['b']);
    expect(rel[0].similarity).toBeGreaterThan(0.1);
  });

  it('excludes self and empty context', () => {
    expect(relatedFromVault(capsule, { vaultNodes: [capsule] })).toEqual([]);
    expect(relatedFromVault(capsule, { vaultNodes: [] })).toEqual([]);
    expect(relatedFromVault(capsule)).toEqual([]);
  });
});

// ── the engine itself: content-aware, honest, deterministic ──────────────────

const financeCapsule = {
  messageId: '<fin@vault.local>',
  subject: 'Анализ рынка и оптимизация юнит-экономики',
  tags: ['#finance'],
  blocks: [
    { type: 'heading', data: { level: 1, text: 'Анализ рынка и оптимизация юнит-экономики' } },
    {
      type: 'paragraph',
      data: { text: 'Текущая модель показывает рост LTV/CAC при масштабировании. Выручка вырастет на 60% за счёт каналов дистрибуции.' },
    },
  ],
  attachments: [{ name: 'dataset_q4.csv', mimeType: 'text/csv', content: DEMO_CSV }],
};

const cookingCapsule = {
  messageId: '<cook@vault.local>',
  subject: 'Рецепт борща',
  tags: ['#cooking'],
  blocks: [
    { type: 'paragraph', data: { text: 'Свёклу тушить 40 минут, бульон всегда должен томиться на слабом огне.' } },
  ],
  attachments: [],
};

describe('generateOfflineAiResponse — anti-canned guarantees', () => {
  it('critique quotes the REAL subject and keywords, never the old canned text', () => {
    const r = generateOfflineAiResponse('critique', financeCapsule);
    expect(r.criticism).toContain('Анализ рынка и оптимизация юнит-экономики');
    expect(r.criticism).toMatch(/юнит-экономик|ltv|cac|масштабир/i);
    expect(r.criticism).not.toContain('Маржинальность переоценена на 14%');
  });

  it('two different capsules → two different analyses', () => {
    const a = generateOfflineAiResponse('critique', financeCapsule).criticism;
    const b = generateOfflineAiResponse('critique', cookingCapsule).criticism;
    expect(a).not.toBe(b);
    expect(b).toContain('Рецепт борща');
    expect(b).toMatch(/свёкл|бульон|томиться/i);
  });

  it('same input → same output (deterministic)', () => {
    const a = generateOfflineAiResponse('critique', financeCapsule).criticism;
    const b = generateOfflineAiResponse('critique', financeCapsule).criticism;
    expect(a).toBe(b);
  });

  it('personas change the framing but not the content source', () => {
    const a = generateOfflineAiResponse('critique', financeCapsule, undefined, 'Co-Thinker A').criticism!;
    const b = generateOfflineAiResponse('critique', financeCapsule, undefined, 'Co-Thinker B').criticism!;
    expect(a).not.toBe(b);
    expect(a).toContain('Анализ рынка');
    expect(b).toContain('Анализ рынка');
  });
});

describe('generateOfflineAiResponse — data_insight honesty', () => {
  it('computes REAL stats from the attached CSV', () => {
    const r = generateOfflineAiResponse('data_insight', financeCapsule);
    expect(r.text).toContain('dataset_q4.csv');
    expect(r.text).toMatch(/106[.,]67/); // real CAC mean
    expect(r.text).toContain('n=6');
    expect(r.text).not.toContain('117.50'); // the old invented number
  });

  it('without CSV it refuses to invent numbers', () => {
    const r = generateOfflineAiResponse('data_insight', cookingCapsule);
    expect(r.text).toMatch(/числа я не выдумываю|не буду это имитировать/i);
    expect(r.text).not.toMatch(/\$\d+/);
  });
});

describe('generateOfflineAiResponse — continue / reply_thread', () => {
  it('continue proposes steps from real keywords + real data trend', () => {
    const r = generateOfflineAiResponse('continue', financeCapsule);
    expect(r.text).toMatch(/юнит-экономик|ltv|масштабир/i);
    expect(r.text).toContain('CAC'); // from the CSV trend line
    expect(r.text).toMatch(/рост|падает|стоит на месте/);
  });

  it('continue suggests a REAL related capsule from the vault', () => {
    const r = generateOfflineAiResponse('continue', financeCapsule, undefined, 'Co-Thinker', {
      vaultNodes: [
        financeCapsule,
        {
          messageId: '<rel@vault.local>',
          subject: 'Юнит-экономика и LTV для рынка',
          blocks: [{ type: 'paragraph', data: { text: 'юнит-экономика ltv cac рынка масштабирование' } }],
        },
      ],
    });
    expect(r.text).toContain('Юнит-экономика и LTV для рынка');
  });

  it('reply_thread builds a child capsule quoting a real claim', () => {
    const r = generateOfflineAiResponse('reply_thread', financeCapsule);
    expect(r.subject).toBe('Re: Анализ рынка и оптимизация юнит-экономики');
    expect(r.inReplyTo).toBe('<fin@vault.local>');
    expect(r.blocks![0].data.text).toContain('Анализ рынка');
    const criticism = r.blocks!.find((b: any) => b.type === 'ai_opponent_block');
    expect(criticism.data.criticism).toMatch(/60%|вырастет|LTV/i); // quotes the real claim
  });
});

describe('offlineAiResponse contract', () => {
  it('keeps the { success, mode, reply, text, result } shape', () => {
    const r = offlineAiResponse('critique', financeCapsule);
    expect(r.success).toBe(true);
    expect(r.mode).toBe('offline');
    expect(r.reply).toBeTruthy();
    expect(r.text).toBeTruthy();
    expect(r.result.author).toBe('Co-Thinker');
    expect(r.result.suggestedBlock.type).toBe('ai_opponent_block');
  });
});

describe('Bm25Index.similarity (tf-idf cosine)', () => {
  it('related docs score higher than unrelated, stays within 0..1', () => {
    const idx = new Bm25Index();
    idx.add('a', ['apple', 'banana', 'apple']);
    idx.add('b', ['apple', 'banana']);
    idx.add('c', ['zebra', 'run']);
    const ab = idx.similarity('a', 'b');
    const ac = idx.similarity('a', 'c');
    expect(ab).toBeGreaterThan(0.9);
    expect(ac).toBe(0);
    expect(ab).toBeLessThanOrEqual(1);
    expect(idx.similarity('a', 'missing')).toBe(0);
  });
});
