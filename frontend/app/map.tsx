import React, { useState, useEffect, useRef } from 'react';
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
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
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
  
  const mapRef = useRef<MapView>(null);
  
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

      // Add mock coordinates for demo (in production, these would be stored in database)
      const businessesWithLocation = businessData.map((business: Business, index: number) => ({
        ...business,
        latitude: userLocation!.latitude + (Math.random() - 0.5) * 0.1,
        longitude: userLocation!.longitude + (Math.random() - 0.5) * 0.1,
      }));

      // Filter by distance
      const filteredBusinesses = businessesWithLocation.filter((business: Business) => {
        if (!userLocation) return true;
        const distance = getDistance(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: business.latitude!, longitude: business.longitude! }
        ) / 1000; // Convert to km
        return distance <= distanceFilter;
      });

      setBusinesses(filteredBusinesses);

      // Load discounts
      const discountQuery = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        discountQuery.append('category', selectedCategory);
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

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
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

  const handleMarkerPress = (business: Business) => {
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
    if (!userLocation || !business.latitude || !business.longitude) return null;
    const distance = getDistance(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: business.latitude, longitude: business.longitude }
    );
    return distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`;
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
        <TouchableOpacity onPress={centerOnUser} style={styles.locationButton}>
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

      {/* Map */}
      <View style={styles.mapContainer}>
        {userLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={locationPermission === true}
            showsMyLocationButton={false}
          >
            {/* Distance Circle */}
            {userLocation && (
              <Circle
                center={userLocation}
                radius={distanceFilter * 1000} // Convert km to meters
                strokeColor="rgba(0, 122, 255, 0.3)"
                fillColor="rgba(0, 122, 255, 0.1)"
                strokeWidth={2}
              />
            )}

            {/* Business markers */}
            {businesses.map((business) => (
              <Marker
                key={business.id}
                coordinate={{
                  latitude: business.latitude!,
                  longitude: business.longitude!,
                }}
                pinColor={getMarkerColor(business.category)}
                onPress={() => handleMarkerPress(business)}
              >
                <View style={[styles.customMarker, { backgroundColor: getMarkerColor(business.category) }]}>
                  <Ionicons name="business-outline" size={16} color="#fff" />
                </View>
              </Marker>
            ))}

            {/* Discount markers */}
            {discounts.map((item, index) => {
              const business = {
                ...item.business,
                latitude: userLocation.latitude + (Math.random() - 0.5) * 0.1,
                longitude: userLocation.longitude + (Math.random() - 0.5) * 0.1,
              };
              return (
                <Marker
                  key={`discount-${index}`}
                  coordinate={{
                    latitude: business.latitude,
                    longitude: business.longitude,
                  }}
                  onPress={() => handleMarkerPress(business)}
                >
                  <View style={[styles.discountMarker]}>
                    <Ionicons name="pricetag" size={16} color="#fff" />
                    <Text style={styles.discountText}>
                      {item.discount.discount_type === 'percentage' 
                        ? `${item.discount.discount_value}%`
                        : `$${item.discount.discount_value}`
                      }
                    </Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading businesses...</Text>
          </View>
        )}
      </View>

      {/* Business Info Card */}
      {selectedBusiness && (
        <View style={styles.businessCard}>
          <View style={styles.businessCardHeader}>
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{selectedBusiness.name}</Text>
              <Text style={styles.businessCategory}>{selectedBusiness.category}</Text>
              <View style={styles.ratingContainer}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < Math.floor(selectedBusiness.rating) ? "star" : "star-outline"}
                    size={14}
                    color="#FFD700"
                  />
                ))}
                <Text style={styles.ratingText}>
                  {selectedBusiness.rating.toFixed(1)} ({selectedBusiness.review_count})
                </Text>
              </View>
              {getBusinessDistance(selectedBusiness) && (
                <Text style={styles.distanceText}>
                  📍 {getBusinessDistance(selectedBusiness)} away
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={closeBusinessCard} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.businessDescription} numberOfLines={2}>
            {selectedBusiness.description}
          </Text>
          
          <View style={styles.businessCardActions}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToBusiness(selectedBusiness.id)}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.directionsButton}>
              <Ionicons name="navigate-outline" size={16} color="#007AFF" />
              <Text style={styles.directionsText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  discountMarker: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  businessCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  businessCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  businessDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  closeButton: {
    padding: 4,
  },
  businessCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  directionsText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
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