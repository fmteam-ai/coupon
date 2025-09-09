import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { CountrySelector } from '../components/CountryPicker';
import MapLocationPicker from '../components/MapLocationPicker';
import { Country } from '../utils/countries';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BusinessFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  category: string;
  description: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  precise_latitude: number | null;
  precise_longitude: number | null;
  location_verified_by_map: boolean;
  owner_name: string;
  owner_email: string;
  password: string;
}

const categories = [
  'Restaurant', 'Retail', 'Health & Beauty', 'Services',
  'Entertainment', 'Travel', 'Technology', 'Fitness',
  'Education', 'Other'
];

export default function BusinessAuthRegisterPage() {
  const [formData, setFormData] = useState<BusinessFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US',
    category: '',
    description: '',
    website: '',
    latitude: null,
    longitude: null,
    precise_latitude: null,
    precise_longitude: null,
    location_verified_by_map: false,
    owner_name: '',
    owner_email: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Multi-step form
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('not_set');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>({
    code: 'US',
    name: 'United States',
    flag: '🇺🇸'
  });

  const updateFormData = (field: keyof BusinessFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getCurrentLocation = async () => {
    try {
      setLocationStatus('getting');
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set your business location');
        setLocationStatus('not_set');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      
      updateFormData('latitude', location.coords.latitude);
      updateFormData('longitude', location.coords.longitude);
      
      // For now, use current location as precise location
      // In a full implementation, this would open a map picker
      updateFormData('precise_latitude', location.coords.latitude);
      updateFormData('precise_longitude', location.coords.longitude);
      updateFormData('location_verified_by_map', true);
      
      setLocationStatus('set');
      Alert.alert('Location Set', 'Your business location has been set successfully');
      
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Failed to get your current location');
      setLocationStatus('not_set');
    }
  };

  const handleMapLocationSelect = (location: { latitude: number; longitude: number; address?: string }) => {
    updateFormData('precise_latitude', location.latitude);
    updateFormData('precise_longitude', location.longitude);
    updateFormData('location_verified_by_map', true);
    
    // Also update regular coordinates for backwards compatibility
    updateFormData('latitude', location.latitude);
    updateFormData('longitude', location.longitude);
    
    setLocationStatus('set');
    setShowMapPicker(false);
    
    Alert.alert(
      'Location Set! 📍',
      location.address || `Location set at ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
      [{ text: 'OK' }]
    );
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    updateFormData('country', country.code);
  };

  const validateStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1: // Business Info
        return !!(formData.name && formData.email && formData.phone && 
                 formData.address && formData.city && formData.state && 
                 formData.zip_code && formData.category);
      case 2: // Owner Info
        return !!(formData.owner_name && formData.owner_email && formData.password);
      case 3: // Location (optional for validation, but encouraged)
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    } else {
      Alert.alert('Missing Information', 'Please fill in all required fields');
    }
  };

  const handleRegister = async () => {
    if (!validateStep(1) || !validateStep(2)) {
      Alert.alert('Missing Information', 'Please complete all required fields');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Password Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Save access token
        await AsyncStorage.setItem('auth_token', result.access_token);
        await AsyncStorage.setItem('user_type', 'business_owner');
        await AsyncStorage.setItem('business_id', result.business_id);
        
        Alert.alert(
          'Registration Successful!',
          `Your business has been registered and is pending admin approval. You have been granted a ${result.trial_days}-day trial period.`,
          [
            {
              text: 'Continue to Dashboard',
              onPress: () => router.replace('/business-dashboard')
            }
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Registration Failed', error.detail || 'Failed to register business');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Failed to register business');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Business Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(value) => updateFormData('name', value)}
          placeholder="Enter your business name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Email *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(value) => updateFormData('email', value)}
          placeholder="business@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(value) => updateFormData('phone', value)}
          placeholder="+1 (555) 123-4567"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Address *</Text>
        <TextInput
          style={styles.input}
          value={formData.address}
          onChangeText={(value) => updateFormData('address', value)}
          placeholder="Street address"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 2 }]}>
          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            value={formData.city}
            onChangeText={(value) => updateFormData('city', value)}
            placeholder="City"
          />
        </View>
        
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
          <Text style={styles.label}>State *</Text>
          <TextInput
            style={styles.input}
            value={formData.state}
            onChangeText={(value) => updateFormData('state', value)}
            placeholder="ST"
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>ZIP Code *</Text>
        <TextInput
          style={styles.input}
          value={formData.zip_code}
          onChangeText={(value) => updateFormData('zip_code', value)}
          placeholder="12345"
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Country *</Text>
        <CountrySelector
          selectedCountryCode={formData.country}
          onCountrySelect={handleCountrySelect}
          placeholder="Select Country"
          style={styles.input}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Category *</Text>
        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={[styles.categoryButtonText, !formData.category && styles.placeholder]}>
            {formData.category || 'Select a category'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(value) => updateFormData('description', value)}
          placeholder="Describe your business..."
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Website (Optional)</Text>
        <TextInput
          style={styles.input}
          value={formData.website}
          onChangeText={(value) => updateFormData('website', value)}
          placeholder="https://www.yourbusiness.com"
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Owner Information</Text>
      <Text style={styles.stepSubtitle}>
        This information is used to create your business owner account
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.owner_name}
          onChangeText={(value) => updateFormData('owner_name', value)}
          placeholder="Your full name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          value={formData.owner_email}
          onChangeText={(value) => updateFormData('owner_email', value)}
          placeholder="your.email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          value={formData.password}
          onChangeText={(value) => updateFormData('password', value)}
          placeholder="Minimum 6 characters"
          secureTextEntry
        />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          You'll use this email and password to log in to your business dashboard
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set Your Location</Text>
      <Text style={styles.stepSubtitle}>
        Help customers find you by setting your exact business location
      </Text>
      
      <View style={styles.locationSection}>
        <View style={styles.locationStatus}>
          <Ionicons 
            name={locationStatus === 'set' ? 'location' : 'location-outline'} 
            size={24} 
            color={locationStatus === 'set' ? '#34C759' : '#666'} 
          />
          <Text style={styles.locationStatusText}>
            {locationStatus === 'set' 
              ? 'Location set successfully' 
              : locationStatus === 'getting'
              ? 'Getting your location...'
              : 'Location not set'
            }
          </Text>
        </View>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
          disabled={locationStatus === 'getting'}
        >
          {locationStatus === 'getting' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.locationButtonText}>
                {locationStatus === 'set' ? 'Update Location' : 'Set Current Location'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.locationNote}>
          💡 In the full version, you'll be able to drag a pin on a map to set your exact location
        </Text>
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Registration Summary</Text>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Business:</Text>
          <Text style={styles.summaryValue}>{formData.name}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Category:</Text>
          <Text style={styles.summaryValue}>{formData.category}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Location:</Text>
          <Text style={styles.summaryValue}>{formData.city}, {formData.state}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Owner:</Text>
          <Text style={styles.summaryValue}>{formData.owner_name}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Registration</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Step {step} of 3</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backStepButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backStepButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        {step < 3 ? (
          <TouchableOpacity
            style={[styles.nextButton, !validateStep(step) && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!validateStep(step)}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.registerButtonText}>Register Business</Text>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryOption,
                  formData.category === category && styles.categoryOptionSelected
                ]}
                onPress={() => {
                  updateFormData('category', category);
                  setShowCategoryModal(false);
                }}
              >
                <Text style={[
                  styles.categoryOptionText,
                  formData.category === category && styles.categoryOptionTextSelected
                ]}>
                  {category}
                </Text>
                {formData.category === category && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e1e1e1',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholder: {
    color: '#999',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  locationSection: {
    marginBottom: 24,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationStatusText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  locationButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  summarySection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    gap: 12,
  },
  backStepButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  backStepButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    flex: 1,
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
  },
  categoryOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
});