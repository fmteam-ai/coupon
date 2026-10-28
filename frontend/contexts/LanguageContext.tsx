import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { getTranslation, Translations } from '../utils/translations';
import { getLanguageByCode, isRTL, Language, languages } from '../utils/languages';

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (languageCode: string) => Promise<void>;
  t: Translations;
  isRTL: boolean;
  availableLanguages: Language[];
  getCurrentLanguage: () => Language | undefined;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = '@user_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [translations, setTranslations] = useState<Translations>(getTranslation('en'));
  const [rtlEnabled, setRtlEnabled] = useState<boolean>(false);

  // Load saved language on app start
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && languages.some(lang => lang.code === savedLanguage)) {
        await setLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading saved language:', error);
    }
  };

  const setLanguage = async (languageCode: string) => {
    try {
      // Validate language code
      const language = getLanguageByCode(languageCode);
      if (!language) {
        console.warn(`Language ${languageCode} is not supported`);
        return;
      }

      // Update state
      setCurrentLanguage(languageCode);
      setTranslations(getTranslation(languageCode));
      
      // Handle RTL layout
      const shouldBeRTL = isRTL(languageCode);
      setRtlEnabled(shouldBeRTL);
      
      // Update React Native RTL setting
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      }

      // Save to storage
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);

      console.log(`Language changed to: ${language.name} (${languageCode}), RTL: ${shouldBeRTL}`);
    } catch (error) {
      console.error('Error setting language:', error);
    }
  };

  const getCurrentLanguage = (): Language | undefined => {
    return getLanguageByCode(currentLanguage);
  };

  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    t: translations,
    isRTL: rtlEnabled,
    availableLanguages: languages,
    getCurrentLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Custom hook for easy translation access
export const useTranslation = () => {
  const { t } = useLanguage();
  return t;
};

// Custom hook for RTL-aware styling
export const useRTLStyle = () => {
  const { isRTL } = useLanguage();
  
  const getFlexDirection = (direction: 'row' | 'row-reverse' = 'row') => {
    if (direction === 'row' && isRTL) return 'row-reverse';
    if (direction === 'row-reverse' && isRTL) return 'row';
    return direction;
  };

  const getTextAlign = (align: 'left' | 'right' | 'center' = 'left') => {
    if (align === 'left' && isRTL) return 'right';
    if (align === 'right' && isRTL) return 'left';
    return align;
  };

  const getMarginDirection = (marginLeft?: number, marginRight?: number) => {
    if (isRTL) {
      return {
        marginLeft: marginRight,
        marginRight: marginLeft,
      };
    }
    return {
      marginLeft,
      marginRight,
    };
  };

  const getPaddingDirection = (paddingLeft?: number, paddingRight?: number) => {
    if (isRTL) {
      return {
        paddingLeft: paddingRight,
        paddingRight: paddingLeft,
      };
    }
    return {
      paddingLeft,
      paddingRight,
    };
  };

  return {
    isRTL,
    getFlexDirection,
    getTextAlign,
    getMarginDirection,
    getPaddingDirection,
  };
};