import React, { useState } from 'react';
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

export default function BusinessAuthLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Save access token and user info
        await AsyncStorage.setItem('auth_token', result.access_token);
        await AsyncStorage.setItem('user_type', 'business_owner');
        await AsyncStorage.setItem('business_id', result.business_id);
        await AsyncStorage.setItem('business_name', result.business_name);
        
        // Show appropriate message based on approval status
        if (!result.is_approved) {
          Alert.alert(
            'Login Successful',
            'Welcome back! Your business is still pending admin approval. You can manage your profile and prepare your discounts while waiting.',
            [
              {
                text: 'Go to Dashboard',
                onPress: () => router.replace('/business-dashboard')
              }
            ]
          );
        } else {
          Alert.alert(
            'Welcome Back!',
            `Welcome back to ${result.business_name}! Your business dashboard is ready.`,
            [
              {
                text: 'Continue',
                onPress: () => router.replace('/business-dashboard')
              }
            ]
          );
        }
      } else {
        const error = await response.json();
        
        if (response.status === 403) {
          // Business is suspended
          Alert.alert(
            'Account Suspended',
            error.detail,
            [
              {
                text: 'Contact Support',
                onPress: () => {
                  // In a real app, this would open email or support system
                  Alert.alert('Support', 'Please contact support@couponapp.com');
                }
              },
              { text: 'OK', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Login Failed', error.detail || 'Invalid email or password');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Login</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="business" size={48} color="#007AFF" />
            </View>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to your business dashboard to manage discounts, view analytics, and grow your customer base.
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.business@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, (!email || !password || loading) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={!email || !password || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Register Section */}
          <View style={styles.registerSection}>
            <Text style={styles.registerText}>Don't have a business account?</Text>
            <TouchableOpacity
              onPress={() => router.push('/business-auth-register')}
              style={styles.registerButton}
            >
              <Text style={styles.registerButtonText}>Register Your Business</Text>
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark" size={24} color="#34C759" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Secure & Trusted</Text>
                <Text style={styles.infoDescription}>
                  Your business data is protected with enterprise-grade security
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="time" size={24} color="#FF9500" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>90-Day Free Trial</Text>
                <Text style={styles.infoDescription}>
                  New businesses get full access for 90 days at no cost
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="people" size={24} color="#007AFF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Grow Your Customer Base</Text>
                <Text style={styles.infoDescription}>
                  Reach thousands of local customers looking for deals
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.footerSeparator}>•</Text>
          <TouchableOpacity onPress={() => router.push('/business-terms')}>
            <Text style={styles.footerLink}>Business Terms</Text>
          </TouchableOpacity>
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
  keyboardView: {
    flex: 1,
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
    paddingHorizontal: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  formSection: {
    marginBottom: 32,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 12,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  registerButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  registerButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerLink: {
    fontSize: 12,
    color: '#007AFF',
  },
  footerSeparator: {
    fontSize: 12,
    color: '#999',
  },
});