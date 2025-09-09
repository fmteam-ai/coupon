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
  KeyboardAvoidingView,
  Platform,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DiscountData {
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: string;
  minimum_consumption: string;
  max_uses: string;
  max_uses_per_user: string;
  expires_at: string;
  terms_conditions: string;
}

export default function CreateDiscountPage() {
  const [formData, setFormData] = useState<DiscountData>({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    minimum_consumption: '0',
    max_uses: '',
    max_uses_per_user: '1',
    expires_at: '',
    terms_conditions: '',
  });
  const [loading, setLoading] = useState(false);
  const [hasMaxUses, setHasMaxUses] = useState(false);

  const handleCreate = async () => {
    if (!formData.title || !formData.description || !formData.discount_value || !formData.expires_at) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const discountValue = parseFloat(formData.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) {
      Alert.alert('Error', 'Please enter a valid discount value');
      return;
    }

    if (formData.discount_type === 'percentage' && discountValue > 100) {
      Alert.alert('Error', 'Percentage discount cannot exceed 100%');
      return;
    }

    // Validate expiry date
    const expiryDate = new Date(formData.expires_at);
    if (expiryDate <= new Date()) {
      Alert.alert('Error', 'Expiry date must be in the future');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      if (!token) {
        Alert.alert('Error', 'Please login first');
        router.push('/');
        return;
      }

      const requestData = {
        title: formData.title,
        description: formData.description,
        discount_type: formData.discount_type,
        discount_value: discountValue,
        minimum_consumption: parseFloat(formData.minimum_consumption) || 0,
        max_uses: hasMaxUses && formData.max_uses ? parseInt(formData.max_uses) : null,
        max_uses_per_user: parseInt(formData.max_uses_per_user) || 1,
        expires_at: expiryDate.toISOString(),
        terms_conditions: formData.terms_conditions || null,
      };

      const response = await fetch(`${EXPO_BACKEND_URL}/api/discounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success!', 
          'Discount created successfully!',
          [
            { text: 'View QR Code', onPress: () => router.push({
              pathname: '/qr-display',
              params: {
                qr_code: result.qr_code,
                title: formData.title,
                business_name: 'Your Business',
                discount_value: formData.discount_type === 'percentage' 
                  ? `${formData.discount_value}% OFF`
                  : `$${formData.discount_value} OFF`
              }
            })},
            { text: 'Create Another', onPress: () => {
              setFormData({
                title: '',
                description: '',
                discount_type: 'percentage',
                discount_value: '',
                minimum_consumption: '0',
                max_uses: '',
                max_uses_per_user: '1',
                expires_at: '',
                terms_conditions: '',
              });
              setHasMaxUses(false);
            }},
            { text: 'Dashboard', onPress: () => router.push('/business-dashboard') }
          ]
        );
      } else {
        Alert.alert('Error', result.detail || 'Failed to create discount');
      }
    } catch (error) {
      console.error('Create discount error:', error);
      Alert.alert('Error', 'Failed to create discount');
    } finally {
      setLoading(false);
    }
  };

  const getDateInputValue = () => {
    if (!formData.expires_at) return '';
    const date = new Date(formData.expires_at);
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (dateString: string) => {
    if (dateString) {
      const date = new Date(dateString + 'T23:59:59');
      setFormData(prev => ({ ...prev, expires_at: date.toISOString() }));
    } else {
      setFormData(prev => ({ ...prev, expires_at: '' }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Discount</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Discount Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="e.g., 20% Off All Pizzas"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Describe your discount offer in detail"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Discount Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discount Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Discount Type</Text>
              <View style={styles.discountTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    formData.discount_type === 'percentage' && styles.typeButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, discount_type: 'percentage' }))}
                >
                  <Ionicons 
                    name="percent-outline" 
                    size={20} 
                    color={formData.discount_type === 'percentage' ? '#fff' : '#007AFF'} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    formData.discount_type === 'percentage' && styles.typeButtonTextActive
                  ]}>
                    Percentage
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    formData.discount_type === 'fixed_amount' && styles.typeButtonActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, discount_type: 'fixed_amount' }))}
                >
                  <Ionicons 
                    name="cash-outline" 
                    size={20} 
                    color={formData.discount_type === 'fixed_amount' ? '#fff' : '#007AFF'} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    formData.discount_type === 'fixed_amount' && styles.typeButtonTextActive
                  ]}>
                    Fixed Amount
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
              </Text>
              <TextInput
                style={styles.input}
                value={formData.discount_value}
                onChangeText={(text) => setFormData(prev => ({ ...prev, discount_value: text }))}
                placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Minimum Purchase Amount ($)</Text>
              <TextInput
                style={styles.input}
                value={formData.minimum_consumption}
                onChangeText={(text) => setFormData(prev => ({ ...prev, minimum_consumption: text }))}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Usage Limits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usage Limits</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Maximum Uses Per User</Text>
              <TextInput
                style={styles.input}
                value={formData.max_uses_per_user}
                onChangeText={(text) => setFormData(prev => ({ ...prev, max_uses_per_user: text }))}
                placeholder="1"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>How many times each customer can use this coupon</Text>
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>Set Total Usage Limit</Text>
                <Text style={styles.helperText}>Limit total number of redemptions</Text>
              </View>
              <Switch
                value={hasMaxUses}
                onValueChange={setHasMaxUses}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={hasMaxUses ? '#fff' : '#f4f3f4'}
              />
            </View>

            {hasMaxUses && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Maximum Uses</Text>
                <TextInput
                  style={styles.input}
                  value={formData.max_uses}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, max_uses: text }))}
                  placeholder="100"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            )}
          </View>

          {/* Expiry */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiry</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Expiry Date *</Text>
              <TextInput
                style={styles.input}
                value={getDateInputValue()}
                onChangeText={handleDateChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
              <Text style={styles.helperText}>Enter date in YYYY-MM-DD format</Text>
            </View>
          </View>

          {/* Terms & Conditions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Terms (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.terms_conditions}
                onChangeText={(text) => setFormData(prev => ({ ...prev, terms_conditions: text }))}
                placeholder="Enter any additional terms and conditions"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabledButton]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Discount</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
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
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  discountTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 8,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    flex: 1,
  },
  createButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});