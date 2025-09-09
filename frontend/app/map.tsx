import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width, height } = Dimensions.get('window');

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  review_count: number;
  logo?: string;
  latitude?: number;
  longitude?: number;
  address: string;
  city: string;
  country: string;
  phone: string;
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

interface UserLocation {
  latitude: number;
  longitude: number;
}

export default function MapPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [distanceFilter, setDistanceFilter] = useState<number>(10); // km
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  const categories = [
    'All', 'Restaurant', 'Retail', 'Health & Beauty', 'Services', 
    'Entertainment', 'Travel', 'Technology', 'Fitness', 'Education'
  ];

  const distanceOptions = [1, 2, 5, 10, 20, 50];

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (userLocation) {
      loadMapData();
    }
  }, [userLocation, searchQuery, selectedCategory, distanceFilter]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } else {
        // Default to New York if no permission
        setUserLocation({
          latitude: 40.7128,
          longitude: -74.0060,
        });
      }
    } catch (error) {
      console.error('Location permission error:', error);
      // Default location
      setUserLocation({
        latitude: 40.7128,
        longitude: -74.0060,
      });
      setLocationPermission(false);
    }
  };

  const loadMapData = async () => {
    try {
      setLoading(true);
      
      // Load businesses with location filtering
      const businessQuery = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        businessQuery.append('category', selectedCategory);
      }
      if (searchQuery) {
        businessQuery.append('search', searchQuery);
      }
      if (userLocation) {
        businessQuery.append('latitude', userLocation.latitude.toString());
        businessQuery.append('longitude', userLocation.longitude.toString());
        businessQuery.append('radius_km', distanceFilter.toString());
      }

      const businessResponse = await fetch(
        `${EXPO_BACKEND_URL}/api/businesses?${businessQuery.toString()}`
      );
      const businessData = await businessResponse.json();

      // Add mock coordinates for demo (in production, these would be stored in database)
      const businessesWithLocation = businessData.map((business: Business, index: number) => ({
        ...business,
        latitude: userLocation!.latitude + (Math.random() - 0.5) * 0.1,
        longitude: userLocation!.longitude + (Math.random() - 0.5) * 0.1,
        distance_km: Math.random() * distanceFilter, // Mock distance
      }));

      setBusinesses(businessesWithLocation);

      // Load discounts with location filtering
      const discountQuery = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        discountQuery.append('category', selectedCategory);
      }
      if (userLocation) {
        discountQuery.append('latitude', userLocation.latitude.toString());
        discountQuery.append('longitude', userLocation.longitude.toString());
        discountQuery.append('radius_km', distanceFilter.toString());
      }

      const discountResponse = await fetch(
        `${EXPO_BACKEND_URL}/api/discounts?${discountQuery.toString()}`
      );
      const discountData = await discountResponse.json();

      // Filter discounts by distance
      const filteredDiscounts = discountData.filter((item: Discount) => {
        if (!userLocation) return true;
        // Add mock coordinates for discount businesses too
        const businessWithLocation = {
          ...item.business,
          latitude: userLocation.latitude + (Math.random() - 0.5) * 0.1,
          longitude: userLocation.longitude + (Math.random() - 0.5) * 0.1,
        };
        const distance = getDistance(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: businessWithLocation.latitude, longitude: businessWithLocation.longitude }
        ) / 1000;
        return distance <= distanceFilter;
      });

      setDiscounts(filteredDiscounts);

    } catch (error) {
      console.error('Error loading map data:', error);
      Alert.alert('Error', 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (category: string, hasDiscount: boolean = false) => {
    if (hasDiscount) return '#FF3B30'; // Red for discounts
    
    const categoryColors: { [key: string]: string } = {
      'Restaurant': '#FF9500',
      'Retail': '#007AFF',
      'Health & Beauty': '#FF2D92',
      'Services': '#34C759',
      'Entertainment': '#5856D6',
      'Travel': '#00C7BE',
      'Technology': '#8E8E93',
      'Fitness': '#FF6B35',
      'Education': '#5AC8FA',
      'Other': '#8E8E93'
    };
    
    return categoryColors[category] || '#8E8E93';
  };

  const handleBusinessPress = (business: Business) => {
    setSelectedBusiness(business);
  };

  const closeBusinessCard = () => {
    setSelectedBusiness(null);
  };

  const navigateToBusiness = (businessId: string) => {
    setSelectedBusiness(null);
    router.push({
      pathname: '/business/[id]',
      params: { id: businessId }
    });
  };

  const getBusinessDistance = (business: Business) => {
    if (business.distance_km !== undefined) {
      return business.distance_km < 1 ? `${(business.distance_km * 1000).toFixed(0)}m` : `${business.distance_km.toFixed(1)}km`;
    }
    return null;
  };

  const handleShareDeal = async (discountId: string, businessName: string, dealTitle: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert('Login Required', 'Please login to share deals with friends');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/social/share-deal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          discount_id: discountId,
          share_type: 'link',
          share_platform: 'mobile_app'
        })
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          'Deal Shared! 🎉',
          `You earned ${result.points_earned} points! Share this deal with friends to earn bonus points when they use it.`,
          [
            { text: 'Copy Link', onPress: () => Alert.alert('Share Link', result.share_link) },
            { text: 'Done' }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share deal');
    }
  };

  const handleViewSocialProof = async (discountId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert('Login Required', 'Please login to see social activity');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/social/deal-popularity/${discountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const popularity = await response.json();
        const friendsUsed = popularity.friends_who_used;
        const recentUsage = popularity.recent_usage_count;
        
        let message = `${recentUsage} people used this deal recently`;
        if (friendsUsed.length > 0) {
          const friendNames = friendsUsed.slice(0, 3).map((f: any) => f.name).join(', ');
          message += `\n\nYour friends who used this:\n${friendNames}`;
          if (friendsUsed.length > 3) {
            message += ` and ${friendsUsed.length - 3} others`;
          }
        }

        Alert.alert('Social Proof 👥', message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load social proof');
    }
  };

  if (locationPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Requesting location permission...</Text>
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
        <Text style={styles.headerTitle}>Map View</Text>
        <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterButton}>
          <Ionicons name="options-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search businesses near you..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.locationButton}>
          <Ionicons name="locate-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Distance Indicator */}
      <View style={styles.distanceIndicator}>
        <Ionicons name="location-outline" size={16} color="#666" />
        <Text style={styles.distanceText}>
          Showing businesses within {distanceFilter}km
        </Text>
      </View>

      {/* Map Placeholder / Business List */}
      <ScrollView style={styles.mapContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading businesses...</Text>
          </View>
        ) : (
          <>
            {/* Map Placeholder */}
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={48} color="#666" />
              <Text style={styles.mapPlaceholderText}>Interactive Map</Text>
              <Text style={styles.mapPlaceholderSubtext}>
                In a native app, this would show an interactive map with business markers
              </Text>
            </View>

            {/* Businesses List */}
            <View style={styles.businessSection}>
              <Text style={styles.sectionTitle}>
                Nearby Businesses ({businesses.length})
              </Text>
              
              {businesses.map((business) => (
                <TouchableOpacity
                  key={business.id}
                  style={styles.businessCard}
                  onPress={() => handleBusinessPress(business)}
                >
                  <View style={styles.businessContent}>
                    <View style={[styles.categoryIndicator, { backgroundColor: getMarkerColor(business.category) }]} />
                    <View style={styles.businessDetails}>
                      <Text style={styles.businessName}>{business.name}</Text>
                      <Text style={styles.businessCategory}>{business.category}</Text>
                      <Text style={styles.businessDescription} numberOfLines={2}>
                        {business.description}
                      </Text>
                      <View style={styles.businessMeta}>
                        <View style={styles.ratingContainer}>
                          {[...Array(5)].map((_, i) => (
                            <Ionicons
                              key={i}
                              name={i < Math.floor(business.rating) ? "star" : "star-outline"}
                              size={14}
                              color="#FFD700"
                            />
                          ))}
                          <Text style={styles.ratingText}>
                            {business.rating.toFixed(1)} ({business.review_count})
                          </Text>
                        </View>
                        {getBusinessDistance(business) && (
                          <Text style={styles.distanceText}>
                            📍 {getBusinessDistance(business)} away
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => navigateToBusiness(business.id)}
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Discounts Section */}
              {discounts.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    🎯 Hot Deals Nearby ({discounts.length})
                  </Text>
                  
                  {discounts.map((item, index) => (
                    <TouchableOpacity
                      key={`discount-${index}`}
                      style={styles.discountCard}
                      onPress={() => router.push({
                        pathname: '/business/[id]',
                        params: { id: item.business.id }
                      })}
                    >
                      <View style={styles.discountContent}>
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountValue}>
                            {item.discount.discount_type === 'percentage' 
                              ? `${item.discount.discount_value}% OFF`
                              : `$${item.discount.discount_value} OFF`
                            }
                          </Text>
                        </View>
                        <View style={styles.discountDetails}>
                          <Text style={styles.discountTitle}>{item.discount.title}</Text>
                          <Text style={styles.discountBusiness}>{item.business.name}</Text>
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
                              onPress={(e) => {
                                e.stopPropagation();
                                handleShareDeal(item.discount.id, item.business.name, item.discount.title);
                              }}
                            >
                              <Ionicons name="share-outline" size={14} color="#007AFF" />
                              <Text style={styles.socialButtonText}>Share</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={styles.socialButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleViewSocialProof(item.discount.id);
                              }}
                            >
                              <Ionicons name="people-outline" size={14} color="#34C759" />
                              <Text style={styles.socialButtonText}>Who Used</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Options</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Distance Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Distance Range</Text>
                <View style={styles.distanceOptions}>
                  {distanceOptions.map((distance) => (
                    <TouchableOpacity
                      key={distance}
                      style={[
                        styles.distanceOption,
                        distanceFilter === distance && styles.distanceOptionActive
                      ]}
                      onPress={() => setDistanceFilter(distance)}
                    >
                      <Text style={[
                        styles.distanceOptionText,
                        distanceFilter === distance && styles.distanceOptionTextActive
                      ]}>
                        {distance}km
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Categories</Text>
                <View style={styles.categoryOptions}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryOption,
                        (selectedCategory === category || (category === 'All' && !selectedCategory)) && styles.categoryOptionActive
                      ]}
                      onPress={() => setSelectedCategory(category === 'All' ? '' : category)}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        (selectedCategory === category || (category === 'All' && !selectedCategory)) && styles.categoryOptionTextActive
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 20,
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
  filterButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
  },
  locationButton: {
    padding: 8,
  },
  distanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    backgroundColor: '#e8f4fd',
    margin: 20,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  businessSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  businessCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  businessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIndicator: {
    width: 4,
    height: 60,
    borderRadius: 2,
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
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
  businessMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  viewButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  discountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  discountContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 16,
  },
  discountValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  discountDetails: {
    flex: 1,
  },
  discountTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  discountBusiness: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  discountDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  expiryText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterSection: {
    marginVertical: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  distanceOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  distanceOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  distanceOptionTextActive: {
    color: '#fff',
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  categoryOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryOptionTextActive: {
    color: '#fff',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});