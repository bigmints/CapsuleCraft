import React from 'react';
import { Languages } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, useI18n } from '../i18n';

/** Compact RU/EN switch; the choice is persisted in localStorage. */
export const LocaleToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className="flex items-center gap-0.5 bg-slate-900/80 rounded-md border border-slate-700 p-0.5"
      title={t('nav.language')}
      role="group"
      aria-label={t('nav.language')}
    >
      {!compact && <Languages className="w-3 h-3 text-slate-500 ml-1" />}
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          aria-pressed={locale === value}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
            locale === value
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-500 hover:text-slate-200 border border-transparent'
          }`}
        >
          {LOCALE_LABELS[value]}
        </button>
      ))}
    </div>
  );
};
