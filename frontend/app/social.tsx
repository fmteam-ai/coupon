import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Friend {
  friend_id: string;
  name: string;
  email: string;
  added_at: string;
  recent_activity: any[];
}

interface SocialActivity {
  id: string;
  activity_type: string;
  user_name: string;
  user_id: string;
  points_earned: number;
  created_at: string;
  activity_data: any;
  target_details: any;
  is_friend: boolean;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  requirements: any;
  rewards: any;
  end_date: string;
  is_participating: boolean;
  progress: any;
  completed: boolean;
}

export default function SocialPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [socialFeed, setSocialFeed] = useState<SocialActivity[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'friends' | 'challenges'>('feed');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);

  useEffect(() => {
    fetchSocialData();
  }, []);

  const fetchSocialData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [friendsResponse, feedResponse, challengesResponse] = await Promise.all([
        fetch(`${EXPO_BACKEND_URL}/api/social/friends`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${EXPO_BACKEND_URL}/api/social/feed`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${EXPO_BACKEND_URL}/api/social/challenges`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        setFriends(friendsData.friends);
      }

      if (feedResponse.ok) {
        const feedData = await feedResponse.json();
        setSocialFeed(feedData.activities);
      }

      if (challengesResponse.ok) {
        const challengesData = await challengesResponse.json();
        setChallenges(challengesData.challenges);
      }

    } catch (error) {
      console.error('Error fetching social data:', error);
      Alert.alert('Error', 'Failed to load social data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddFriend = async () => {
    if (!friendEmail.trim()) {
      Alert.alert('Error', 'Please enter a friend\'s email address');
      return;
    }

    setAddingFriend(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${EXPO_BACKEND_URL}/api/social/friends/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ friend_email: friendEmail })
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert(
          'Success!',
          `${result.message}. You both earned ${result.points_earned} points!`,
          [{ text: 'OK', onPress: () => {
            setShowAddFriendModal(false);
            setFriendEmail('');
            fetchSocialData();
          }}]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to add friend');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add friend');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${EXPO_BACKEND_URL}/api/social/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert('Joined!', result.message);
        fetchSocialData(); // Refresh to show updated status
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to join challenge');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join challenge');
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'deal_used': return 'ticket';
      case 'deal_shared': return 'share';
      case 'friend_added': return 'person-add';
      case 'achievement_earned': return 'trophy';
      case 'review_posted': return 'star';
      default: return 'activity';
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'deal_used': return '#34C759';
      case 'deal_shared': return '#007AFF';
      case 'friend_added': return '#FF9500';
      case 'achievement_earned': return '#FFD700';
      case 'review_posted': return '#FF6B35';
      default: return '#666';
    }
  };

  const formatActivityText = (activity: SocialActivity) => {
    const { activity_type, user_name, activity_data, target_details, is_friend } = activity;
    const userLabel = is_friend ? user_name : 'You';
    
    switch (activity_type) {
      case 'deal_used':
        return `${userLabel} used a deal at ${target_details?.business_name || 'a business'}`;
      case 'deal_shared':
        return `${userLabel} shared a deal from ${target_details?.business_name || 'a business'}`;
      case 'friend_added':
        return `${userLabel} added ${activity_data?.friend_name || 'someone'} as a friend`;
      case 'achievement_earned':
        return `${userLabel} earned an achievement!`;
      case 'review_posted':
        return `${userLabel} reviewed ${target_details?.business_name || 'a business'}`;
      default:
        return `${userLabel} had some activity`;
    }
  };

  const renderFeed = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {socialFeed.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
          <Text style={styles.emptyStateText}>
            Add friends and start using deals to see social activity here!
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => setShowAddFriendModal(true)}
          >
            <Text style={styles.emptyStateButtonText}>Add Your First Friend</Text>
          </TouchableOpacity>
        </View>
      ) : (
        socialFeed.map((activity) => (
          <View key={activity.id} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View style={[styles.activityIcon, { backgroundColor: getActivityColor(activity.activity_type) + '20' }]}>
                <Ionicons 
                  name={getActivityIcon(activity.activity_type) as any} 
                  size={20} 
                  color={getActivityColor(activity.activity_type)} 
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  {formatActivityText(activity)}
                </Text>
                <Text style={styles.activityTime}>
                  {new Date(activity.created_at).toLocaleDateString()}
                </Text>
              </View>
              {activity.points_earned > 0 && (
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsText}>+{activity.points_earned}</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderFriends = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddFriendModal(true)}
        >
          <Ionicons name="person-add" size={20} color="#007AFF" />
          <Text style={styles.addButtonText}>Add Friend</Text>
        </TouchableOpacity>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Friends Yet</Text>
          <Text style={styles.emptyStateText}>
            Add friends to share deals, compete in challenges, and earn bonus points!
          </Text>
        </View>
      ) : (
        friends.map((friend) => (
          <View key={friend.friend_id} style={styles.friendCard}>
            <View style={styles.friendInfo}>
              <View style={styles.friendAvatar}>
                <Text style={styles.friendInitial}>
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.friendDetails}>
                <Text style={styles.friendName}>{friend.name}</Text>
                <Text style={styles.friendEmail}>{friend.email}</Text>
                <Text style={styles.friendDate}>
                  Friends since {new Date(friend.added_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
            {friend.recent_activity.length > 0 && (
              <Text style={styles.friendActivity}>
                Recent: {friend.recent_activity[0].activity_type.replace('_', ' ')}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderChallenges = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Active Challenges</Text>
      
      {challenges.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Active Challenges</Text>
          <Text style={styles.emptyStateText}>
            Check back later for exciting challenges to earn extra points and badges!
          </Text>
        </View>
      ) : (
        challenges.map((challenge) => (
          <View key={challenge.id} style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <View style={[styles.challengeType, { backgroundColor: 
                challenge.challenge_type === 'monthly' ? '#FF6B35' : 
                challenge.challenge_type === 'weekly' ? '#34C759' : '#007AFF'
              }]}>
                <Text style={styles.challengeTypeText}>{challenge.challenge_type}</Text>
              </View>
            </View>
            
            <Text style={styles.challengeDescription}>{challenge.description}</Text>
            
            <View style={styles.challengeDetails}>
              <View style={styles.challengeRequirements}>
                <Text style={styles.challengeLabel}>Requirements:</Text>
                {Object.entries(challenge.requirements).map(([key, value]) => (
                  <Text key={key} style={styles.challengeRequirement}>
                    • {key.replace('_', ' ')}: {value as string}
                  </Text>
                ))}
              </View>
              
              <View style={styles.challengeRewards}>
                <Text style={styles.challengeLabel}>Rewards:</Text>
                {Object.entries(challenge.rewards).map(([key, value]) => (
                  <Text key={key} style={styles.challengeReward}>
                    • {key}: {value as string}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.challengeFooter}>
              <Text style={styles.challengeEndDate}>
                Ends: {new Date(challenge.end_date).toLocaleDateString()}
              </Text>
              
              {challenge.is_participating ? (
                <View style={styles.participatingBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.participatingText}>
                    {challenge.completed ? 'Completed!' : 'Participating'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={() => handleJoinChallenge(challenge.id)}
                >
                  <Text style={styles.joinButtonText}>Join Challenge</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading social features...</Text>
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
        <Text style={styles.headerTitle}>Social</Text>
        <TouchableOpacity 
          style={styles.headerAction}
          onPress={() => setShowAddFriendModal(true)}
        >
          <Ionicons name="person-add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Ionicons 
            name="newspaper-outline" 
            size={20} 
            color={activeTab === 'feed' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            Feed
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Ionicons 
            name="people-outline" 
            size={20} 
            color={activeTab === 'friends' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenges' && styles.activeTab]}
          onPress={() => setActiveTab('challenges')}
        >
          <Ionicons 
            name="trophy-outline" 
            size={20} 
            color={activeTab === 'challenges' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'challenges' && styles.activeTabText]}>
            Challenges
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'feed' && renderFeed()}
        {activeTab === 'friends' && renderFriends()}
        {activeTab === 'challenges' && renderChallenges()}
      </View>

      {/* Add Friend Modal */}
      <Modal
        visible={showAddFriendModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddFriendModal(false);
                setFriendEmail('');
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Enter your friend's email address to add them and start earning points together!
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Friend's Email</Text>
              <TextInput
                style={styles.textInput}
                value={friendEmail}
                onChangeText={setFriendEmail}
                placeholder="friend@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.addFriendButton, !friendEmail.trim() && styles.addFriendButtonDisabled]}
              onPress={handleAddFriend}
              disabled={!friendEmail.trim() || addingFriend}
            >
              {addingFriend ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color="#fff" />
                  <Text style={styles.addFriendButtonText}>Add Friend (+25 points each)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerAction: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  pointsBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  friendCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  friendDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  friendActivity: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  challengeType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  challengeTypeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  challengeDetails: {
    marginBottom: 16,
  },
  challengeRequirements: {
    marginBottom: 12,
  },
  challengeRewards: {
    marginBottom: 12,
  },
  challengeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  challengeRequirement: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  challengeReward: {
    fontSize: 12,
    color: '#34C759',
    marginLeft: 8,
    fontWeight: '500',
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeEndDate: {
    fontSize: 12,
    color: '#999',
  },
  participatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participatingText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addFriendButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  addFriendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addFriendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});