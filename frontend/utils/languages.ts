export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

export const languages: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    rtl: false,
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    rtl: true,
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    rtl: false,
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    rtl: false,
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    rtl: false,
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    rtl: false,
  },
  {
    code: 'el',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    flag: '🇬🇷',
    rtl: false,
  },
  {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    rtl: false,
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    rtl: false,
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    rtl: false,
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    rtl: false,
  },
  {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    rtl: false,
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    rtl: false,
  },
];

export const getLanguageByCode = (code: string): Language | undefined => {
  return languages.find(lang => lang.code === code);
};

export const isRTL = (languageCode: string): boolean => {
  const language = getLanguageByCode(languageCode);
  return language?.rtl || false;
};

// Helper function to get languages grouped by region for better UX
export const getLanguagesByRegion = () => {
  return {
    'Western Languages': languages.filter(lang => 
      ['en', 'de', 'fr', 'es', 'it'].includes(lang.code)
    ),
    'Eastern European': languages.filter(lang => 
      ['el', 'tr', 'ru'].includes(lang.code)
    ),
    'Asian Languages': languages.filter(lang => 
      ['ja', 'zh', 'hi', 'id'].includes(lang.code)
    ),
    'Middle Eastern': languages.filter(lang => 
      ['ar'].includes(lang.code)
    ),
  };
};

// Helper function to get popular languages first
export const getPopularLanguages = (): Language[] => {
  const popularCodes = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'hi'];
  return popularCodes
    .map(code => getLanguageByCode(code))
    .filter(Boolean) as Language[];
};