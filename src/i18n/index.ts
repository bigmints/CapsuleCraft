/**
 * Tiny dependency-free i18n layer.
 *
 * Russian stays the source dictionary (the owner's language); English must
 * cover every key — that is enforced at compile time (`Dictionary` type) and
 * at runtime by a key-parity test.
 *
 * Components subscribe through `useI18n()` (useSyncExternalStore), so a locale
 * switch re-renders without remounting the tree.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { ru } from './locales/ru';
import { en } from './locales/en';

export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export type TranslationKey = keyof typeof ru;
export type Dictionary = Record<TranslationKey, string>;

const DICTIONARIES: Record<Locale, Dictionary> = { ru, en };
const STORAGE_KEY = 'capsuleos_locale_v1';

export const LOCALE_LABELS: Record<Locale, string> = { ru: 'RU', en: 'EN' };

function detectLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'ru' || saved === 'en') return saved;
    } catch {
      /* private mode — fall through to navigator */
    }
    const language = window.navigator.language?.toLowerCase() || '';
    if (language && !language.startsWith('ru')) return 'en';
  }
  return 'ru';
}

let currentLocale: Locale = detectLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore quota/private-mode errors */
    }
    document.documentElement.lang = locale;
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replace `{name}` placeholders. Unknown vars are left untouched. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const dictionary = DICTIONARIES[locale] || DICTIONARIES.ru;
  const template = dictionary[key] ?? DICTIONARIES.ru[key] ?? key;
  return interpolate(template, vars);
}

/** Bound translator for non-React callers. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  return translate(currentLocale, key, vars);
}

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export function useI18n(): I18n {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  const boundT = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
  return { locale, setLocale, t: boundT };
}

/** All keys of a dictionary — used by tests and tooling. */
export function dictionaryKeys(locale: Locale): TranslationKey[] {
  return Object.keys(DICTIONARIES[locale]) as TranslationKey[];
}
