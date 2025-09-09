import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, useTranslation, useRTLStyle } from '../contexts/LanguageContext';
import { Language } from '../utils/languages';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showCurrentSelection?: boolean;
}

export default function LanguagePicker({
  visible,
  onClose,
  title,
  showCurrentSelection = true
}: LanguagePickerProps) {
  const { currentLanguage, setLanguage, availableLanguages, getCurrentLanguage } = useLanguage();
  const t = useTranslation();
  const { isRTL, getTextAlign, getFlexDirection } = useRTLStyle();

  const handleLanguageSelect = async (language: Language) => {
    try {
      await setLanguage(language.code);
      Alert.alert(
        t.common.success,
        t.language.languageChanged,
        [{ text: t.common.ok, onPress: onClose }]
      );
    } catch (error) {
      Alert.alert(t.common.error, t.errors.networkError);
    }
  };

  const currentLang = getCurrentLanguage();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: getFlexDirection('row') }]}>
          <Text style={[styles.headerTitle, { textAlign: getTextAlign('left') }]}>
            {title || t.language.selectLanguage}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons 
              name="close" 
              size={24} 
              color="#333" 
              style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
          </TouchableOpacity>
        </View>

        {/* Current Language (if enabled) */}
        {showCurrentSelection && currentLang && (
          <View style={styles.currentLanguageSection}>
            <Text style={[styles.sectionTitle, { textAlign: getTextAlign('left') }]}>
              {t.language.currentLanguage}
            </Text>
            <View style={[styles.currentLanguageCard, { flexDirection: getFlexDirection('row') }]}>
              <Text style={styles.languageFlag}>{currentLang.flag}</Text>
              <View style={styles.languageDetails}>
                <Text style={[styles.languageName, { textAlign: getTextAlign('left') }]}>
                  {currentLang.nativeName}
                </Text>
                <Text style={[styles.languageCode, { textAlign: getTextAlign('left') }]}>
                  {currentLang.name}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            </View>
          </View>
        )}

        {/* Available Languages */}
        <View style={styles.languagesSection}>
          <Text style={[styles.sectionTitle, { textAlign: getTextAlign('left') }]}>
            {t.language.selectLanguage}
          </Text>
          
          <ScrollView style={styles.languagesList} showsVerticalScrollIndicator={false}>
            {availableLanguages.map((language) => {
              const isSelected = language.code === currentLanguage;
              
              return (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageItem,
                    isSelected && styles.languageItemSelected,
                    { flexDirection: getFlexDirection('row') }
                  ]}
                  onPress={() => handleLanguageSelect(language)}
                  disabled={isSelected}
                >
                  <View style={[styles.languageInfo, { flexDirection: getFlexDirection('row') }]}>
                    <Text style={styles.languageFlag}>{language.flag}</Text>
                    <View style={styles.languageDetails}>
                      <Text style={[
                        styles.languageName,
                        isSelected && styles.languageNameSelected,
                        { textAlign: getTextAlign('left') }
                      ]}>
                        {language.nativeName}
                      </Text>
                      <Text style={[styles.languageSubtext, { textAlign: getTextAlign('left') }]}>
                        {language.name} {language.rtl && '(RTL)'}
                      </Text>
                    </View>
                  </View>
                  
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.closeFooterButton}
            onPress={onClose}
          >
            <Text style={styles.closeFooterButtonText}>{t.common.close}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// Simple Language Selector Component for inline use
interface LanguageSelectorProps {
  onLanguageSelect?: (language: Language) => void;
  style?: any;
  compact?: boolean;
}

export function LanguageSelector({
  onLanguageSelect,
  style,
  compact = false
}: LanguageSelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const { getCurrentLanguage } = useLanguage();
  const t = useTranslation();
  const { isRTL, getFlexDirection, getTextAlign } = useRTLStyle();
  
  const currentLang = getCurrentLanguage();

  const handleLanguageSelect = (language: Language) => {
    if (onLanguageSelect) {
      onLanguageSelect(language);
    }
    setShowPicker(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          compact ? styles.compactSelector : styles.selector,
          style,
          { flexDirection: getFlexDirection('row') }
        ]}
        onPress={() => setShowPicker(true)}
      >
        <View style={[styles.selectorContent, { flexDirection: getFlexDirection('row') }]}>
          {currentLang && (
            <>
              <Text style={styles.selectorFlag}>{currentLang.flag}</Text>
              <Text style={[
                compact ? styles.selectorTextCompact : styles.selectorText,
                { textAlign: getTextAlign('left') }
              ]}>
                {compact ? currentLang.code.toUpperCase() : currentLang.nativeName}
              </Text>
            </>
          )}
        </View>
        <Ionicons 
          name="chevron-down" 
          size={16} 
          color="#666" 
          style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
        />
      </TouchableOpacity>

      <LanguagePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        showCurrentSelection={!compact}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    // Additional RTL container styles if needed
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  currentLanguageSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  currentLanguageCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  languagesSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  languagesList: {
    flex: 1,
  },
  languageItem: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  languageItemSelected: {
    backgroundColor: '#f0f7ff',
    borderColor: '#007AFF',
  },
  languageInfo: {
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  languageDetails: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  languageNameSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  languageSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  languageCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  closeFooterButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  // Selector styles
  selector: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  compactSelector: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    minHeight: 36,
  },
  selectorContent: {
    alignItems: 'center',
    flex: 1,
  },
  selectorFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  selectorTextCompact: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
});