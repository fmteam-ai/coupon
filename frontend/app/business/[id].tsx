import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  logo?: string;
  rating: number;
  review_count: number;
}

interface Discount {
  id: string;
  title: string;
  description: string;
  discount_type: string;
  discount_value: number;
  minimum_consumption: number;
  expires_at: string;
  qr_code: string;
}

interface Rating {
  rating: {
    id: string;
    rating: number;
    review?: string;
    created_at: string;
  };
  user_name: string;
}

export default function BusinessDetailPage() {
  const { id } = useLocalSearchParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    checkAuthStatus();
    loadBusinessData();
  }, [id]);

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

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      
      // Load business details
      const businessResponse = await fetch(`${EXPO_BACKEND_URL}/api/businesses/${id}`);
      if (!businessResponse.ok) {
        throw new Error('Business not found');
      }
      const businessData = await businessResponse.json();
      setBusiness(businessData);

      // Load discounts
      const discountsResponse = await fetch(`${EXPO_BACKEND_URL}/api/businesses/${id}/discounts`);
      const discountsData = await discountsResponse.json();
      setDiscounts(discountsData);

      // Load ratings
      const ratingsResponse = await fetch(`${EXPO_BACKEND_URL}/api/businesses/${id}/ratings`);
      const ratingsData = await ratingsResponse.json();
      setRatings(ratingsData);

    } catch (error) {
      console.error('Error loading business data:', error);
      Alert.alert('Error', 'Failed to load business information');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleRateBusiness = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to rate businesses');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${EXPO_BACKEND_URL}/api/businesses/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: selectedRating,
          review: reviewText
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Thank you for your rating!');
        setShowRatingModal(false);
        setReviewText('');
        loadBusinessData(); // Reload to show updated rating
      } else {
        throw new Error('Failed to submit rating');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating');
    }
  };

  const renderStars = (rating: number, size: number = 16, onPress?: (rating: number) => void) => {
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating;
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => onPress && onPress(i)}
          disabled={!onPress}
        >
          <Ionicons 
            name={filled ? "star" : "star-outline"} 
            size={size} 
            color="#FFD700" 
          />
        </TouchableOpacity>
      );
    }

    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const showQRCode = (discount: Discount) => {
    router.push({
      pathname: '/qr-display',
      params: { 
        qr_code: discount.qr_code,
        title: discount.title,
        business_name: business?.name || '',
        discount_value: discount.discount_type === 'percentage' 
          ? `${discount.discount_value}% OFF`
          : `$${discount.discount_value} OFF`
      }
    });
  };

  const handleShareDeal = async (discountId: string, businessName: string, dealTitle: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to share deals with friends');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('session_token');
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
            { text: 'Copy Link', onPress: () => copyShareLink(result.share_link) },
            { text: 'Done' }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share deal');
    }
  };

  const copyShareLink = async (shareLink: string) => {
    Alert.alert('Share Link', shareLink, [
      { text: 'OK' }
    ]);
  };

  const handleViewSocialProof = async (discountId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to see social activity');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('session_token');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading business details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Business not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Business Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Business Info */}
        <View style={styles.businessHeader}>
          {business.logo && (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${business.logo}` }}
              style={styles.businessLogo}
            />
          )}
          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>{business.name}</Text>
            <Text style={styles.businessCategory}>{business.category}</Text>
            <View style={styles.ratingSection}>
              {renderStars(business.rating, 18)}
              <Text style={styles.ratingText}>
                {business.rating.toFixed(1)} ({business.review_count} reviews)
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.rateButton}
              onPress={() => setShowRatingModal(true)}
            >
              <Ionicons name="star-outline" size={16} color="#007AFF" />
              <Text style={styles.rateButtonText}>Rate Business</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Business Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.businessDescription}>{business.description}</Text>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactItem}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <Text style={styles.contactText}>{business.email}</Text>
          </View>
          <View style={styles.contactItem}>
            <Ionicons name="call-outline" size={20} color="#666" />
            <Text style={styles.contactText}>{business.phone}</Text>
          </View>
          <View style={styles.contactItem}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <Text style={styles.contactText}>
              {business.address}, {business.city}, {business.country}
            </Text>
          </View>
        </View>

        {/* Available Discounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Offers ({discounts.length})</Text>
          {discounts.length > 0 ? (
            discounts.map((discount) => (
              <View key={discount.id} style={styles.discountCard}>
                <View style={styles.discountHeader}>
                  <Text style={styles.discountValue}>
                    {discount.discount_type === 'percentage' 
                      ? `${discount.discount_value}% OFF`
                      : `$${discount.discount_value} OFF`
                    }
                  </Text>
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={() => showQRCode(discount)}
                  >
                    <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
                    <Text style={styles.qrButtonText}>Show QR</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.discountTitle}>{discount.title}</Text>
                <Text style={styles.discountDescription}>{discount.description}</Text>
                {discount.minimum_consumption > 0 && (
                  <Text style={styles.minimumText}>
                    Minimum purchase: ${discount.minimum_consumption}
                  </Text>
                )}
                <Text style={styles.expiryText}>
                  Valid until: {new Date(discount.expires_at).toLocaleDateString()}
                </Text>
                
                {/* Social Actions */}
                <View style={styles.socialActions}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleShareDeal(discount.id, business.name, discount.title)}
                  >
                    <Ionicons name="share-outline" size={16} color="#007AFF" />
                    <Text style={styles.socialButtonText}>Share</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleViewSocialProof(discount.id)}
                  >
                    <Ionicons name="people-outline" size={16} color="#34C759" />
                    <Text style={styles.socialButtonText}>Who Used</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDiscountsText}>No active offers available</Text>
          )}
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>
          {ratings.length > 0 ? (
            ratings.map((rating) => (
              <View key={rating.rating.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{rating.user_name}</Text>
                  <View style={styles.reviewMeta}>
                    {renderStars(rating.rating.rating, 14)}
                    <Text style={styles.reviewDate}>
                      {new Date(rating.rating.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                {rating.rating.review && (
                  <Text style={styles.reviewText}>{rating.rating.review}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate {business.name}</Text>
            
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Your Rating:</Text>
              {renderStars(selectedRating, 24, setSelectedRating)}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Write a review (optional)"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRateBusiness}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
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
  },
  businessHeader: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  businessLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  rateButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  businessDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  discountCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  qrButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  discountTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  discountDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  minimumText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
    marginBottom: 4,
  },
  expiryText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  noDiscountsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  reviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  reviewMeta: {
    alignItems: 'flex-end',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noReviewsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    marginTop: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
});