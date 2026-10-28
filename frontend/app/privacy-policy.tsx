import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyPage() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>
          
          <Text style={styles.introText}>
            This Privacy Policy describes how CouponApp ("we," "our," or "us") collects, uses, and protects your information when you use our mobile application and services.
          </Text>

          {/* Information We Collect */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            
            <Text style={styles.subSectionTitle}>Personal Information</Text>
            <Text style={styles.bodyText}>
              • Account information (name, email, phone number){'\n'}
              • Authentication data through Emergent Auth{'\n'}
              • Profile preferences and settings{'\n'}
              • Business registration details (for business accounts)
            </Text>

            <Text style={styles.subSectionTitle}>Usage Data</Text>
            <Text style={styles.bodyText}>
              • App interactions and feature usage{'\n'}
              • Search queries and category preferences{'\n'}
              • Discount and coupon redemption history{'\n'}
              • Rewards and points activity{'\n'}
              • AI recommendation interactions and feedback
            </Text>

            <Text style={styles.subSectionTitle}>Location Information</Text>
            <Text style={styles.bodyText}>
              • GPS location data (with your permission){'\n'}
              • Geofencing and proximity data{'\n'}
              • Location-based business discoveries{'\n'}
              • Distance calculations for nearby offers
            </Text>

            <Text style={styles.subSectionTitle}>Payment Information</Text>
            <Text style={styles.bodyText}>
              • Payment data processed securely through Stripe{'\n'}
              • Cashback wallet transactions{'\n'}
              • Subscription and billing information{'\n'}
              • Transaction history and receipts
            </Text>
          </View>

          {/* How We Use Your Information */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
            
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Service Provision:</Text>{'\n'}
              • Provide personalized discount recommendations using AI{'\n'}
              • Process cashback rewards and payments{'\n'}
              • Manage your rewards points, levels, and badges{'\n'}
              • Enable location-based business discovery
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business Analytics:</Text>{'\n'}
              • Generate business insights and customer analytics{'\n'}
              • Track redemption patterns and trends{'\n'}
              • Provide performance metrics to business partners{'\n'}
              • Improve recommendation algorithms
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Communication:</Text>{'\n'}
              • Send important account and service updates{'\n'}
              • Notify you of nearby deals and offers{'\n'}
              • Provide customer support and assistance{'\n'}
              • Share promotional content (with your consent)
            </Text>
          </View>

          {/* AI and Machine Learning */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>3. AI and Machine Learning</Text>
            <Text style={styles.bodyText}>
              We use Emergent LLM and other AI technologies to:{'\n'}
              • Analyze your preferences and behavior patterns{'\n'}
              • Generate personalized deal recommendations{'\n'}
              • Provide confidence scores for recommendations{'\n'}
              • Improve our services through machine learning{'\n\n'}
              Your data is processed in accordance with privacy standards, and AI-generated insights are used solely to enhance your experience.
            </Text>
          </View>

          {/* Information Sharing */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>4. Information Sharing and Disclosure</Text>
            
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business Partners:</Text>{'\n'}
              • Anonymized analytics data with participating businesses{'\n'}
              • Redemption statistics and customer insights{'\n'}
              • Performance metrics and trends
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Service Providers:</Text>{'\n'}
              • Emergent Auth for authentication services{'\n'}
              • Stripe for payment processing{'\n'}
              • Cloud storage and hosting providers{'\n'}
              • Analytics and performance monitoring services
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Legal Requirements:</Text>{'\n'}
              We may disclose information when required by law, court order, or to protect our rights and safety.
            </Text>
          </View>

          {/* Data Security */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>5. Data Security</Text>
            <Text style={styles.bodyText}>
              We implement industry-standard security measures including:{'\n'}
              • Encryption of sensitive data in transit and at rest{'\n'}
              • Secure authentication through Emergent Auth{'\n'}
              • Regular security audits and monitoring{'\n'}
              • Limited access to personal information{'\n'}
              • Secure payment processing through Stripe PCI compliance
            </Text>
          </View>

          {/* Your Rights and Choices */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>6. Your Rights and Choices</Text>
            <Text style={styles.bodyText}>
              You have the right to:{'\n'}
              • Access and review your personal information{'\n'}
              • Update or correct your account details{'\n'}
              • Delete your account and associated data{'\n'}
              • Opt-out of promotional communications{'\n'}
              • Disable location services{'\n'}
              • Request data portability{'\n\n'}
              To exercise these rights, contact us through the app or email support.
            </Text>
          </View>

          {/* Data Retention */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>7. Data Retention</Text>
            <Text style={styles.bodyText}>
              We retain your information for as long as necessary to:{'\n'}
              • Provide our services effectively{'\n'}
              • Comply with legal obligations{'\n'}
              • Resolve disputes and enforce agreements{'\n'}
              • Improve our AI recommendation systems{'\n\n'}
              Account data is typically retained for 3 years after account closure, unless earlier deletion is requested.
            </Text>
          </View>

          {/* Children's Privacy */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
            <Text style={styles.bodyText}>
              Our services are not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If we discover such information has been collected, we will promptly delete it.
            </Text>
          </View>

          {/* International Users */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>9. International Data Transfers</Text>
            <Text style={styles.bodyText}>
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data during international transfers, in compliance with applicable privacy laws including GDPR and CCPA.
            </Text>
          </View>

          {/* Changes to Privacy Policy */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>10. Changes to This Privacy Policy</Text>
            <Text style={styles.bodyText}>
              We may update this Privacy Policy periodically. We will notify you of significant changes through the app or email. Your continued use of our services after changes take effect constitutes acceptance of the updated policy.
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>11. Contact Us</Text>
            <Text style={styles.bodyText}>
              If you have questions about this Privacy Policy or our data practices, please contact us:{'\n\n'}
              Email: privacy@couponapp.com{'\n'}
              Address: [Your Business Address]{'\n'}
              Phone: [Your Contact Number]{'\n\n'}
              For EU residents: You may also contact our Data Protection Officer at dpo@couponapp.com
            </Text>
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
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  introText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 12,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#007AFF',
  },
});