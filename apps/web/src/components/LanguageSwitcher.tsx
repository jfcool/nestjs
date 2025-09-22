'use client';

import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation, locales, localeNames, type Locale, defaultLocale } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, changeLanguage } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use default locale during SSR to prevent hydration mismatch
  const displayLocale = isHydrated ? locale : defaultLocale;

  return (
    <div className="flex gap-2">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => changeLanguage(loc)}
          className={`px-3 py-1 rounded text-xs transition-colors ${
            displayLocale === loc 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-700 text-blue-300 hover:bg-gray-600 hover:text-blue-200'
          }`}
        >
          {localeNames[loc]}
        </button>
      ))}
    </div>
  );
}
