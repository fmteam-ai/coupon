import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Platform,
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
  stripe_subscription_id?: string;
}

interface UsageAnalytics {
  business_name: string;
  current_plan: SubscriptionPlan;
  monthly_cost: number;
  analytics_period: string;
  metrics: {
    total_discounts: number;
    active_discounts: number;
    recent_customer_engagement: number;
    estimated_customer_value: number;
    estimated_roi: number;
    business_rating: number;
    total_reviews: number;
  };
  recommendations: string[];
}

export default function BusinessDashboardPage() {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
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

      const [subscriptionResponse, analyticsResponse, plansResponse] = await Promise.all([
        fetch(`${EXPO_BACKEND_URL}/api/business/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${EXPO_BACKEND_URL}/api/business/usage-analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${EXPO_BACKEND_URL}/api/subscription-plans`)
      ]);

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        setSubscriptionStatus(subscriptionData);
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setUsageAnalytics(analyticsData);
      }

      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setAvailablePlans(plansData);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
            setUpgradeModalVisible(false);
            fetchData(); // Refresh data
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trial': return '#FF9500';
      case 'active': return '#34C759';
      case 'inactive': return '#FF3B30';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'trial': return 'Free Trial';
      case 'active': return 'Active Subscription';
      case 'inactive': return 'Subscription Expired';
      case 'no_subscription': return 'No Subscription';
      default: return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
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
        <Text style={styles.headerTitle}>Business Dashboard</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Business Name */}
        {usageAnalytics && (
          <View style={styles.businessHeader}>
            <Text style={styles.businessName}>{usageAnalytics.business_name}</Text>
          </View>
        )}

        {/* Subscription Status */}
        {subscriptionStatus && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Subscription Status</Text>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(subscriptionStatus.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(subscriptionStatus.status) }]}>
                    {getStatusText(subscriptionStatus.status)}
                  </Text>
                </View>
              </View>
              {subscriptionStatus.status !== 'active' && (
                <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradeSubscription}>
                  <Text style={styles.upgradeButtonText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>

            {subscriptionStatus.trial_active && (
              <View style={styles.trialInfo}>
                <Ionicons name="time-outline" size={16} color="#FF9500" />
                <Text style={styles.trialText}>
                  {subscriptionStatus.days_remaining} days remaining in free trial
                </Text>
              </View>
            )}

            {subscriptionStatus.current_period_end && (
              <Text style={styles.periodText}>
                Next billing: {formatDate(subscriptionStatus.current_period_end)}
              </Text>
            )}
          </View>
        )}

        {/* Analytics Overview */}
        {usageAnalytics && (
          <View style={styles.analyticsSection}>
            <Text style={styles.sectionTitle}>Overview</Text>
            
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Ionicons name="ticket-outline" size={24} color="#007AFF" />
                <Text style={styles.metricValue}>{usageAnalytics.metrics.total_discounts}</Text>
                <Text style={styles.metricLabel}>Total Coupons</Text>
              </View>
              
              <View style={styles.metricCard}>
                <Ionicons name="checkmark-circle-outline" size={24} color="#34C759" />
                <Text style={styles.metricValue}>{usageAnalytics.metrics.active_discounts}</Text>
                <Text style={styles.metricLabel}>Active Coupons</Text>
              </View>
              
              <View style={styles.metricCard}>
                <Ionicons name="people-outline" size={24} color="#FF9500" />
                <Text style={styles.metricValue}>{usageAnalytics.metrics.recent_customer_engagement}</Text>
                <Text style={styles.metricLabel}>Customer Engagement</Text>
              </View>
            </View>
          </View>
        )}

        {/* AI Recommendations */}
        {usageAnalytics && usageAnalytics.recommendations.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>AI Recommendations</Text>
            
            {usageAnalytics.recommendations.map((recommendation, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="bulb-outline" size={20} color="#007AFF" />
                </View>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTitle}>Recommendation {index + 1}</Text>
                  <Text style={styles.activityUser}>{recommendation}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/create-discount')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
            <Text style={styles.actionTitle}>Create New Coupon</Text>
            <Text style={styles.actionDescription}>Add a new discount offer for customers</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/manage-discounts')}
          >
            <Ionicons name="list-outline" size={24} color="#34C759" />
            <Text style={styles.actionTitle}>Manage Coupons</Text>
            <Text style={styles.actionDescription}>View and edit your existing offers</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/business-analytics')}
          >
            <Ionicons name="analytics-outline" size={24} color="#FF9500" />
            <Text style={styles.actionTitle}>Detailed Analytics</Text>
            <Text style={styles.actionDescription}>View comprehensive business insights</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/verification')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#FF3B30" />
            <Text style={styles.actionTitle}>Verify Business</Text>
            <Text style={styles.actionDescription}>Complete phone and email verification</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/business-subscription')}
          >
            <Ionicons name="card-outline" size={24} color="#007AFF" />
            <Text style={styles.actionTitle}>Subscription Management</Text>
            <Text style={styles.actionDescription}>Upgrade plan and manage billing</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>
          <TouchableOpacity 
            style={styles.dangerCard}
            onPress={() => router.push('/business-delete')}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <View style={styles.dangerContent}>
              <Text style={styles.dangerActionTitle}>Delete Business Profile</Text>
              <Text style={styles.dangerActionDescription}>
                Permanently delete your business. You'll lose trial eligibility if you register again.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
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
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  businessHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  trialText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
  },
  periodText: {
    fontSize: 14,
    color: '#666',
  },
  analyticsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  activitySection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  activityUser: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  verifiedText: {
    color: '#155724',
  },
  pendingText: {
    color: '#856404',
  },
  actionsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 16,
    flex: 2,
  },
  dangerSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 16,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerContent: {
    flex: 1,
    marginLeft: 16,
  },
  dangerActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  dangerActionDescription: {
    fontSize: 14,
    color: '#dc2626',
    marginTop: 2,
    lineHeight: 18,
  },
});