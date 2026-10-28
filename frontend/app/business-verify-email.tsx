import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface VerificationStatus {
  business_id: string;
  business_name: string;
  email: string;
  email_verified: boolean;
  email_verified_at?: string;
  is_approved: boolean;
}

export default function BusinessVerifyEmailPage() {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert('Error', 'Please login first');
        router.push('/');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/verification-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const statusData = await response.json();
        setStatus(statusData);
        
        if (statusData.email_verified) {
          Alert.alert(
            'Already Verified!',
            'Your business email is already verified.',
            [
              { text: 'Go to Dashboard', onPress: () => router.push('/business-dashboard') }
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Failed to load verification status');
      }
    } catch (error) {
      console.error('Load verification status error:', error);
      Alert.alert('Error', 'Failed to load verification status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit verification code');
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

      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          verification_code: verificationCode
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          'Email Verified!',
          'Your business email has been verified successfully. Your business is now pending admin approval.',
          [
            { text: 'Go to Dashboard', onPress: () => router.push('/business-dashboard') }
          ]
        );
      } else {
        Alert.alert('Error', result.detail || 'Email verification failed');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      Alert.alert('Error', 'Failed to verify email');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setResending(true);
      const token = await AsyncStorage.getItem('session_token');
      
      if (!token) {
        Alert.alert('Error', 'Please login first');
        router.push('/');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/resend-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Code Sent!', `A new verification code has been sent to ${status?.email}`);
      } else {
        Alert.alert('Error', result.detail || 'Failed to resend verification code');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      Alert.alert('Error', 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  if (loadingStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Business Email</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Email Info */}
        <View style={styles.emailInfo}>
          <View style={styles.emailIconContainer}>
            <Ionicons name="mail" size={48} color="#007AFF" />
          </View>
          <Text style={styles.businessName}>{status?.business_name}</Text>
          <Text style={styles.emailText}>
            We sent a verification code to:
          </Text>
          <Text style={styles.emailAddress}>{status?.email}</Text>
          
          {/* Progress Indicator */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Verification Progress</Text>
            <View style={styles.progressSteps}>
              <View style={styles.progressStep}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.progressStepText}>Business Registered</Text>
              </View>
              <View style={[styles.progressStep, !status?.email_verified && styles.progressStepActive]}>
                <Ionicons 
                  name={status?.email_verified ? "checkmark-circle" : "time"} 
                  size={20} 
                  color={status?.email_verified ? "#34C759" : "#007AFF"} 
                />
                <Text style={[styles.progressStepText, !status?.email_verified && styles.progressStepActiveText]}>
                  Email Verification
                </Text>
              </View>
              <View style={styles.progressStep}>
                <Ionicons 
                  name={status?.is_approved ? "checkmark-circle" : "time"} 
                  size={20} 
                  color={status?.is_approved ? "#34C759" : "#ccc"} 
                />
                <Text style={[styles.progressStepText, !status?.is_approved && styles.progressStepInactive]}>
                  Admin Approval
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Verification Code Input */}
        <View style={styles.verificationSection}>
          <Text style={styles.sectionTitle}>Enter Verification Code</Text>
          <TextInput
            style={styles.codeInput}
            value={verificationCode}
            onChangeText={setVerificationCode}
            placeholder="000000"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
          <Text style={styles.codeHint}>
            Enter the 6-digit code sent to your email
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.disabledButton]}
            onPress={handleVerifyEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.verifyButtonText}>Verify Email</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendButton, resending && styles.disabledButton]}
            onPress={handleResendCode}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color="#007AFF" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#007AFF" />
                <Text style={styles.resendButtonText}>Resend Code</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            📧 Check your email inbox and spam folder{'\n'}
            ⏰ Code expires in 24 hours{'\n'}
            🔒 Email verification is required for business approval
          </Text>
        </View>
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
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emailInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  emailIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emailAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },
  verificationSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    color: '#333',
    borderWidth: 2,
    borderColor: '#007AFF',
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
  },
  codeHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 24,
  },
  verifyButton: {
    backgroundColor: '#007AFF',
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
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
  // Progress indicator styles
  progressSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressSteps: {
    gap: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressStepActive: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressStepText: {
    fontSize: 14,
    color: '#666',
  },
  progressStepActiveText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  progressStepInactive: {
    fontSize: 14,
    color: '#ccc',
  },
});