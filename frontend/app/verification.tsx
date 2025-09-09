import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
}

export default function VerificationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailCode, setEmailCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setPhoneNumber(userData.phone || '');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('User check error:', error);
      Alert.alert('Error', 'Failed to load user information');
    } finally {
      setLoading(false);
    }
  };

  const sendEmailVerification = async () => {
    try {
      setEmailLoading(true);
      const token = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/send-email-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setEmailSent(true);
        Alert.alert('Success', 'Verification code sent to your email');
      } else {
        Alert.alert('Error', result.detail || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      Alert.alert('Error', 'Failed to send verification code');
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    try {
      setEmailLoading(true);
      const token = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: user?.email,
          code: emailCode,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Email verified successfully');
        checkUserStatus(); // Refresh user data
        setEmailCode('');
        setEmailSent(false);
      } else {
        Alert.alert('Error', result.detail || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      Alert.alert('Error', 'Failed to verify email');
    } finally {
      setEmailLoading(false);
    }
  };

  const sendPhoneVerification = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    try {
      setPhoneLoading(true);
      const token = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/send-phone-verification?phone=${encodeURIComponent(phoneNumber)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        setPhoneSent(true);
        Alert.alert('Success', 'Verification code sent to your phone');
      } else {
        Alert.alert('Error', result.detail || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      Alert.alert('Error', 'Failed to send verification code');
    } finally {
      setPhoneLoading(false);
    }
  };

  const verifyPhone = async () => {
    if (!phoneCode || phoneCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    try {
      setPhoneLoading(true);
      const token = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/verify-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: phoneNumber,
          code: phoneCode,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Phone verified successfully');
        checkUserStatus(); // Refresh user data
        setPhoneCode('');
        setPhoneSent(false);
      } else {
        Alert.alert('Error', result.detail || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      Alert.alert('Error', 'Failed to verify phone');
    } finally {
      setPhoneLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
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
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Hello, {user.name}!</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* Email Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons 
              name={user.is_email_verified ? "checkmark-circle" : "mail-outline"} 
              size={24} 
              color={user.is_email_verified ? "#34C759" : "#007AFF"} 
            />
            <Text style={styles.sectionTitle}>Email Verification</Text>
            {user.is_email_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {user.is_email_verified ? (
            <View style={styles.verifiedSection}>
              <Text style={styles.verifiedMessage}>Your email is verified</Text>
            </View>
          ) : (
            <View style={styles.verificationSection}>
              <Text style={styles.sectionDescription}>
                Verify your email to secure your account and receive important notifications.
              </Text>
              
              {!emailSent ? (
                <TouchableOpacity
                  style={[styles.actionButton, emailLoading && styles.disabledButton]}
                  onPress={sendEmailVerification}
                  disabled={emailLoading}
                >
                  {emailLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>Send Verification Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.codeInputSection}>
                  <Text style={styles.codeLabel}>Enter 6-digit code sent to your email:</Text>
                  <TextInput
                    style={styles.codeInput}
                    value={emailCode}
                    onChangeText={setEmailCode}
                    placeholder="123456"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={sendEmailVerification}
                      disabled={emailLoading}
                    >
                      <Text style={styles.resendText}>Resend Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.verifyButton, emailLoading && styles.disabledButton]}
                      onPress={verifyEmail}
                      disabled={emailLoading}
                    >
                      {emailLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Phone Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons 
              name={user.is_phone_verified ? "checkmark-circle" : "call-outline"} 
              size={24} 
              color={user.is_phone_verified ? "#34C759" : "#007AFF"} 
            />
            <Text style={styles.sectionTitle}>Phone Verification</Text>
            {user.is_phone_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {user.is_phone_verified ? (
            <View style={styles.verifiedSection}>
              <Text style={styles.verifiedMessage}>Your phone is verified</Text>
              <Text style={styles.phoneNumber}>{user.phone}</Text>
            </View>
          ) : (
            <View style={styles.verificationSection}>
              <Text style={styles.sectionDescription}>
                Verify your phone number for additional security and SMS notifications.
              </Text>
              
              <View style={styles.phoneInputSection}>
                <Text style={styles.inputLabel}>Phone Number:</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+1-555-0123"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              {!phoneSent ? (
                <TouchableOpacity
                  style={[styles.actionButton, phoneLoading && styles.disabledButton]}
                  onPress={sendPhoneVerification}
                  disabled={phoneLoading}
                >
                  {phoneLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="call-outline" size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>Send Verification Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.codeInputSection}>
                  <Text style={styles.codeLabel}>Enter 6-digit code sent to {phoneNumber}:</Text>
                  <TextInput
                    style={styles.codeInput}
                    value={phoneCode}
                    onChangeText={setPhoneCode}
                    placeholder="123456"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={sendPhoneVerification}
                      disabled={phoneLoading}
                    >
                      <Text style={styles.resendText}>Resend Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.verifyButton, phoneLoading && styles.disabledButton]}
                      onPress={verifyPhone}
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Benefits */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Why verify your information?</Text>
          <View style={styles.benefit}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#34C759" />
            <Text style={styles.benefitText}>Enhanced account security</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="notifications-outline" size={20} color="#34C759" />
            <Text style={styles.benefitText}>Receive important notifications</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="business-outline" size={20} color="#34C759" />
            <Text style={styles.benefitText}>Required for business registration</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="star-outline" size={20} color="#34C759" />
            <Text style={styles.benefitText}>Build trust with customers</Text>
          </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
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
  userInfo: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#155724',
    fontWeight: '600',
  },
  verifiedSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  verifiedMessage: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '500',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
  },
  verificationSection: {
    marginTop: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  phoneInputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  phoneInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  codeInputSection: {
    marginTop: 16,
  },
  codeLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  benefitsSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    marginBottom: 20,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
});