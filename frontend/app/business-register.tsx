import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CountrySelector from '../components/CountryPicker';
import LanguageSelector from '../components/LanguagePicker';
import MapLocationPicker from '../components/MapLocationPicker';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../utils/languages';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BusinessData {
  name: string;
  description: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
  language: string;
  logo?: string;
  latitude?: number;
  longitude?: number;
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
  formattedAddress?: string;
}

export default function BusinessRegisterPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);

  const [formData, setFormData] = useState<BusinessData>({
    name: '',
    description: '',
    category: 'Restaurant',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    state: '',
    country: 'US',
    language: 'en',
  });

  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>({
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    rtl: false,
  });

  // Map location picker states
  const [showMapForAddress, setShowMapForAddress] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState<LocationCoordinates | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  const categories = [
    'Restaurant', 'Retail', 'Health & Beauty', 'Services', 
    'Entertainment', 'Travel', 'Technology', 'Fitness'
  ];

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setLogoImage(result.assets[0].base64);
    }
  };

  const handleCountrySelect = (countryCode: string) => {
    setFormData(prev => ({ ...prev, country: countryCode }));
  };

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    setFormData(prev => ({ ...prev, language: language.code }));
  };

  const handleMapLocationSelect = (location: LocationCoordinates) => {
    setLocationCoordinates(location);
    
    // Auto-populate form fields from location data
    setFormData(prev => ({ 
      ...prev, 
      latitude: location.latitude, 
      longitude: location.longitude,
      // Auto-fill address components if available
      address: location.address || prev.address,
      city: location.city || prev.city,
      postalCode: location.postalCode || prev.postalCode,
      state: location.state || prev.state,
      country: location.country || prev.country,
    }));
    
    setShowMapModal(false);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use current location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coordinates: LocationCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Try to get address from coordinates
      try {
        const geocoded = await Location.reverseGeocodeAsync(coordinates);
        if (geocoded.length > 0) {
          const addr = geocoded[0];
          coordinates.address = [
            addr.name,
            addr.street,
            addr.city,
            addr.region,
            addr.country
          ].filter(Boolean).join(', ');
          
          // Update form data with geocoded information
          setFormData(prev => ({
            ...prev,
            address: `${addr.street} ${addr.name}`.trim() || prev.address,
            city: addr.city || prev.city,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          }));
        }
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
      }

      setLocationCoordinates(coordinates);
      setShowMapForAddress(true);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Failed to get your current location');
    }
  };

  const handleAddressChange = (text: string) => {
    setFormData(prev => ({ ...prev, address: text }));
    // Show map after user has typed a reasonable amount
    if (text.length > 10) {
      setShowMapForAddress(true);
    } else {
      setShowMapForAddress(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.city) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const registrationData = {
        ...formData,
        logo: logoImage,
      };

      const response = await fetch(`${EXPO_BACKEND_URL}/api/businesses/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (response.ok) {
        const locationInfo = locationCoordinates ? 
          `\n📍 Location: ${locationCoordinates.latitude.toFixed(6)}, ${locationCoordinates.longitude.toFixed(6)}` +
          (locationCoordinates.formattedAddress ? `\n🏠 Address: ${locationCoordinates.formattedAddress}` : '') : '';
        
        Alert.alert(
          '🎉 Registration Successful!', 
          `Your business "${formData.name}" has been registered successfully!\n\n` +
          `✅ ${result.trial_days}-day free trial activated\n` +
          `📧 Verification email sent to:\n   ${formData.email}\n` +
          `⏳ Business pending admin approval\n` +
          `${locationInfo}\n\n` +
          `📱 Next Steps:\n` +
          `1. Check your email for verification code\n` +
          `2. Complete email verification\n` +
          `3. Wait for admin approval\n\n` +
          `Thank you for joining DealWiz! 🚀`,
          [
            { 
              text: 'Verify Email Now', 
              onPress: () => router.push('/business-verify-email') 
            },
            { 
              text: 'Go to Dashboard', 
              onPress: () => router.push('/business-dashboard') 
            }
          ]
        );
      } else {
        Alert.alert('Error', result.detail || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Failed to register business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Business</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView 
        style={styles.flex1} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.logoSection}>
            <Text style={styles.sectionTitle}>Business Logo</Text>
            <TouchableOpacity style={styles.logoContainer} onPress={pickImage}>
              {logoImage ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${logoImage}` }}
                  style={styles.logoImage}
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="camera" size={40} color="#ccc" />
                  <Text style={styles.logoText}>Add Logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Enter your business name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      formData.category === category && styles.categoryButtonActive
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, category }))}
                  >
                    <Text style={[
                      styles.categoryText,
                      formData.category === category && styles.categoryTextActive
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Describe your business"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                placeholder="business@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder="+1-555-0123"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={handleAddressChange}
                placeholder="123 Main Street"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
                  placeholder="New York"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1, styles.marginLeft]}>
                <Text style={styles.label}>Postal Code</Text>
                <TextInput
                  style={styles.input}
                  value={formData.postalCode}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, postalCode: text }))}
                  placeholder="10001"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>State/Region</Text>
                <TextInput
                  style={styles.input}
                  value={formData.state}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, state: text }))}
                  placeholder="New York"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1, styles.marginLeft]}>
                <Text style={styles.label}>Country *</Text>
                <CountrySelector
                  selectedCountryCode={formData.country}
                  onCountrySelect={handleCountrySelect}
                  placeholder="Select Country"
                  style={styles.input}
                />
              </View>
            </View>

            {showMapForAddress && (
              <View style={styles.mapSection}>
                <View style={styles.mapHeader}>
                  <Text style={styles.mapTitle}>📍 Confirm Your Location</Text>
                  <Text style={styles.mapSubtitle}>
                    Tap the button below to open the map and confirm your exact business location
                  </Text>
                </View>
                
                <View style={styles.mapActions}>
                  <TouchableOpacity 
                    style={styles.mapActionButtonPrimary}
                    onPress={() => setShowMapModal(true)}
                  >
                    <Ionicons name="map" size={16} color="#fff" />
                    <Text style={styles.mapActionTextPrimary}>Open Map to Select Location</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.mapActionButton}
                    onPress={getCurrentLocation}
                  >
                    <Ionicons name="navigate" size={16} color="#007AFF" />
                    <Text style={styles.mapActionText}>Use Current Location</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.mapActionButton}
                    onPress={() => setShowMapForAddress(false)}
                  >
                    <Ionicons name="close" size={16} color="#666" />
                    <Text style={[styles.mapActionText, {color: '#666'}]}>Hide Location Picker</Text>
                  </TouchableOpacity>
                </View>

                {locationCoordinates && (
                  <View style={styles.locationConfirmed}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.locationConfirmedText}>
                      Location confirmed: {locationCoordinates.latitude.toFixed(6)}, {locationCoordinates.longitude.toFixed(6)}
                    </Text>
                    {locationCoordinates.address && (
                      <Text style={styles.locationAddress}>
                        {locationCoordinates.address}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Language *</Text>
              <LanguageSelector
                onLanguageSelect={handleLanguageSelect}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.termsSection}>
            <Text style={styles.termsText}>
              By registering your business, you agree to our Terms of Service and Privacy Policy. 
              Your business will be reviewed by our team before approval.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="business-outline" size={20} color="#fff" />
                <Text style={styles.registerButtonText}>Register Business</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <MapLocationPicker
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onLocationSelected={handleMapLocationSelect}
        initialLocation={locationCoordinates || undefined}
        initialAddress={`${formData.address}, ${formData.city}`.trim().replace(/^,\s*/, '')}
        title="Select Your Business Location"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    // Modern gradient background (fallback solid color for now)
    backgroundColor: '#007AFF',
    borderBottomWidth: 0,
    // Add subtle shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  logoSection: {
    padding: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e1e1e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  logoPlaceholder: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  marginLeft: {
    marginLeft: 12,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  mapSection: {
    marginTop: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  mapHeader: {
    marginBottom: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  mapActions: {
    gap: 12,
  },
  mapActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  mapActionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  mapActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  mapActionTextPrimary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  locationConfirmed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
    gap: 8,
  },
  locationConfirmedText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  termsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  termsText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 16,
  },
  registerButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});