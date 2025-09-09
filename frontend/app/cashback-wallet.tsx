import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Wallet {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  currency: string;
}

interface CashbackTransaction {
  id: string;
  original_amount: number;
  discount_amount: number;
  cashback_amount: number;
  transaction_date: string;
  status: string;
}

interface WalletData {
  wallet: Wallet;
  recent_transactions: CashbackTransaction[];
}

export default function CashbackWalletPage() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      if (!token) {
        Alert.alert('Error', 'Please login to view wallet');
        router.push('/');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/cashback/wallet`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      } else {
        Alert.alert('Error', 'Failed to load wallet data');
      }

    } catch (error) {
      console.error('Error loading wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (isNaN(amount) || amount < 5) {
      Alert.alert('Error', 'Minimum withdrawal amount is $5.00');
      return;
    }

    if (!walletData || amount > walletData.wallet.balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    try {
      setWithdrawLoading(true);
      const token = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${EXPO_BACKEND_URL}/api/cashback/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amount,
          method: withdrawMethod
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Success!', 
          `$${amount.toFixed(2)} has been withdrawn to your ${withdrawMethod} account.`,
          [{ text: 'OK', onPress: () => {
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            loadWalletData(); // Refresh wallet data
          }}]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      Alert.alert('Error', 'Failed to process withdrawal');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#34C759';
      case 'pending': return '#FF9500';
      case 'paid_out': return '#007AFF';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!walletData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load wallet data</Text>
          <TouchableOpacity onPress={loadWalletData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
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
        <Text style={styles.headerTitle}>Cashback Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Wallet Balance Card */}
        <View style={styles.walletCard}>
          <View style={styles.balanceSection}>
            <Ionicons name="wallet" size={32} color="#007AFF" />
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              ${walletData.wallet.balance.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.walletStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ${walletData.wallet.total_earned.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ${walletData.wallet.total_withdrawn.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Withdrawn</Text>
            </View>
          </View>

          {/* Withdraw Button */}
          <TouchableOpacity
            style={[styles.withdrawButton, walletData.wallet.balance < 5 && styles.disabledButton]}
            onPress={() => setShowWithdrawModal(true)}
            disabled={walletData.wallet.balance < 5}
          >
            <Ionicons name="arrow-up-circle-outline" size={20} color="#fff" />
            <Text style={styles.withdrawButtonText}>
              {walletData.wallet.balance < 5 ? 'Minimum $5 to Withdraw' : 'Withdraw Funds'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* How Cashback Works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 How Cashback Works</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoStep}>1.</Text>
            <Text style={styles.infoText}>Use deals from participating businesses</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoStep}>2.</Text>
            <Text style={styles.infoText}>Earn 5% cashback on your total purchase</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoStep}>3.</Text>
            <Text style={styles.infoText}>Withdraw to your bank account (minimum $5)</Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Cashback</Text>
          
          {walletData.recent_transactions.length > 0 ? (
            walletData.recent_transactions.map((transaction, index) => (
              <View key={index} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  <Ionicons 
                    name="cash-outline" 
                    size={20} 
                    color={getStatusColor(transaction.status)} 
                  />
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionAmount}>
                    +${transaction.cashback_amount.toFixed(2)}
                  </Text>
                  <Text style={styles.transactionDescription}>
                    Cashback from ${transaction.original_amount.toFixed(2)} purchase
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.transaction_date)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status) }]}>
                  <Text style={styles.statusText}>
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cash-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No cashback transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start using deals to earn cashback!
              </Text>
              <TouchableOpacity
                style={styles.browseDealsButton}
                onPress={() => router.push('/')}
              >
                <Text style={styles.browseDealsText}>Browse Deals</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>
            
            <Text style={styles.modalLabel}>Amount to Withdraw</Text>
            <TextInput
              style={styles.amountInput}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="0.00"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <Text style={styles.balanceHint}>
              Available: ${walletData.wallet.balance.toFixed(2)}
            </Text>

            <Text style={styles.modalLabel}>Withdrawal Method</Text>
            <View style={styles.methodContainer}>
              <TouchableOpacity
                style={[styles.methodButton, withdrawMethod === 'bank' && styles.methodButtonActive]}
                onPress={() => setWithdrawMethod('bank')}
              >
                <Ionicons name="card-outline" size={20} color={withdrawMethod === 'bank' ? '#fff' : '#007AFF'} />
                <Text style={[styles.methodText, withdrawMethod === 'bank' && styles.methodTextActive]}>
                  Bank Account
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.methodButton, withdrawMethod === 'paypal' && styles.methodButtonActive]}
                onPress={() => setWithdrawMethod('paypal')}
              >
                <Ionicons name="logo-paypal" size={20} color={withdrawMethod === 'paypal' ? '#fff' : '#007AFF'} />
                <Text style={[styles.methodText, withdrawMethod === 'paypal' && styles.methodTextActive]}>
                  PayPal
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, withdrawLoading && styles.disabledButton]}
                onPress={handleWithdraw}
                disabled={withdrawLoading}
              >
                {withdrawLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Withdraw</Text>
                )}
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
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  walletCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  walletStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e1e1e1',
  },
  withdrawButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoStep: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 12,
    minWidth: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
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
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  browseDealsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  browseDealsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  modalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  balanceHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  methodButtonActive: {
    backgroundColor: '#007AFF',
  },
  methodText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  methodTextActive: {
    color: '#fff',
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
  confirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});