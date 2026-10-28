import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { countries, Country, getCountryByCode } from '../utils/countries';

interface CountryPickerProps {
  visible: boolean;
  onClose: () => void;
  onCountrySelect: (country: Country) => void;
  selectedCountryCode?: string;
  title?: string;
}

export default function CountryPicker({
  visible,
  onClose,
  onCountrySelect,
  selectedCountryCode,
  title = "Select Country"
}: CountryPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCountrySelect = (country: Country) => {
    onCountrySelect(country);
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search countries..."
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

        {/* Countries List */}
        <ScrollView style={styles.countriesList} showsVerticalScrollIndicator={false}>
          {filteredCountries.map((country) => (
            <TouchableOpacity
              key={country.code}
              style={[
                styles.countryItem,
                selectedCountryCode === country.code && styles.countryItemSelected
              ]}
              onPress={() => handleCountrySelect(country)}
            >
              <View style={styles.countryInfo}>
                <Text style={styles.countryFlag}>{country.flag}</Text>
                <View style={styles.countryDetails}>
                  <Text style={[
                    styles.countryName,
                    selectedCountryCode === country.code && styles.countryNameSelected
                  ]}>
                    {country.name}
                  </Text>
                  <Text style={styles.countryCode}>{country.code}</Text>
                </View>
              </View>
              
              {selectedCountryCode === country.code && (
                <Ionicons name="checkmark" size={20} color="#007AFF" />
              )}
            </TouchableOpacity>
          ))}
          
          {filteredCountries.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No countries found</Text>
              <Text style={styles.emptyStateText}>
                Try searching with a different term
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Also create a simple CountrySelector component for inline use
interface CountrySelectorProps {
  selectedCountryCode?: string;
  onCountrySelect: (country: Country) => void;
  placeholder?: string;
  style?: any;
}

export function CountrySelector({
  selectedCountryCode,
  onCountrySelect,
  placeholder = "Select Country",
  style
}: CountrySelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedCountry = selectedCountryCode ? getCountryByCode(selectedCountryCode) : null;

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, style]}
        onPress={() => setShowPicker(true)}
      >
        <View style={styles.selectorContent}>
          {selectedCountry ? (
            <>
              <Text style={styles.selectorFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.selectorText}>{selectedCountry.name}</Text>
            </>
          ) : (
            <Text style={[styles.selectorText, styles.selectorPlaceholder]}>
              {placeholder}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      <CountryPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onCountrySelect={onCountrySelect}
        selectedCountryCode={selectedCountryCode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
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
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
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
  countriesList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  countryItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  countryDetails: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  countryNameSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  countryCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Selector styles
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  selectorContent: {
    flexDirection: 'row',
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
  selectorPlaceholder: {
    color: '#999',
  },
});