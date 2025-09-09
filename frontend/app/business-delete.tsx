import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function BusinessDeletePage() {
  const [loading, setLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [understood, setUnderstood] = useState(false);

  const handleDeleteBusiness = async () => {
    if (confirmationText.toLowerCase() !== 'delete my business') {
      Alert.alert('Confirmation Required', 'Please type "DELETE MY BUSINESS" to confirm deletion.');
      return;
    }

    if (!understood) {
      Alert.alert('Confirmation Required', 'Please confirm that you understand the consequences.');
      return;
    }

    Alert.alert(
      'Final Confirmation',
      'This action cannot be undone. Your business profile will be permanently deleted, and you will lose trial eligibility if you register again. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: performDeletion
        }
      ]
    );
  };

  const performDeletion = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/delete-profile`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          'Business Deleted',
          result.message + '\n\n' + result.note,
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/');
              }
            }
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Deletion Failed', error.detail || 'Failed to delete business profile');
      }
    } catch (error) {
      console.error('Error deleting business:', error);
      Alert.alert('Error', 'Failed to delete business profile');
    } finally {
      setLoading(false);
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
        <Text style={styles.headerTitle}>Delete Business</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Warning Section */}
        <View style={styles.warningSection}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning" size={32} color="#FF3B30" />
            <Text style={styles.warningTitle}>Permanent Deletion</Text>
          </View>
          <Text style={styles.warningText}>
            This action will permanently delete your business profile and cannot be undone.
          </Text>
        </View>

        {/* What Will Be Deleted */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>What will be deleted:</Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="business-outline" size={20} color="#FF3B30" />
              <Text style={styles.infoText}>Your business profile and listing</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="ticket-outline" size={20} color="#FF3B30" />
              <Text style={styles.infoText}>All created discounts and coupons</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="star-outline" size={20} color="#FF3B30" />
              <Text style={styles.infoText}>Customer ratings and reviews</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="card-outline" size={20} color="#FF3B30" />
              <Text style={styles.infoText}>Active subscription (if any)</Text>
            </View>
          </View>
        </View>

        {/* What Will Be Kept */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>What will be kept for security:</Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#FF9500" />
              <Text style={styles.infoText}>Business name, location, phone, and email</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#FF9500" />
              <Text style={styles.infoText}>Deletion timestamp for audit purposes</Text>
            </View>
          </View>
        </View>

        {/* Important Notice */}
        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>⚠️ Important Notice</Text>
          <Text style={styles.noticeText}>
            If you register a business again with the same details, you will NOT be eligible for the 90-day trial period. This prevents trial abuse and ensures fair usage.
          </Text>
        </View>

        {/* Confirmation Section */}
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationTitle}>Type "DELETE MY BUSINESS" to confirm:</Text>
          <TextInput
            style={styles.confirmationInput}
            value={confirmationText}
            onChangeText={setConfirmationText}
            placeholder="DELETE MY BUSINESS"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setUnderstood(!understood)}
          >
            <View style={[styles.checkbox, understood && styles.checkboxChecked]}>
              {understood && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.checkboxText}>
              I understand that this action is permanent and I will lose trial eligibility if I register again
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            (!confirmationText || !understood || loading) && styles.deleteButtonDisabled
          ]}
          onPress={handleDeleteBusiness}
          disabled={!confirmationText || !understood || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Business Forever</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Alternative Actions */}
        <View style={styles.alternativeSection}>
          <Text style={styles.alternativeTitle}>Consider these alternatives:</Text>
          
          <TouchableOpacity style={styles.alternativeButton}>
            <Ionicons name="pause-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.alternativeText}>Pause your subscription instead</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.alternativeButton}
            onPress={() => router.push('/business-subscription')}
          >
            <Ionicons name="card-outline" size={20} color="#007AFF" />
            <Text style={styles.alternativeText}>Change subscription plan</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.alternativeButton}>
            <Ionicons name="help-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.alternativeText}>Contact support for help</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  warningSection: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 12,
  },
  warningText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  infoSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  noticeSection: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  confirmationSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  alternativeSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  alternativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  alternativeText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 12,
  },
});