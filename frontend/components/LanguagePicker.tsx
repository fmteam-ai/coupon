import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, useTranslation, useRTLStyle } from '../contexts/LanguageContext';
import { Language, getLanguagesByRegion, getPopularLanguages } from '../utils/languages';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showCurrentSelection?: boolean;
  showRegionalGroups?: boolean;
}

export default function LanguagePicker({
  visible,
  onClose,
  title,
  showCurrentSelection = true,
  showRegionalGroups = false
}: LanguagePickerProps) {
  const { currentLanguage, setLanguage, availableLanguages, getCurrentLanguage } = useLanguage();
  const t = useTranslation();
  const { isRTL, getTextAlign, getFlexDirection } = useRTLStyle();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter languages based on search query
  const filteredLanguages = availableLanguages.filter(language =>
    language.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    language.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    language.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group languages for better organization
  const getOrganizedLanguages = () => {
    if (searchQuery) {
      return [{
        title: `${t.search} "${searchQuery}"`,
        data: filteredLanguages
      }];
    }

    if (showRegionalGroups) {
      const regions = getLanguagesByRegion();
      return Object.entries(regions).map(([region, languages]) => ({
        title: region,
        data: languages
      }));
    }

    // Show popular languages first, then others
    const popularLanguages = getPopularLanguages();
    const otherLanguages = availableLanguages.filter(
      lang => !popularLanguages.some(popular => popular.code === lang.code)
    );

    const sections = [];
    if (popularLanguages.length > 0) {
      sections.push({
        title: 'Popular Languages',
        data: popularLanguages
      });
    }
    if (otherLanguages.length > 0) {
      sections.push({
        title: 'Other Languages',
        data: otherLanguages
      });
    }
    return sections;
  };

  const languageSections = getOrganizedLanguages();

  const renderLanguageItem = ({ item: language }: { item: Language }) => {
    const isSelected = language.code === currentLanguage;
    
    return (
      <TouchableOpacity
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
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { textAlign: getTextAlign('left') }]}>
        {section.title}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
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

        {/* Search Bar */}
        <View style={[styles.searchContainer, { flexDirection: getFlexDirection('row') }]}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { textAlign: getTextAlign('left') }]}
            placeholder={`${t.common.search} languages...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Current Language (if enabled) */}
        {showCurrentSelection && currentLang && !searchQuery && (
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

        {/* Languages List */}
        <View style={styles.languagesSection}>
          <SectionList
            sections={languageSections}
            keyExtractor={(item) => item.code}
            renderItem={renderLanguageItem}
            renderSectionHeader={renderSectionHeader}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateTitle}>No languages found</Text>
                <Text style={styles.emptyStateText}>
                  Try searching with a different term
                </Text>
              </View>
            )}
          />
        </View>

        {/* Language Stats */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { textAlign: getTextAlign('center') }]}>
            {availableLanguages.length} languages available
          </Text>
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
  searchContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  sectionHeader: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
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