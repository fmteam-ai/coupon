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
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-r';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface AIRecommendation {
  recommendation: {
    id: string;
    confidence_score: number;
    reasoning: string;
    recommendation_type: string;
    created_at: string;
  };
  discount: {
    id: string;
    title: string;
    description: string;
    discount_type: string;
    discount_value: number;
    expires_at: string;
  };
  business: {
    id: string;
    name: string;
    category: string;
    rating: number;
    review_count: number;
    logo?: string;
  };
}

export default function AIRecommendationsPage() {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      if (!token) {
        Alert.alert('Error', 'Please login to view recommendations');
        router.push('/');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/ai/recommendations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      } else {
        Alert.alert('Error', 'Failed to load recommendations');
      }

    } catch (error) {
      console.error('Error loading recommendations:', error);
      Alert.alert('Error', 'Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecommendations();
  };

  const handleRecommendationClick = async (recommendation: AIRecommendation) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Track the click
      await fetch(`${EXPO_BACKEND_URL}/api/ai/recommendation/${recommendation.recommendation.id}/click`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Navigate to business detail
      router.push({
        pathname: '/business/[id]',
        params: { id: recommendation.business.id }
      });
    } catch (error) {
      console.error('Error tracking recommendation click:', error);
      // Still navigate even if tracking fails
      router.push({
        pathname: '/business/[id]',
        params: { id: recommendation.business.id }
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#34C759';
    if (confidence >= 0.6) return '#FF9500';
    return '#007AFF';
  };

  const getRecommendationTypeIcon = (type: string) => {
    switch (type) {
      case 'personal': return 'person-outline';
      case 'trending': return 'trending-up-outline';
      case 'location': return 'location-outline';
      case 'weather': return 'partly-sunny-outline';
      default: return 'bulb-outline';
    }
  };

  const getRecommendationTypeLabel = (type: string) => {
    switch (type) {
      case 'personal': return 'Personal Match';
      case 'trending': return 'Trending Now';
      case 'location': return 'Near You';
      case 'weather': return 'Weather Perfect';
      default: return 'AI Pick';
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Ionicons key={i} name="star" size={14} color="#FFD700" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Ionicons key="half" name="star-half" size={14} color="#FFD700" />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Ionicons key={`empty-${i}`} name="star-outline" size={14} color="#FFD700" />);
    }

    return stars;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading AI recommendations...</Text>
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
        <Text style={styles.headerTitle}>AI Recommendations</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Info Banner */}
        <View style={styles.aiInfoBanner}>
          <View style={styles.aiIconContainer}>
            <Ionicons name="sparkles" size={24} color="#007AFF" />
          </View>
          <View style={styles.aiInfoText}>
            <Text style={styles.aiInfoTitle}>Personalized Just for You</Text>
            <Text style={styles.aiInfoDescription}>
              Our AI analyzes your preferences and behavior to find the perfect deals
            </Text>
          </View>
        </View>

        {recommendations.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>🤖 AI-Powered Recommendations</Text>
            
            {recommendations.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recommendationCard}
                onPress={() => handleRecommendationClick(item)}
              >
                {/* Confidence Badge */}
                <View style={[
                  styles.confidenceBadge,
                  { backgroundColor: getConfidenceColor(item.recommendation.confidence_score) }
                ]}>
                  <Text style={styles.confidenceText}>
                    {Math.round(item.recommendation.confidence_score * 100)}% Match
                  </Text>
                </View>

                {/* Recommendation Type */}
                <View style={styles.recommendationType}>
                  <Ionicons 
                    name={getRecommendationTypeIcon(item.recommendation.recommendation_type)} 
                    size={16} 
                    color="#007AFF" 
                  />
                  <Text style={styles.recommendationTypeText}>
                    {getRecommendationTypeLabel(item.recommendation.recommendation_type)}
                  </Text>
                </View>

                {/* Business Info */}
                <View style={styles.businessSection}>
                  {item.business.logo && (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${item.business.logo}` }}
                      style={styles.businessLogo}
                    />
                  )}
                  <View style={styles.businessInfo}>
                    <Text style={styles.businessName}>{item.business.name}</Text>
                    <Text style={styles.businessCategory}>{item.business.category}</Text>
                    <View style={styles.ratingContainer}>
                      {renderStars(item.business.rating)}
                      <Text style={styles.ratingText}>
                        {item.business.rating.toFixed(1)} ({item.business.review_count})
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Discount Info */}
                <View style={styles.discountSection}>
                  <View style={styles.discountHeader}>
                    <Text style={styles.discountValue}>
                      {item.discount.discount_type === 'percentage' 
                        ? `${item.discount.discount_value}% OFF`
                        : `$${item.discount.discount_value} OFF`
                      }
                    </Text>
                    <Text style={styles.expiryDate}>
                      Expires: {new Date(item.discount.expires_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.discountTitle}>{item.discount.title}</Text>
                  <Text style={styles.discountDescription} numberOfLines={2}>
                    {item.discount.description}
                  </Text>
                </View>

                {/* AI Reasoning */}
                <View style={styles.reasoningSection}>
                  <Ionicons name="brain-outline" size={16} color="#666" />
                  <Text style={styles.reasoningText} numberOfLines={2}>
                    {item.recommendation.reasoning}
                  </Text>
                </View>

                {/* Action Button */}
                <View style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>View Deal</Text>
                  <Ionicons name="arrow-forward" size={16} color="#007AFF" />
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bulb-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Recommendations Yet</Text>
            <Text style={styles.emptyStateText}>
              Use more deals and rate businesses to get personalized AI recommendations!
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.browseButtonText}>Browse All Deals</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* How AI Works */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.howItWorksTitle}>🧠 How Our AI Works</Text>
          
          <View style={styles.howItWorksItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Learning Your Preferences</Text>
              <Text style={styles.stepDescription}>
                We analyze your deal usage, favorite categories, and spending patterns
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Smart Matching</Text>
              <Text style={styles.stepDescription}>
                Our AI matches you with deals that fit your lifestyle and preferences
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Continuous Improvement</Text>
              <Text style={styles.stepDescription}>
                The more you use the app, the better our recommendations become
              </Text>
            </View>
          </View>
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
  aiInfoBanner: {
    backgroundColor: '#f0f8ff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  aiInfoText: {
    flex: 1,
  },
  aiInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  aiInfoDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  recommendationCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  confidenceBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recommendationType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recommendationTypeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 6,
  },
  businessSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessLogo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  businessCategory: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 4,
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
  discountSection: {
    marginBottom: 16,
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
  expiryDate: {
    fontSize: 12,
    color: '#999',
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
  },
  reasoningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reasoningText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  howItWorksSection: {
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
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  howItWorksItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});