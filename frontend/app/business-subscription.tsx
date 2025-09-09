import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  max_coupons: number;
  ai_recommendations: boolean;
  geofencing: boolean;
  advanced_analytics: boolean;
}

interface SubscriptionStatus {
  subscription_id: string;
  business_id: string;
  business_name: string;
  plan: SubscriptionPlan;
  status: string;
  trial_active?: boolean;
  trial_end?: string;
  days_remaining?: number;
  trial_expired?: boolean;
  current_period_end?: string;
  days_until_renewal?: number;
}

export default function BusinessSubscriptionPage() {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [subscriptionResponse, plansResponse] = await Promise.all([
        fetch(`${EXPO_BACKEND_URL}/api/business/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${EXPO_BACKEND_URL}/api/subscription-plans`)
      ]);

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        setSubscriptionStatus(subscriptionData);
      }

      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setAvailablePlans(plansData.filter((plan: SubscriptionPlan) => plan.price > 0));
      }

    } catch (error) {
      console.error('Error fetching subscription data:', error);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeSubscription = async (planId: string) => {
    if (!planId) return;
    
    setUpgrading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: planId })
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          'Success!', 
          `Successfully upgraded to ${result.plan.name}! Your new subscription is active immediately.`,
          [{ text: 'OK', onPress: () => {
            fetchData(); // Refresh data
            router.back();
          }}]
        );
      } else {
        const error = await response.json();
        Alert.alert('Upgrade Failed', error.detail || 'Failed to upgrade subscription');
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      Alert.alert('Error', 'Failed to upgrade subscription');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${EXPO_BACKEND_URL}/api/business/subscription/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
              });

              if (response.ok) {
                const result = await response.json();
                Alert.alert('Subscription Cancelled', result.message);
                fetchData(); // Refresh data
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'Failed to cancel subscription');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel subscription');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading subscription...</Text>
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
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Subscription Status */}
        {subscriptionStatus && (
          <View style={styles.currentPlanSection}>
            <Text style={styles.sectionTitle}>Current Plan</Text>
            
            <View style={styles.currentPlanCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{subscriptionStatus.plan?.name || 'Free Plan'}</Text>
                <Text style={styles.planPrice}>
                  ${subscriptionStatus.plan?.price || 0}/month
                </Text>
              </View>
              
              <Text style={styles.planDescription}>
                {subscriptionStatus.plan?.description || 'Basic business listing with limited features'}
              </Text>
              
              {/* Trial Status */}
              {subscriptionStatus.trial_active && (
                <View style={styles.trialBadge}>
                  <Ionicons name="time-outline" size={16} color="#FF9500" />
                  <Text style={styles.trialText}>
                    Trial: {subscriptionStatus.days_remaining} days remaining
                  </Text>
                </View>
              )}
              
              {/* Active Subscription Status */}
              {subscriptionStatus.status === 'active' && !subscriptionStatus.trial_active && (
                <View style={styles.activeBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.activeText}>
                    Active until {formatDate(subscriptionStatus.current_period_end || '')}
                  </Text>
                </View>
              )}
              
              {/* Features List */}
              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>Current Features:</Text>
                {subscriptionStatus.plan?.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons name="checkmark" size={16} color="#34C759" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Available Plans for Upgrade */}
        {availablePlans.length > 0 && (
          <View style={styles.upgradeSection}>
            <Text style={styles.sectionTitle}>Upgrade Your Plan</Text>
            <Text style={styles.sectionSubtitle}>
              Unlock advanced features to grow your business
            </Text>
            
            {availablePlans.map((plan) => {
              const isCurrentPlan = plan.id === subscriptionStatus?.plan?.id;
              
              return (
                <View key={plan.id} style={[
                  styles.planCard,
                  isCurrentPlan && styles.currentPlanCardHighlight
                ]}>
                  <View style={styles.planCardHeader}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planCardName}>{plan.name}</Text>
                      <Text style={styles.planCardPrice}>${plan.price}/month</Text>
                    </View>
                    
                    {plan.id === 'professional' && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>MOST POPULAR</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.planCardDescription}>{plan.description}</Text>
                  
                  {/* Features */}
                  <View style={styles.planFeatures}>
                    {plan.features.slice(0, 4).map((feature, index) => (
                      <View key={index} style={styles.planFeatureItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#007AFF" />
                        <Text style={styles.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                    {plan.features.length > 4 && (
                      <Text style={styles.moreFeatures}>
                        +{plan.features.length - 4} more features
                      </Text>
                    )}
                  </View>
                  
                  {/* Action Button */}
                  {!isCurrentPlan ? (
                    <TouchableOpacity
                      style={[
                        styles.upgradeButton,
                        plan.id === 'professional' && styles.professionalButton
                      ]}
                      onPress={() => handleUpgradeSubscription(plan.id)}
                      disabled={upgrading}
                    >
                      {upgrading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.upgradeButtonText}>
                            Upgrade to {plan.name}
                          </Text>
                          <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.currentPlanButton}>
                      <Text style={styles.currentPlanButtonText}>Current Plan</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Cancel Subscription */}
        {subscriptionStatus?.status === 'active' && !subscriptionStatus.trial_active && (
          <View style={styles.cancelSection}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelSubscription}
            >
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
            <Text style={styles.cancelNote}>
              You'll continue to have access until the end of your current billing period
            </Text>
          </View>
        )}

        {/* ROI Information */}
        <View style={styles.roiSection}>
          <Text style={styles.roiTitle}>💰 Return on Investment</Text>
          <Text style={styles.roiDescription}>
            Professional businesses typically see 3-5x ROI through increased customer discovery and advanced targeting features.
          </Text>
          
          <View style={styles.roiStats}>
            <View style={styles.roiStat}>
              <Text style={styles.roiNumber}>300%</Text>
              <Text style={styles.roiLabel}>Average ROI</Text>
            </View>
            <View style={styles.roiStat}>
              <Text style={styles.roiNumber}>5x</Text>
              <Text style={styles.roiLabel}>More Customers</Text>
            </View>
            <View style={styles.roiStat}>
              <Text style={styles.roiNumber}>24/7</Text>
              <Text style={styles.roiLabel}>Support</Text>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  currentPlanSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  currentPlanCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  trialText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  activeText: {
    fontSize: 12,
    color: '#155724',
    marginLeft: 4,
    fontWeight: '500',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  upgradeSection: {
    padding: 20,
    paddingTop: 0,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentPlanCardHighlight: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planInfo: {
    flex: 1,
  },
  planCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  planCardPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  planCardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  planFeatures: {
    marginBottom: 20,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  planFeatureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  moreFeatures: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  professionalButton: {
    backgroundColor: '#FF6B35',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  currentPlanButton: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  currentPlanButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelSection: {
    padding: 20,
    paddingTop: 0,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  cancelNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  roiSection: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  roiDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  roiStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  roiStat: {
    alignItems: 'center',
  },
  roiNumber: {
    fontSize: 24,
    fontWeight: '600',
    color: '#007AFF',
  },
  roiLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});