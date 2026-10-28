import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Rating {
  id: string;
  rating: number;
  review: string;
  created_at: string;
  user_name: string;
}

interface BusinessRatingProps {
  businessId: string;
  businessName: string;
  currentRating?: number;
  reviewCount?: number;
  onRatingUpdated?: (newRating: number, newCount: number) => void;
}

export default function BusinessRating({
  businessId,
  businessName,
  currentRating = 0,
  reviewCount = 0,
  onRatingUpdated,
}: BusinessRatingProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [hasUserRated, setHasUserRated] = useState(false);

  const submitRating = async () => {
    if (userRating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert('Error', 'Please login to rate businesses');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/businesses/${businessId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: userRating,
          review: userReview,
        }),
      });

      if (response.ok) {
        setModalVisible(false);
        setHasUserRated(true);
        
        Alert.alert(
          'Rating Submitted!',
          hasUserRated ? 'Your rating has been updated.' : 'Thanks for your feedback! You earned 25 points.',
          [{ text: 'OK' }]
        );

        // Refresh ratings data
        await loadRatings();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Rating submission error:', error);
      Alert.alert('Error', 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const loadRatings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${EXPO_BACKEND_URL}/api/businesses/${businessId}/ratings`);
      
      if (response.ok) {
        const ratingsData = await response.json();
        setRatings(ratingsData);
        
        // Calculate new average and count
        if (ratingsData.length > 0) {
          const total = ratingsData.reduce((sum: number, r: any) => sum + r.rating.rating, 0);
          const newAverage = total / ratingsData.length;
          onRatingUpdated?.(newAverage, ratingsData.length);
        }
        
        // Check if current user has rated
        const token = await AsyncStorage.getItem('session_token');
        if (token) {
          // In a real implementation, you'd check if current user ID matches any rating
          // For now, we'll use a simple heuristic
          setHasUserRated(ratingsData.length > 0);
        }
      }
    } catch (error) {
      console.error('Load ratings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: number = 16, interactive: boolean = false, onStarPress?: (star: number) => void) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => interactive && onStarPress?.(i)}
          disabled={!interactive}
          style={interactive ? styles.interactiveStar : undefined}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={size}
            color={i <= rating ? '#FFD700' : '#DDD'}
          />
        </TouchableOpacity>
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      {/* Rating Summary */}
      <View style={styles.ratingSummary}>
        <View style={styles.ratingInfo}>
          {renderStars(currentRating, 20)}
          <Text style={styles.ratingText}>
            {currentRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
          </Text>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="star" size={16} color="#007AFF" />
            <Text style={styles.rateButtonText}>
              {hasUserRated ? 'Update Rating' : 'Rate'}
            </Text>
          </TouchableOpacity>
          
          {reviewCount > 0 && (
            <TouchableOpacity
              style={styles.viewReviewsButton}
              onPress={() => {
                loadRatings();
                setReviewsModalVisible(true);
              }}
            >
              <Ionicons name="chatbubbles" size={16} color="#666" />
              <Text style={styles.viewReviewsButtonText}>Reviews</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rating Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Rate {businessName}</Text>
            <TouchableOpacity onPress={submitRating} disabled={submitting}>
              <Text style={[styles.modalSubmit, submitting && styles.modalSubmitDisabled]}>
                {submitting ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingPrompt}>How was your experience?</Text>
              {renderStars(userRating, 40, true, setUserRating)}
              <Text style={styles.ratingLabel}>
                {userRating === 0 && 'Tap a star to rate'}
                {userRating === 1 && 'Poor'}
                {userRating === 2 && 'Fair'}
                {userRating === 3 && 'Good'}
                {userRating === 4 && 'Very Good'}
                {userRating === 5 && 'Excellent'}
              </Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewPrompt}>Tell others about your experience (optional)</Text>
              <TextInput
                style={styles.reviewInput}
                value={userReview}
                onChangeText={setUserReview}
                placeholder="Share your thoughts about this business..."
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {userReview.length}/500 characters
              </Text>
            </View>

            <View style={styles.pointsInfo}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={styles.pointsText}>
                {hasUserRated ? 'Update your rating' : 'Earn 25 points for your first review!'}
              </Text>
            </View>
          </ScrollView>

          {submitting && (
            <View style={styles.submittingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.submittingText}>Submitting your rating...</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Reviews Modal */}
      <Modal
        visible={reviewsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reviews</Text>
            <View style={styles.headerRight} />
          </View>

          <ScrollView style={styles.modalContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading reviews...</Text>
              </View>
            ) : ratings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No reviews yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to share your experience!
                </Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {ratings.map((rating, index) => (
                  <View key={index} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewerInfo}>
                        <Text style={styles.reviewerName}>{rating.user_name}</Text>
                        {renderStars(rating.rating.rating, 14)}
                      </View>
                      <Text style={styles.reviewDate}>
                        {formatDate(rating.rating.created_at)}
                      </Text>
                    </View>
                    {rating.rating.review && (
                      <Text style={styles.reviewText}>{rating.rating.review}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  ratingSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingInfo: {
    flex: 1,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 2,
  },
  interactiveStar: {
    padding: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 4,
  },
  rateButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  viewReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    gap: 4,
  },
  viewReviewsButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  modalSubmit: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalSubmitDisabled: {
    color: '#ccc',
  },
  headerRight: {
    width: 50,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  ratingSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  ratingPrompt: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 12,
    fontWeight: '500',
  },
  reviewSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  reviewPrompt: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  reviewInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  pointsText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  submittingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  reviewsList: {
    gap: 16,
  },
  reviewItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
});