import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  TextInput,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useGlobalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  review_count: number;
  logo?: string;
}

interface Discount {
  discount: {
    id: string;
    title: string;
    description: string;
    discount_type: string;
    discount_value: number;
    expires_at: string;
  };
  business: Business;
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const { session_id } = useGlobalSearchParams();

  const categories_list = [
    'All', 'Restaurant', 'Retail', 'Health & Beauty', 'Services', 
    'Entertainment', 'Travel', 'Technology', 'Fitness', 'Education'
  ];

  useEffect(() => {
    if (session_id) {
      handleSessionAuth(session_id as string);
    } else {
      checkAuthStatus();
    }
  }, [session_id]);

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedCategory]);

  const handleSessionAuth = async (sessionId: string) => {
    try {
      const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        await AsyncStorage.setItem('session_token', data.session_token);
        // Clean up URL
        router.replace('/');
      }
    } catch (error) {
      console.error('Session auth error:', error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        const response = await fetch(`${EXPO_BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load businesses
      const businessQuery = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        businessQuery.append('category', selectedCategory);
      }
      if (searchQuery) {
        businessQuery.append('search', searchQuery);
      }

      const businessResponse = await fetch(
        `${EXPO_BACKEND_URL}/api/businesses?${businessQuery.toString()}`
      );
      const businessData = await businessResponse.json();
      setBusinesses(businessData);

      // Load discounts
      const discountQuery = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        discountQuery.append('category', selectedCategory);
      }

      const discountResponse = await fetch(
        `${EXPO_BACKEND_URL}/api/discounts?${discountQuery.toString()}`
      );
      const discountData = await discountResponse.json();
      setDiscounts(discountData);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    const redirectUrl = encodeURIComponent(window.location.origin + '/profile');
    const authUrl = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
    window.open(authUrl, '_self');
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      await fetch(`${EXPO_BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      await AsyncStorage.removeItem('session_token');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleViewModeToggle = () => {
    if (viewMode === 'list') {
      router.push('/map');
    } else {
      setViewMode('list');
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Ionicons key={i} name="star" size={16} color="#FFD700" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Ionicons key="half" name="star-half" size={16} color="#FFD700" />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Ionicons key={`empty-${i}`} name="star-outline" size={16} color="#FFD700" />);
    }

    return stars;
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>CouponApp</Text>
          {user ? (
            <View style={styles.userSection}>
              <Text style={styles.userName}>Hi, {user.name}!</Text>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={handleLogin} style={styles.loginButton}>
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar with Map Toggle */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search businesses or offers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={handleViewModeToggle} style={styles.mapToggleButton}>
            <Ionicons 
              name="map-outline"
              size={20} 
              color="#007AFF" 
            />
            <Text style={styles.mapToggleText}>Map</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.categoryContainer}
        >
          {categories_list.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(category === 'All' ? '' : category)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Featured Discounts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Hot Deals</Text>
            <TouchableOpacity onPress={() => router.push('/map')} style={styles.viewOnMapButton}>
              <Ionicons name="map-outline" size={16} color="#007AFF" />
              <Text style={styles.viewOnMapText}>View on Map</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {discounts.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.discount.id}
                style={styles.discountCard}
                onPress={() => router.push({
                  pathname: '/business/[id]',
                  params: { id: item.business.id }
                })}
              >
                <View style={styles.discountHeader}>
                  <Text style={styles.discountValue}>
                    {item.discount.discount_type === 'percentage' 
                      ? `${item.discount.discount_value}% OFF`
                      : `$${item.discount.discount_value} OFF`
                    }
                  </Text>
                  <View style={styles.businessInfo}>
                    <Text style={styles.businessName}>{item.business.name}</Text>
                    <View style={styles.ratingContainer}>
                      {renderStars(item.business.rating)}
                      <Text style={styles.ratingText}>({item.business.review_count})</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.discountTitle}>{item.discount.title}</Text>
                <Text style={styles.discountDescription} numberOfLines={2}>
                  {item.discount.description}
                </Text>
                <Text style={styles.expiryText}>
                  Expires: {new Date(item.discount.expires_at).toLocaleDateString()}
                </Text>
                
                {/* Social Actions */}
                <View style={styles.socialActions}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleShareDeal(item.discount.id, item.business.name, item.discount.title)}
                  >
                    <Ionicons name="share-outline" size={16} color="#007AFF" />
                    <Text style={styles.socialButtonText}>Share</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleViewSocialProof(item.discount.id)}
                  >
                    <Ionicons name="people-outline" size={16} color="#34C759" />
                    <Text style={styles.socialButtonText}>Who Used</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Businesses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏪 Businesses</Text>
            <TouchableOpacity onPress={() => router.push('/map')} style={styles.viewOnMapButton}>
              <Ionicons name="location-outline" size={16} color="#007AFF" />
              <Text style={styles.viewOnMapText}>Find Near Me</Text>
            </TouchableOpacity>
          </View>
          {businesses.map((business) => (
            <TouchableOpacity
              key={business.id}
              style={styles.businessCard}
              onPress={() => router.push({
                pathname: '/business/[id]',
                params: { id: business.id }
              })}
            >
              <View style={styles.businessContent}>
                <View style={styles.businessLeft}>
                  {business.logo && (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${business.logo}` }}
                      style={styles.businessLogo}
                    />
                  )}
                  <View style={styles.businessDetails}>
                    <Text style={styles.businessName}>{business.name}</Text>
                    <Text style={styles.businessCategory}>{business.category}</Text>
                    <Text style={styles.businessDescription} numberOfLines={2}>
                      {business.description}
                    </Text>
                    <View style={styles.ratingContainer}>
                      {renderStars(business.rating)}
                      <Text style={styles.ratingText}>
                        {business.rating.toFixed(1)} ({business.review_count} reviews)
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* NEW FEATURES - Top Priority Access */}
        {user && (
          <View style={styles.newFeaturesSection}>
            <Text style={styles.newFeaturesTitle}>🚀 New Features</Text>
            <View style={styles.featuresGrid}>
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => router.push('/ai-recommendations')}
              >
                <View style={styles.featureIconContainer}>
                  <Ionicons name="sparkles" size={28} color="#007AFF" />
                </View>
                <Text style={styles.featureTitle}>AI Picks</Text>
                <Text style={styles.featureDescription}>Personalized deals just for you</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => router.push('/rewards')}
              >
                <View style={styles.featureIconContainer}>
                  <Ionicons name="trophy" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.featureTitle}>Rewards</Text>
                <Text style={styles.featureDescription}>Earn points & badges</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.featuresGrid}>
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => router.push('/cashback-wallet')}
              >
                <View style={styles.featureIconContainer}>
                  <Ionicons name="wallet" size={28} color="#34C759" />
                </View>
                <Text style={styles.featureTitle}>Cashback</Text>
                <Text style={styles.featureDescription}>Real money back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => router.push('/qr-scanner')}
              >
                <View style={styles.featureIconContainer}>
                  <Ionicons name="qr-code" size={28} color="#5856D6" />
                </View>
                <Text style={styles.featureTitle}>QR Scanner</Text>
                <Text style={styles.featureDescription}>Scan to redeem</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {user && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/business-register')}
            >
              <Ionicons name="business-outline" size={24} color="#007AFF" />
              <Text style={styles.actionButtonText}>Register Business</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Business Owner Section */}
        <View style={styles.businessSection}>
          <Text style={styles.businessTitle}>🏢 For Business Owners</Text>
          <Text style={styles.businessSubtitle}>
            Join thousands of businesses growing their customer base
          </Text>
          
          <View style={styles.businessActions}>
            <TouchableOpacity
              style={styles.businessButton}
              onPress={() => router.push('/business-auth-register')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.businessButtonText}>Register Your Business</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.businessSecondaryButton}
              onPress={() => router.push('/business-auth-login')}
            >
              <Ionicons name="log-in-outline" size={20} color="#007AFF" />
              <Text style={styles.businessSecondaryButtonText}>Business Login</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.businessFeatures}>
            <View style={styles.businessFeature}>
              <Ionicons name="time-outline" size={16} color="#34C759" />
              <Text style={styles.businessFeatureText}>90-day free trial</Text>
            </View>
            <View style={styles.businessFeature}>
              <Ionicons name="people-outline" size={16} color="#34C759" />
              <Text style={styles.businessFeatureText}>Reach more customers</Text>
            </View>
            <View style={styles.businessFeature}>
              <Ionicons name="analytics-outline" size={16} color="#34C759" />
              <Text style={styles.businessFeatureText}>Advanced analytics</Text>
            </View>
          </View>
        </View>

        {/* Footer Links */}
        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Legal & Support</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => router.push('/privacy-policy')}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#666" />
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => router.push('/terms-of-use')}
            >
              <Ionicons name="document-text-outline" size={16} color="#666" />
              <Text style={styles.footerLinkText}>Terms of Use</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => router.push('/business-terms')}
            >
              <Ionicons name="briefcase-outline" size={16} color="#666" />
              <Text style={styles.footerLinkText}>Business Terms</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.footerCopyright}>
            © 2025 CouponApp. All rights reserved.
          </Text>
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
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loginText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  mapToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  mapToggleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewOnMapText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  discountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginLeft: 20,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  discountHeader: {
    marginBottom: 12,
  },
  discountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  businessInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  discountTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  discountDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  expiryText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  businessCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  businessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  businessLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessCategory: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  businessDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
  newFeaturesSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  newFeaturesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  footerSection: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginTop: 16,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  footerCopyright: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  businessSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  businessTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  businessSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  businessActions: {
    gap: 12,
    marginBottom: 20,
  },
  businessButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  businessButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  businessSecondaryButton: {
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  businessSecondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  businessFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  businessFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  businessFeatureText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
});