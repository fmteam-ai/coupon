import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const LOCATION_TASK_NAME = 'background-location-task';
const GEOFENCE_TASK_NAME = 'geofence-task';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface DealNotification {
  dealId: string;
  businessId: string;
  businessName: string;
  dealTitle: string;
  discount: string;
  distance: number;
  expiresAt: string;
  category: string;
}

interface NotificationPreferences {
  enableLocation: boolean;
  enableDeals: boolean;
  enableNearby: boolean;
  enablePersonalized: boolean;
  radius: number; // in meters
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
}

class NotificationService {
  private static instance: NotificationService;
  private notificationListener: any;
  private responseListener: any;
  private currentLocation: Location.LocationObject | null = null;
  private preferences: NotificationPreferences | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    try {
      // Register for push notifications
      await this.registerForPushNotificationsAsync();
      
      // Load user preferences
      await this.loadPreferences();
      
      // Start location tracking if enabled
      if (this.preferences?.enableLocation) {
        await this.startLocationTracking();
      }

      // Set up notification listeners
      this.setupNotificationListeners();

      console.log('✅ Notification service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
    }
  }

  private async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('deals', {
        name: 'Deal Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
      });

      await Notifications.setNotificationChannelAsync('nearby', {
        name: 'Nearby Deals',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lightColor: '#34C759',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push token for push notification!');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ Push notification token:', token);
      
      // Store token for backend
      await AsyncStorage.setItem('pushToken', token);
      await this.sendPushTokenToBackend(token);
    } catch (error) {
      console.error('❌ Failed to get push token:', error);
    }

    return token;
  }

  private async sendPushTokenToBackend(token: string) {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/users/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ pushToken: token }),
      });

      if (response.ok) {
        console.log('✅ Push token sent to backend');
      }
    } catch (error) {
      console.error('❌ Failed to send push token to backend:', error);
    }
  }

  private setupNotificationListeners() {
    // Listen for notifications received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Handle notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 Notification tapped:', response);
      this.handleNotificationTapped(response);
    });
  }

  private handleNotificationReceived(notification: Notifications.Notification) {
    // Track notification metrics
    this.trackNotificationMetrics('received', notification.request.content.data);
  }

  private handleNotificationTapped(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    
    // Track notification metrics
    this.trackNotificationMetrics('tapped', data);

    // Navigate to relevant screen based on notification type
    if (data.type === 'deal' && data.dealId) {
      // Navigate to deal details
      console.log(`Navigate to deal: ${data.dealId}`);
    } else if (data.type === 'business' && data.businessId) {
      // Navigate to business details
      console.log(`Navigate to business: ${data.businessId}`);
    }
  }

  async sendDealAlert(deal: DealNotification) {
    if (!this.preferences?.enableDeals) return;
    
    // Check quiet hours
    if (this.isQuietHours()) return;

    // Check if user is nearby
    if (deal.distance > (this.preferences?.radius || 1000)) return;

    const content = {
      title: `🎉 ${deal.discount} at ${deal.businessName}`,
      body: `${deal.dealTitle} • ${Math.round(deal.distance)}m away • Expires ${this.formatExpiryTime(deal.expiresAt)}`,
      data: {
        type: 'deal',
        dealId: deal.dealId,
        businessId: deal.businessId,
        distance: deal.distance,
      },
      categoryIdentifier: 'deals',
      sound: 'default',
    };

    try {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null, // Send immediately
      });

      console.log('✅ Deal alert sent:', deal.businessName);
    } catch (error) {
      console.error('❌ Failed to send deal alert:', error);
    }
  }

  async sendNearbyAlert(businessName: string, distance: number, dealsCount: number) {
    if (!this.preferences?.enableNearby) return;
    if (this.isQuietHours()) return;

    const content = {
      title: `📍 You're near ${businessName}`,
      body: `${dealsCount} active deal${dealsCount > 1 ? 's' : ''} available • ${Math.round(distance)}m away`,
      data: {
        type: 'nearby',
        businessName,
        distance,
        dealsCount,
      },
      categoryIdentifier: 'nearby',
      sound: 'default',
    };

    try {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });

      console.log('✅ Nearby alert sent:', businessName);
    } catch (error) {
      console.error('❌ Failed to send nearby alert:', error);
    }
  }

  async sendPersonalizedRecommendation(recommendation: {
    title: string;
    body: string;
    dealId: string;
    businessId: string;
  }) {
    if (!this.preferences?.enablePersonalized) return;
    if (this.isQuietHours()) return;

    const content = {
      title: `🎯 ${recommendation.title}`,
      body: recommendation.body,
      data: {
        type: 'recommendation',
        dealId: recommendation.dealId,
        businessId: recommendation.businessId,
      },
      categoryIdentifier: 'deals',
      sound: 'default',
    };

    try {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });

      console.log('✅ Personalized recommendation sent');
    } catch (error) {
      console.error('❌ Failed to send personalized recommendation:', error);
    }
  }

  private async startLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      this.currentLocation = location;

      // Start background location updates
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 100, // 100 meters
        });
      }

      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('❌ Failed to start location tracking:', error);
    }
  }

  async updatePreferences(newPreferences: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...newPreferences } as NotificationPreferences;
    await AsyncStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
    
    // Restart location tracking if location preference changed
    if (newPreferences.enableLocation !== undefined) {
      if (newPreferences.enableLocation) {
        await this.startLocationTracking();
      } else {
        await this.stopLocationTracking();
      }
    }
  }

  private async loadPreferences() {
    try {
      const saved = await AsyncStorage.getItem('notificationPreferences');
      if (saved) {
        this.preferences = JSON.parse(saved);
      } else {
        // Default preferences
        this.preferences = {
          enableLocation: true,
          enableDeals: true,
          enableNearby: true,
          enablePersonalized: true,
          radius: 1000, // 1km
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
          },
        };
        await AsyncStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
      }
    } catch (error) {
      console.error('❌ Failed to load notification preferences:', error);
    }
  }

  private async stopLocationTracking() {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('✅ Location tracking stopped');
    } catch (error) {
      console.error('❌ Failed to stop location tracking:', error);
    }
  }

  private isQuietHours(): boolean {
    if (!this.preferences?.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { start, end } = this.preferences.quietHours;
    
    if (start < end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }

  private formatExpiryTime(expiresAt: string): string {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `in ${diffMins}m`;
    } else if (diffHours < 24) {
      return `in ${diffHours}h`;
    } else {
      return expiry.toLocaleDateString();
    }
  }

  private async trackNotificationMetrics(action: 'received' | 'tapped', data: any) {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) return;

      await fetch(`${EXPO_BACKEND_URL}/api/notifications/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action,
          type: data.type,
          dealId: data.dealId,
          businessId: data.businessId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('❌ Failed to track notification metrics:', error);
    }
  }

  getPreferences(): NotificationPreferences | null {
    return this.preferences;
  }

  getCurrentLocation(): Location.LocationObject | null {
    return this.currentLocation;
  }

  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

// Background task for location updates
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('❌ Location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    console.log('📍 Background location update:', locations);
    
    // Check for nearby deals when location changes
    // This would typically trigger a call to check for nearby businesses/deals
  }
});

export default NotificationService;
export type { DealNotification, NotificationPreferences };