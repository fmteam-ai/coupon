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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface RealTimeMetrics {
  activeDeals: number;
  todayRedemptions: number;
  nearbyCustomers: number;
  liveViews: number;
  revenueToday: number;
  averageRating: number;
  lastUpdate: string;
  hourlyRedemptions: number[];
  topPerformingDeal: {
    title: string;
    redemptions: number;
  } | null;
}

interface QuickDeal {
  id?: string;
  title: string;
  description: string;
  discount: number;
  validUntil: string;
  active: boolean;
  maxRedemptions?: number;
  currentRedemptions?: number;
}

interface NotificationSettings {
  enableRealTime: boolean;
  enableDealAlerts: boolean;
  enableCustomerAlerts: boolean;
  alertRadius: number;
}

export default function BusinessMobileDashboard() {
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics>({
    activeDeals: 0,
    todayRedemptions: 0,
    nearbyCustomers: 0,
    liveViews: 0,
    revenueToday: 0,
    averageRating: 0,
    lastUpdate: new Date().toISOString(),
    hourlyRedemptions: Array(24).fill(0),
    topPerformingDeal: null,
  });

  // Quick Deal Modal
  const [quickDealModalVisible, setQuickDealModalVisible] = useState(false);
  const [quickDeal, setQuickDeal] = useState<QuickDeal>({
    title: '',
    description: '',
    discount: 0,
    validUntil: '',
    active: true,
  });
  const [creatingDeal, setCreatingDeal] = useState(false);

  // Notification Settings Modal
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enableRealTime: true,
    enableDealAlerts: true,
    enableCustomerAlerts: true,
    alertRadius: 1000,
  });

  // Real-time updates
  const [realtimeInterval, setRealtimeInterval] = useState<NodeJS.Timeout | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeDashboard();
    
    return () => {
      if (realtimeInterval) {
        clearInterval(realtimeInterval);
      }
    };
  }, []);

  const initializeDashboard = async () => {
    await fetchRealTimeMetrics();
    await loadNotificationSettings();
    startRealtimeUpdates();
    setLoading(false);
  };

  const fetchRealTimeMetrics = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/business/realtime-metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const metrics = await response.json();
        setRealTimeMetrics({
          ...metrics,
          lastUpdate: new Date().toISOString(),
        });
        
        // Animate metrics update
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
    }
  };

  const startRealtimeUpdates = () => {
    const interval = setInterval(() => {
      fetchRealTimeMetrics();
    }, 15000); // Update every 15 seconds for mobile dashboard
    
    setRealtimeInterval(interval);
  };

  const createQuickDeal = async () => {
    if (!quickDeal.title || !quickDeal.description || quickDeal.discount <= 0) {
      Alert.alert('Error', 'Please fill in all fields with valid values');
      return;
    }

    setCreatingDeal(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const dealData = {
        ...quickDeal,
        validUntil: quickDeal.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await fetch(`${EXPO_BACKEND_URL}/api/deals/quick-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dealData),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          '🚀 Deal Live!',
          `"${quickDeal.title}" is now active!\n\n✅ Nearby customers notified\n📍 ${realTimeMetrics.nearbyCustomers} potential customers in range\n⏰ Deal expires in 24 hours`,
          [
            { text: 'Create Another', onPress: resetQuickDeal },
            { text: 'View Analytics', onPress: () => setQuickDealModalVisible(false) },
          ]
        );
        
        await fetchRealTimeMetrics();
        await notifyNearbyCustomers(result.dealId);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create deal');
      }
    } catch (error) {
      console.error('Error creating quick deal:', error);
      Alert.alert('Error', 'Failed to create deal');
    } finally {
      setCreatingDeal(false);
    }
  };

  const notifyNearbyCustomers = async (dealId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/notifications/deal-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dealId, radius: notificationSettings.alertRadius }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Notified ${result.notificationsSent} nearby customers`);
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  const resetQuickDeal = () => {
    setQuickDeal({
      title: '',
      description: '',
      discount: 0,
      validUntil: '',
      active: true,
    });
  };

  const loadNotificationSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('notificationSettings');
      if (saved) {
        setNotificationSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
      setNotificationModalVisible(false);
      Alert.alert('Settings Saved', 'Your notification preferences have been updated');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRealTimeMetrics();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatLastUpdate = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
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
        <View>
          <Text style={styles.headerTitle}>Business Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Updated {formatLastUpdate(realTimeMetrics.lastUpdate)}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setNotificationModalVisible(true)} style={styles.settingsButton}>
          <Ionicons name="notifications" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickCreateButton}
            onPress={() => setQuickDealModalVisible(true)}
          >
            <Ionicons name="flash" size={24} color="#fff" />
            <Text style={styles.quickCreateButtonText}>Create Deal</Text>
          </TouchableOpacity>
        </View>

        {/* Real-Time Metrics Grid */}
        <View style={styles.metricsGrid}>
          <Animated.View style={[styles.metricCard, { opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.7],
          }) }]}>
            <Ionicons name="flash" size={24} color="#FF6B35" />
            <Text style={styles.metricValue}>{realTimeMetrics.activeDeals}</Text>
            <Text style={styles.metricLabel}>Active Deals</Text>
          </Animated.View>

          <Animated.View style={[styles.metricCard, { opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.7],
          }) }]}>
            <Ionicons name="people" size={24} color="#34C759" />
            <Text style={styles.metricValue}>{realTimeMetrics.todayRedemptions}</Text>
            <Text style={styles.metricLabel}>Today's Sales</Text>
          </Animated.View>

          <Animated.View style={[styles.metricCard, { opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.7],
          }) }]}>
            <Ionicons name="location" size={24} color="#007AFF" />
            <Text style={styles.metricValue}>{realTimeMetrics.nearbyCustomers}</Text>
            <Text style={styles.metricLabel}>Nearby Customers</Text>
          </Animated.View>

          <Animated.View style={[styles.metricCard, { opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.7],
          }) }]}>
            <Ionicons name="cash" size={24} color="#FF9500" />
            <Text style={styles.metricValue}>{formatCurrency(realTimeMetrics.revenueToday)}</Text>
            <Text style={styles.metricLabel}>Today's Revenue</Text>
          </Animated.View>
        </View>

        {/* Live Performance */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🔥 Live Performance</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Ionicons name="eye" size={16} color="#666" />
                <Text style={styles.performanceLabel}>Live Views</Text>
                <Text style={styles.performanceValue}>{realTimeMetrics.liveViews}</Text>
              </View>
              <View style={styles.performanceItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.performanceLabel}>Avg Rating</Text>
                <Text style={styles.performanceValue}>{realTimeMetrics.averageRating.toFixed(1)}</Text>
              </View>
            </View>
            
            {realTimeMetrics.topPerformingDeal && (
              <View style={styles.topDealContainer}>
                <Text style={styles.topDealTitle}>🏆 Top Deal Today</Text>
                <Text style={styles.topDealName}>{realTimeMetrics.topPerformingDeal.title}</Text>
                <Text style={styles.topDealRedemptions}>
                  {realTimeMetrics.topPerformingDeal.redemptions} redemptions
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Insights */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>📊 Quick Insights</Text>
          <View style={styles.insightsCard}>
            <View style={styles.insightItem}>
              <Text style={styles.insightText}>
                🚀 Your deals are performing {realTimeMetrics.todayRedemptions > 10 ? 'great' : 'well'} today!
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Text style={styles.insightText}>
                📍 {realTimeMetrics.nearbyCustomers} potential customers are within 1km
              </Text>
            </View>
            {realTimeMetrics.nearbyCustomers > 50 && (
              <View style={styles.insightItem}>
                <Text style={styles.insightText}>
                  💡 High foot traffic detected - perfect time for a flash deal!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Quick Deal Creation Modal */}
      <Modal
        visible={quickDealModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setQuickDealModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>⚡ Quick Deal</Text>
            <TouchableOpacity onPress={createQuickDeal} disabled={creatingDeal}>
              <Text style={[styles.modalSave, creatingDeal && styles.modalSaveDisabled]}>
                {creatingDeal ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Deal Title *</Text>
              <TextInput
                style={styles.input}
                value={quickDeal.title}
                onChangeText={(text) => setQuickDeal(prev => ({ ...prev, title: text }))}
                placeholder="e.g., 50% Off All Pizzas"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={quickDeal.description}
                onChangeText={(text) => setQuickDeal(prev => ({ ...prev, description: text }))}
                placeholder="Brief description of your offer..."
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Discount Percentage *</Text>
              <TextInput
                style={styles.input}
                value={quickDeal.discount.toString()}
                onChangeText={(text) => setQuickDeal(prev => ({ ...prev, discount: parseInt(text) || 0 }))}
                placeholder="25"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Redemptions (optional)</Text>
              <TextInput
                style={styles.input}
                value={quickDeal.maxRedemptions?.toString() || ''}
                onChangeText={(text) => setQuickDeal(prev => ({ ...prev, maxRedemptions: parseInt(text) || undefined }))}
                placeholder="100"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Active Immediately</Text>
                <Switch
                  value={quickDeal.active}
                  onValueChange={(value) => setQuickDeal(prev => ({ ...prev, active: value }))}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                />
              </View>
            </View>

            <View style={styles.dealPreview}>
              <Text style={styles.previewTitle}>Deal Preview</Text>
              <Text style={styles.previewText}>
                🏷️ {quickDeal.discount}% off - {quickDeal.title}
              </Text>
              <Text style={styles.previewDescription}>
                {quickDeal.description}
              </Text>
              <Text style={styles.previewFooter}>
                📍 Will notify {realTimeMetrics.nearbyCustomers} nearby customers
              </Text>
            </View>
          </ScrollView>

          {creatingDeal && (
            <View style={styles.creatingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.creatingText}>Creating deal and notifying customers...</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        visible={notificationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>🔔 Notifications</Text>
            <TouchableOpacity onPress={saveNotificationSettings}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingGroup}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.settingTitle}>Real-time Updates</Text>
                  <Text style={styles.settingDescription}>Get live metrics every 15 seconds</Text>
                </View>
                <Switch
                  value={notificationSettings.enableRealTime}
                  onValueChange={(value) => setNotificationSettings(prev => ({ ...prev, enableRealTime: value }))}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                />
              </View>
            </View>

            <View style={styles.settingGroup}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.settingTitle}>Deal Alerts</Text>
                  <Text style={styles.settingDescription}>Notifications when deals are redeemed</Text>
                </View>
                <Switch
                  value={notificationSettings.enableDealAlerts}
                  onValueChange={(value) => setNotificationSettings(prev => ({ ...prev, enableDealAlerts: value }))}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                />
              </View>
            </View>

            <View style={styles.settingGroup}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.settingTitle}>Customer Alerts</Text>
                  <Text style={styles.settingDescription}>Notify when customers are nearby</Text>
                </View>
                <Switch
                  value={notificationSettings.enableCustomerAlerts}
                  onValueChange={(value) => setNotificationSettings(prev => ({ ...prev, enableCustomerAlerts: value }))}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                />
              </View>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.settingTitle}>Alert Radius</Text>
              <Text style={styles.settingDescription}>Distance to notify customers about new deals</Text>
              <View style={styles.radiusOptions}>
                {[500, 1000, 2000, 5000].map(radius => (
                  <TouchableOpacity
                    key={radius}
                    style={[
                      styles.radiusOption,
                      notificationSettings.alertRadius === radius && styles.radiusOptionSelected
                    ]}
                    onPress={() => setNotificationSettings(prev => ({ ...prev, alertRadius: radius }))}
                  >
                    <Text style={[
                      styles.radiusOptionText,
                      notificationSettings.alertRadius === radius && styles.radiusOptionTextSelected
                    ]}>
                      {radius}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickCreateButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  quickCreateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#fff',
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e1e1',
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
    marginTop: 4,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  performanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  performanceItem: {
    alignItems: 'center',
    gap: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#666',
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  topDealContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  topDealTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  topDealName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  topDealRedemptions: {
    fontSize: 12,
    color: '#007AFF',
  },
  insightsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    gap: 12,
  },
  insightItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalSave: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalSaveDisabled: {
    color: '#ccc',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dealPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginTop: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  previewFooter: {
    fontSize: 12,
    color: '#007AFF',
  },
  creatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  settingGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  radiusOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  radiusOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  radiusOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radiusOptionText: {
    fontSize: 14,
    color: '#333',
  },
  radiusOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
});