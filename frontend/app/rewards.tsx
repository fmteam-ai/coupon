import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface RewardsProfile {
  user_profile: {
    points: number;
    level: number;
    badges: string[];
    streak_days: number;
    total_savings: number;
    deals_used: number;
    reviews_written: number;
  };
  progression: {
    points_to_next_level: number;
    next_level: number;
    progress_percentage: number;
  };
  wallet: {
    balance: number;
    total_earned: number;
  };
  recent_rewards: Array<{
    reward_type: string;
    reward_value: number;
    earned_at: string;
    source: string;
  }>;
  available_badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

interface LeaderboardUser {
  rank: number;
  name: string;
  points: number;
  level: number;
  badges_count: number;
  total_savings: number;
}

export default function RewardsPage() {
  const [profile, setProfile] = useState<RewardsProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'leaderboard'>('profile');

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      if (!token) {
        Alert.alert('Error', 'Please login to view rewards');
        router.push('/');
        return;
      }

      // Load rewards profile
      const profileResponse = await fetch(`${EXPO_BACKEND_URL}/api/rewards/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData);
      }

      // Load leaderboard
      const leaderboardResponse = await fetch(`${EXPO_BACKEND_URL}/api/rewards/leaderboard`);
      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json();
        setLeaderboard(leaderboardData);
      }

    } catch (error) {
      console.error('Error loading rewards data:', error);
      Alert.alert('Error', 'Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: number) => {
    if (level >= 8) return '#FF6B35'; // Orange for high levels
    if (level >= 5) return '#5856D6'; // Purple for mid levels
    if (level >= 3) return '#007AFF'; // Blue for early levels
    return '#34C759'; // Green for beginners
  };

  const getBadgeIcon = (badgeId: string) => {
    const badgeIcons: { [key: string]: string } = {
      'first_deal': '🎯',
      'deal_hunter': '🏹',
      'savings_master': '💰',
      'reviewer': '⭐',
      'local_explorer': '🗺️',
      'streak_keeper': '🔥'
    };
    return badgeIcons[badgeId] || '🏆';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderProgressBar = (percentage: number) => {
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${Math.min(100, percentage)}%` }]} />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading rewards...</Text>
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
        <Text style={styles.headerTitle}>Rewards & Points</Text>
        <TouchableOpacity onPress={() => router.push('/cashback-wallet')} style={styles.walletButton}>
          <Ionicons name="wallet-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
            My Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'profile' && profile && (
          <>
            {/* Level & Points Card */}
            <View style={styles.levelCard}>
              <View style={styles.levelHeader}>
                <View style={[styles.levelBadge, { backgroundColor: getLevelColor(profile.user_profile.level) }]}>
                  <Text style={styles.levelText}>LVL {profile.user_profile.level}</Text>
                </View>
                <View style={styles.pointsContainer}>
                  <Text style={styles.pointsValue}>{profile.user_profile.points.toLocaleString()}</Text>
                  <Text style={styles.pointsLabel}>Points</Text>
                </View>
              </View>
              
              <View style={styles.progressSection}>
                <Text style={styles.progressLabel}>
                  {profile.progression.points_to_next_level} points to Level {profile.progression.next_level}
                </Text>
                {renderProgressBar(profile.progression.progress_percentage)}
              </View>

              <View style={styles.streakContainer}>
                <Ionicons name="flame" size={20} color="#FF6B35" />
                <Text style={styles.streakText}>
                  {profile.user_profile.streak_days} day streak! 🔥
                </Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="gift-outline" size={24} color="#007AFF" />
                <Text style={styles.statValue}>{profile.user_profile.deals_used}</Text>
                <Text style={styles.statLabel}>Deals Used</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="cash-outline" size={24} color="#34C759" />
                <Text style={styles.statValue}>${profile.user_profile.total_savings.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total Saved</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="star-outline" size={24} color="#FFD700" />
                <Text style={styles.statValue}>{profile.user_profile.reviews_written}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </View>

            {/* Badges Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Badges</Text>
              <View style={styles.badgesContainer}>
                {profile.available_badges.map((badge) => {
                  const isEarned = profile.user_profile.badges.includes(badge.id);
                  return (
                    <View
                      key={badge.id}
                      style={[styles.badgeCard, !isEarned && styles.unearned]}
                    >
                      <Text style={styles.badgeIcon}>{getBadgeIcon(badge.id)}</Text>
                      <Text style={[styles.badgeName, !isEarned && styles.unearnedText]}>
                        {badge.name}
                      </Text>
                      <Text style={[styles.badgeDescription, !isEarned && styles.unearnedText]}>
                        {badge.description}
                      </Text>
                      {isEarned && (
                        <View style={styles.earnedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Cashback Wallet Preview */}
            <View style={styles.walletPreview}>
              <View style={styles.walletHeader}>
                <Ionicons name="wallet" size={24} color="#007AFF" />
                <Text style={styles.walletTitle}>Cashback Wallet</Text>
              </View>
              <Text style={styles.walletBalance}>
                ${profile.wallet.balance.toFixed(2)}
              </Text>
              <Text style={styles.walletSubtext}>
                Total Earned: ${profile.wallet.total_earned.toFixed(2)}
              </Text>
              <TouchableOpacity
                style={styles.walletButton}
                onPress={() => router.push('/cashback-wallet')}
              >
                <Text style={styles.walletButtonText}>View Wallet</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Rewards */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Rewards</Text>
              {profile.recent_rewards.map((reward, index) => (
                <View key={index} style={styles.rewardItem}>
                  <View style={styles.rewardIcon}>
                    <Ionicons 
                      name={reward.reward_type === 'points' ? 'star' : reward.reward_type === 'badge' ? 'trophy' : 'trending-up'} 
                      size={20} 
                      color="#007AFF" 
                    />
                  </View>
                  <View style={styles.rewardDetails}>
                    <Text style={styles.rewardTitle}>
                      {reward.reward_type === 'points' ? `+${reward.reward_value} Points` : 
                       reward.reward_type === 'badge' ? 'New Badge Earned!' : 
                       `Level ${reward.reward_value}!`}
                    </Text>
                    <Text style={styles.rewardSource}>From: {reward.source.replace('_', ' ')}</Text>
                    <Text style={styles.rewardDate}>{formatDate(reward.earned_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'leaderboard' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Savers</Text>
            {leaderboard.map((user, index) => (
              <View key={index} style={styles.leaderboardItem}>
                <View style={styles.rankContainer}>
                  <Text style={[
                    styles.rankText,
                    user.rank <= 3 && styles.topRank
                  ]}>
                    #{user.rank}
                  </Text>
                  {user.rank === 1 && <Text style={styles.crownIcon}>👑</Text>}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userStats}>
                    Level {user.level} • {user.points.toLocaleString()} pts
                  </Text>
                  <Text style={styles.userSavings}>
                    ${user.total_savings.toFixed(0)} saved • {user.badges_count} badges
                  </Text>
                </View>
              </View>
            ))}
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
  walletButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  levelCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  levelBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  levelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: (width - 80) / 2,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  unearned: {
    borderColor: '#e1e1e1',
    opacity: 0.6,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  unearnedText: {
    color: '#999',
  },
  earnedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  walletPreview: {
    backgroundColor: '#f0f8ff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  walletBalance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  walletSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  walletButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  walletButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardDetails: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  rewardSource: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  rewardDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    minWidth: 60,
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  topRank: {
    color: '#007AFF',
  },
  crownIcon: {
    fontSize: 16,
    marginLeft: 4,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userStats: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 2,
  },
  userSavings: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});