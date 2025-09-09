import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

// Types
interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
  formattedAddress?: string;
}

interface MapLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (location: LocationData) => void;
  initialLocation?: LocationData;
  title?: string;
}

export default function MapLocationPicker({
  visible,
  onClose,
  onLocationSelected,
  initialLocation,
  title = "Select Business Location"
}: MapLocationPickerProps) {
  const [region, setRegion] = useState<Region>({
    latitude: initialLocation?.latitude || 37.78825,
    longitude: initialLocation?.longitude || -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      requestLocationPermission();
    }
  }, [visible]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted' && !initialLocation) {
        getCurrentLocation();
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!locationPermission) return;
    
    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setRegion(newRegion);
      setSelectedLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Location Error', 'Failed to get your current location');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationInput = async () => {
    // For web and when map is not available, allow manual coordinate entry
    Alert.alert(
      'Set Location',
      'Would you like to use your current location or enter coordinates manually?',
      [
        {
          text: 'Use Current Location',
          onPress: getCurrentLocation
        },
        {
          text: 'Enter Manually',
          onPress: () => {
            // For now, we'll use current location
            // In a full implementation, you could show coordinate input fields
            getCurrentLocation();
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      onLocationSelected(selectedLocation);
      onClose();
    } else {
      Alert.alert('No Location Selected', 'Please tap on the map to select a location');
    }
  };

  const handleSearchArea = async () => {
    if (!locationPermission) {
      Alert.alert('Permission Required', 'Location permission is needed to search this area');
      return;
    }

    try {
      setLoading(true);
      // Search for businesses in the current map area
      // For now, we'll just center the map on the region
      setSelectedLocation({
        latitude: region.latitude,
        longitude: region.longitude,
        address: 'Map Center',
      });
    } catch (error) {
      console.error('Search area error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            📍 Tap on the map to select your exact business location
          </Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {/* Web and mobile compatible location picker */}
          <View style={styles.webMapPlaceholder}>
            <Ionicons name="map" size={64} color="#ccc" />
            <Text style={styles.webMapText}>Location Picker</Text>
            <Text style={styles.webMapSubtext}>
              Use the "Get Current Location" button below to set your location
            </Text>
            {selectedLocation && (
              <View style={styles.webLocationInfo}>
                <Text style={styles.webLocationText}>
                  📍 Selected Location: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </Text>
                {selectedLocation.address && (
                  <Text style={styles.webLocationAddress}>
                    {selectedLocation.address}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Map Controls */}
          <View style={styles.mapControls}>
            {locationPermission && (
              <TouchableOpacity
                style={styles.locationButton}
                onPress={getCurrentLocation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="locate" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Selected Location Info */}
        {selectedLocation && (
          <View style={styles.locationInfo}>
            <View style={styles.locationDetails}>
              <Ionicons name="location" size={20} color="#34C759" />
              <View style={styles.locationText}>
                <Text style={styles.locationTitle}>Selected Location</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {selectedLocation.address || 
                   `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selectedLocation && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirmLocation}
            disabled={!selectedLocation}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  closeButton: {
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
  instructionsContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  locationButton: {
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationInfo: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  locationDetails: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationText: {
    flex: 1,
    marginLeft: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Web-specific styles
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 32,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  webLocationInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  webLocationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  webLocationAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});