import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

export default function QRDisplayPage() {
  const { qr_code, title, business_name, discount_value } = useLocalSearchParams();

  const handleSaveQR = () => {
    // In a real app, you'd implement QR code saving to gallery
    Alert.alert('Feature Coming Soon', 'QR code saving will be available soon!');
  };

  const handleShareQR = () => {
    // In a real app, you'd implement sharing functionality
    Alert.alert('Feature Coming Soon', 'QR code sharing will be available soon!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Code</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Discount Info */}
        <View style={styles.discountInfo}>
          <Text style={styles.discountValue}>{discount_value}</Text>
          <Text style={styles.discountTitle}>{title}</Text>
          <Text style={styles.businessName}>at {business_name}</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrContainer}>
          <View style={styles.qrCodeWrapper}>
            <QRCode
              value={qr_code as string || 'default-qr-code'}
              size={width * 0.6}
              backgroundColor="white"
              color="black"
            />
          </View>
          
          <Text style={styles.instructionText}>
            Show this QR code to the business to redeem your discount
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSaveQR}>
            <Ionicons name="download-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Save to Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleShareQR}>
            <Ionicons name="share-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsTitle}>Terms & Conditions:</Text>
          <Text style={styles.termsText}>
            • This QR code is valid for one-time use only{'\n'}
            • Must be presented at the time of purchase{'\n'}
            • Cannot be combined with other offers{'\n'}
            • Subject to business terms and conditions
          </Text>
        </View>
      </View>
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  discountInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  discountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  discountTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  qrCodeWrapper: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  qrCodePlaceholder: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e1e1e1',
    borderStyle: 'dashed',
  },
  qrCodeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  qrPlaceholderText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: width * 0.8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  termsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});