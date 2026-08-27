'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ClockMode, Locale } from './format';

/**
 * Language and clock preference.
 *
 * Both default from the signed-in user's stored preference rather than from the
 * browser: someone reading Amharic on an English-locale laptop is the normal
 * case here, not the exception.
 */

interface Preferences {
  locale: Locale;
  clock: ClockMode;
  setLocale: (locale: Locale) => void;
  setClock: (clock: ClockMode) => void;
  /** Pick the right string for the current language. */
  t: (en: string, am: string) => string;
}

const PreferenceContext = createContext<Preferences | null>(null);

export function PreferenceProvider({
  children,
  initialLocale = 'en-ET',
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [clock, setClock] = useState<ClockMode>('international');

  const t = useCallback((en: string, am: string) => (locale === 'am-ET' ? am : en), [locale]);

  const value = useMemo(
    () => ({ locale, clock, setLocale, setClock, t }),
    [locale, clock, t],
  );

  return (
    <PreferenceContext.Provider value={value}>
      <div lang={locale === 'am-ET' ? 'am' : 'en'}>{children}</div>
    </PreferenceContext.Provider>
  );
}

export function usePreferences(): Preferences {
  const context = useContext(PreferenceContext);
  if (!context) throw new Error('usePreferences must be used inside PreferenceProvider');
  return context;
}
