import { describe, it, expect } from 'vitest';
import { Bm25Index, tokenize, BM25_K1, BM25_B } from '../bm25';

describe('tokenize', () => {
  it('lowercases and keeps Cyrillic, Latin, digits, dash/underscore', () => {
    expect(tokenize('Юнит-Экономика Unit_test 42')).toEqual([
      'юнит-экономика',
      'unit_test',
      '42',
    ]);
  });

  it('drops 1-char tokens and punctuation', () => {
    expect(tokenize('a, я — и the! ok')).toEqual(['the', 'ok']);
  });

  it('returns [] for empty / symbol-only input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('!!! ??? ...')).toEqual([]);
  });
});

describe('Bm25Index — corpus bookkeeping', () => {
  it('tracks doc count, term count, avg length', () => {
    const idx = new Bm25Index();
    idx.add('a', tokenize('apple banana apple'));
    idx.add('b', tokenize('banana'));
    expect(idx.docCount).toBe(2);
    expect(idx.termCount).toBe(2);
    expect(idx.avgDocLength).toBe(2);
    expect(idx.df('apple')).toBe(1);
    expect(idx.df('banana')).toBe(2);
    expect(idx.idf('apple')).toBeGreaterThan(idx.idf('banana'));
  });

  it('remove() is symmetric to add()', () => {
    const idx = new Bm25Index();
    idx.add('a', tokenize('apple banana'));
    idx.add('b', tokenize('banana'));
    idx.remove('a');
    expect(idx.docCount).toBe(1);
    expect(idx.df('apple')).toBe(0);
    expect(idx.df('banana')).toBe(1);
    expect(idx.remove('missing')).toBeUndefined(); // idempotent
    idx.remove('b');
    expect(idx.docCount).toBe(0);
    expect(idx.rank('banana')).toEqual([]);
  });

  it('re-adding the same id replaces the document', () => {
    const idx = new Bm25Index();
    idx.add('a', tokenize('apple'));
    idx.add('a', tokenize('banana cherry'));
    expect(idx.docCount).toBe(1);
    expect(idx.df('apple')).toBe(0);
    expect(idx.df('banana')).toBe(1);
    expect(idx.avgDocLength).toBe(2);
  });
});

describe('Bm25Index — ranking semantics', () => {
  it('rare terms outweigh common terms (IDF)', () => {
    const idx = new Bm25Index();
    idx.add('stopwords', tokenize('the the and and but or the'));
    idx.add('doc1', tokenize('quantum the'));
    idx.add('doc2', tokenize('the the'));
    const hits = idx.rank('quantum the');
    // doc1 contains the rare term → top hit
    expect(hits[0].id).toBe('doc1');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('higher tf ranks higher, but saturates (k1)', () => {
    const idx = new Bm25Index();
    idx.add('one', tokenize('rust'));
    idx.add('three', tokenize('rust rust rust'));
    const [top, second] = idx.rank('rust');
    expect(top.id).toBe('three');
    // Saturation: 3x tf must NOT triple the score.
    expect(top.score).toBeLessThan(second.score * 3);
    // Sanity of constants used in the formula.
    expect(BM25_K1).toBeGreaterThan(0);
    expect(BM25_B).toBeGreaterThan(0);
    expect(BM25_B).toBeLessThan(1);
  });

  it('length normalization favors concise docs at equal tf', () => {
    const idx = new Bm25Index();
    const filler = 'filler word padding text here and there everywhere around the block';
    idx.add('short', tokenize('rust'));
    idx.add('long', tokenize(`rust ${filler}`));
    const hits = idx.rank('rust');
    expect(hits[0].id).toBe('short');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('multi-token query: docs with BOTH tokens outrank one-token docs', () => {
    const idx = new Bm25Index();
    idx.add('both', tokenize('unit economics analysis'));
    idx.add('onlyUnit', tokenize('unit planning'));
    idx.add('onlyEcon', tokenize('macro economics'));
    const ids = idx.rank('unit economics').map((h) => h.id);
    expect(ids[0]).toBe('both');
    expect(ids).toContain('onlyUnit');
    expect(ids).toContain('onlyEcon');
  });

  it('prefix matching finds terms starting with the query token at reduced weight', () => {
    const idx = new Bm25Index();
    idx.add('a', tokenize('юнит-экономика'));
    const hits = idx.rank('юнит');
    expect(hits.map((h) => h.id)).toContain('a');
    // An exact term still beats a prefix-only match on the same doc.
    idx.add('b', tokenize('юнит юнит юнит'));
    const [top] = idx.rank('юнит');
    expect(top.id).toBe('b');
  });

  it('returns [] on empty query / empty corpus and never NaN', () => {
    const idx = new Bm25Index();
    expect(idx.rank('anything')).toEqual([]);
    idx.add('a', tokenize('apple'));
    expect(idx.rank('')).toEqual([]);
    expect(idx.rank('   !!!  ')).toEqual([]);
    for (const h of idx.rank('apple zebra')) {
      expect(Number.isFinite(h.score)).toBe(true);
    }
  });

  it('termHits returns only docs containing the term (or its prefixes)', () => {
    const idx = new Bm25Index();
    idx.add('hit', tokenize('database'));
    idx.add('miss', tokenize('network'));
    const hitIds = idx.termHits('database').map((h) => h.id);
    expect(hitIds).toEqual(['hit']);
    // Prefix of a known term also hits via prefix matching
    expect(idx.termHits('data').map((h) => h.id)).toEqual(['hit']);
    expect(idx.termHits('').map((h) => h.id)).toEqual([]);
  });
});
