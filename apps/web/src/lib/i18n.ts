'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Locale = 'en' | 'de';

export const locales: Locale[] = ['en', 'de'];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
};

interface TranslationContextType {
  locale: Locale;
  translations: Record<string, string>;
  changeLanguage: (newLocale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated and load saved locale from localStorage
    setIsHydrated(true);
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale)) {
      setLocale(savedLocale);
    }
  }, []);

  useEffect(() => {
    // Load translations for current locale
    const loadTranslations = async () => {
      try {
        const module = await import(`../locales/${locale}.json`);
        console.log(`Loaded translations for ${locale}:`, Object.keys(module.default).length, 'keys');
        setTranslations(module.default);
      } catch (error) {
        console.error(`Failed to load translations for ${locale}:`, error);
        // Fallback to empty object
        setTranslations({});
      }
    };
    
    loadTranslations();
  }, [locale]);

  const changeLanguage = (newLocale: Locale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    // Handle nested keys like 'auth.logout'
    const keys = key.split('.');
    let translation: any = translations;
    
    for (const k of keys) {
      if (translation && typeof translation === 'object' && k in translation) {
        translation = translation[k];
      } else {
        // If key not found, return the key itself for debugging
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    let result = typeof translation === 'string' ? translation : key;
    
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        result = result.replace(`{{${param}}}`, String(value));
      });
    }
    
    return result;
  };

  const contextValue = {
    locale,
    translations,
    changeLanguage,
    t
  };

  return React.createElement(
    TranslationContext.Provider,
    { value: contextValue },
    children
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

// Server-side translation function
export async function getTranslations(locale: Locale): Promise<Record<string, string>> {
  try {
    const translations = await import(`../locales/${locale}.json`);
    return translations.default;
  } catch {
    return {};
  }
}
