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

        {/* Action Buttons */}
        {user && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/qr-scanner')}
            >
              <Ionicons name="qr-code-outline" size={24} color="#007AFF" />
              <Text style={styles.actionButtonText}>Scan QR Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/business-register')}
            >
              <Ionicons name="business-outline" size={24} color="#007AFF" />
              <Text style={styles.actionButtonText}>Register Business</Text>
            </TouchableOpacity>
          </View>
        )}
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
});