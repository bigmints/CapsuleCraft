/**
 * Okapi BM25 relevance ranking — pure engine module, no DOM / Tauri deps.
 *
 * The vault's inverted index answers "WHICH capsules contain the token";
 * BM25 answers "WHICH of them is the most RELEVANT". Classic parameters:
 * k1 = 1.5 (term-frequency saturation), b = 0.75 (document length
 * normalization), Lucene-style IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
 * — always non-negative, never punishes a term for being common.
 */

export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

/**
 * Same tokenizer as the vault inverted index: Latin + Cyrillic + digits
 * (dash/underscore kept inside tokens), ≥ 2 chars, lowercased.
 */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-zа-я0-9_-]{2,}/g) || [];
}

export interface Bm25Hit {
  id: string;
  score: number;
}

export interface Bm25Stats {
  documents: number;
  terms: number;
  avgDocLength: number;
}

export interface RankOptions {
  /** Weight for terms that merely START with the query token (prefix match). Default 0.5. */
  prefixWeight?: number;
  /** Cap on distinct prefix terms per query token (guards against pathological scans). Default 64. */
  maxPrefixTerms?: number;
}

export class Bm25Index {
  /** term -> docId -> in-document term frequency (postings + tf in one map). */
  private postings = new Map<string, Map<string, number>>();
  /** docId -> term -> tf (reverse view, makes remove() O(terms of one doc)). */
  private docTf = new Map<string, Map<string, number>>();
  /** docId -> number of indexed tokens (document length). */
  private docLengths = new Map<string, number>();
  private totalLength = 0;

  public get docCount(): number {
    return this.docLengths.size;
  }

  public get termCount(): number {
    return this.postings.size;
  }

  public get avgDocLength(): number {
    return this.docLengths.size ? this.totalLength / this.docLengths.size : 0;
  }

  public stats(): Bm25Stats {
    return {
      documents: this.docCount,
      terms: this.termCount,
      avgDocLength: Number(this.avgDocLength.toFixed(2)),
    };
  }

  /** Document frequency: in how many docs the term occurs (0 if unknown). */
  public df(term: string): number {
    return this.postings.get(term)?.size || 0;
  }

  /** Lucene-style IDF — always ≥ 0. */
  public idf(term: string): number {
    const df = this.df(term);
    const n = this.docCount;
    if (!df || !n) return 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** (Re)index one document. Passing the SAME id twice replaces the doc. */
  public add(id: string, tokens: string[]): void {
    this.remove(id);

    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);

    this.docTf.set(id, counts);
    this.docLengths.set(id, tokens.length);
    this.totalLength += tokens.length;

    for (const [term, f] of counts) {
      let docs = this.postings.get(term);
      if (!docs) {
        docs = new Map();
        this.postings.set(term, docs);
      }
      docs.set(id, f);
    }
  }

  /** Remove a document (idempotent). */
  public remove(id: string): void {
    const counts = this.docTf.get(id);
    if (!counts) return;

    this.totalLength -= this.docLengths.get(id) || 0;
    this.docLengths.delete(id);
    this.docTf.delete(id);

    for (const term of counts.keys()) {
      const docs = this.postings.get(term);
      if (!docs) continue;
      docs.delete(id);
      if (docs.size === 0) this.postings.delete(term);
    }
  }

  public clear(): void {
    this.postings.clear();
    this.docTf.clear();
    this.docLengths.clear();
    this.totalLength = 0;
  }

  /** Saturation part of BM25 for one (term, doc) pair. 0 when the doc lacks the term. */
  private saturation(term: string, id: string): number {
    const f = this.docTf.get(id)?.get(term) || 0;
    if (!f) return 0;
    const dl = this.docLengths.get(id) || 0;
    const avgdl = this.avgDocLength;
    const norm = 1 - BM25_B + BM25_B * (avgdl ? dl / avgdl : 0);
    return (f * (BM25_K1 + 1)) / (f + BM25_K1 * norm);
  }

  /**
   * All hits for ONE query token: exact terms first, then prefix matches
   * (terms starting with the token) at a reduced weight. Hits are the raw
   * per-term BM25 scores — the caller aggregates across tokens.
   */
  public termHits(token: string, opts?: RankOptions): Bm25Hit[] {
    const prefixWeight = opts?.prefixWeight ?? 0.5;
    const maxPrefixTerms = opts?.maxPrefixTerms ?? 64;
    if (!token) return [];

    const scores = new Map<string, number>();
    const bump = (id: string, v: number) => scores.set(id, (scores.get(id) || 0) + v);

    const exact = this.postings.get(token);
    if (exact) {
      for (const id of exact.keys()) bump(id, this.idf(token) * this.saturation(token, id));
    }

    // Prefix (autocomplete-style) matching for terms that start with the token.
    if (prefixWeight > 0) {
      let used = 0;
      for (const [term, docs] of this.postings) {
        if (term === token || !term.startsWith(token)) continue;
        if (used >= maxPrefixTerms) break;
        used += 1;
        const w = this.idf(term) * prefixWeight;
        for (const id of docs.keys()) bump(id, w * this.saturation(term, id));
      }
    }

    return Array.from(scores, ([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  }

  /** Rank the whole corpus against a free-text query, best first. */
  public rank(query: string, opts?: RankOptions): Bm25Hit[] {
    const tokens = tokenize(query);
    if (!tokens.length || this.docCount === 0) return [];

    const scores = new Map<string, number>();
    for (const token of tokens) {
      for (const hit of this.termHits(token, opts)) {
        scores.set(hit.id, (scores.get(hit.id) || 0) + hit.score);
      }
    }

    return Array.from(scores, ([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  }
}
