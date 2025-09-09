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

export default function TermsOfUsePage() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Use - Users</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>
          
          <Text style={styles.introText}>
            These Terms of Use ("Terms") govern your use of the CouponApp mobile application and services. By using our app, you agree to these terms.
          </Text>

          {/* Acceptance of Terms */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
            <Text style={styles.bodyText}>
              By accessing or using CouponApp, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these terms, please do not use our services.
            </Text>
          </View>

          {/* Eligibility */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>2. Eligibility</Text>
            <Text style={styles.bodyText}>
              You must be at least 13 years old to use our services. By using CouponApp, you represent and warrant that:{'\n'}
              • You are at least 13 years of age{'\n'}
              • You have the legal capacity to enter into these Terms{'\n'}
              • Your use of the service will not violate any applicable law{'\n'}
              • All information you provide is accurate and current
            </Text>
          </View>

          {/* Account Registration */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>3. Account Registration and Security</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Account Creation:</Text>{'\n'}
              • You may register using your email or through Google OAuth{'\n'}
              • You are responsible for maintaining account confidentiality{'\n'}
              • You must provide accurate and complete information{'\n'}
              • One account per person is allowed
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Account Security:</Text>{'\n'}
              • Keep your login credentials secure{'\n'}
              • Notify us immediately of any unauthorized access{'\n'}
              • You are responsible for all activities under your account{'\n'}
              • We reserve the right to suspend accounts for security reasons
            </Text>
          </View>

          {/* Use of Services */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>4. Permitted Use of Services</Text>
            <Text style={styles.bodyText}>
              You may use CouponApp to:{'\n'}
              • Browse and discover business discounts and offers{'\n'}
              • Redeem legitimate coupons and discounts{'\n'}
              • Earn and track rewards points and badges{'\n'}
              • Receive AI-powered deal recommendations{'\n'}
              • Participate in our cashback program{'\n'}
              • Rate and review businesses honestly{'\n'}
              • Use location-based features for nearby deals
            </Text>
          </View>

          {/* Prohibited Activities */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>5. Prohibited Activities</Text>
            <Text style={styles.bodyText}>
              You agree not to:{'\n'}
              • Create multiple accounts to abuse promotions{'\n'}
              • Share, sell, or transfer coupons intended for personal use{'\n'}
              • Use automated tools, bots, or scripts{'\n'}
              • Attempt to exploit or manipulate the rewards system{'\n'}
              • Submit false reviews or ratings{'\n'}
              • Reverse engineer or modify the app{'\n'}
              • Violate any applicable laws or regulations{'\n'}
              • Harass, threaten, or impersonate other users{'\n'}
              • Submit malicious content or spam
            </Text>
          </View>

          {/* Coupon and Discount Terms */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>6. Coupon and Discount Terms</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>General Terms:</Text>{'\n'}
              • Coupons are subject to business-specific terms and conditions{'\n'}
              • Discounts may have expiration dates and usage limits{'\n'}
              • One coupon per user per business unless otherwise specified{'\n'}
              • Coupons cannot be combined with other offers unless stated{'\n'}
              • We are not responsible for expired or invalid coupons
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>QR Code Usage:</Text>{'\n'}
              • QR codes are for legitimate redemption only{'\n'}
              • Screenshots or sharing of QR codes may be prohibited{'\n'}
              • Businesses may verify coupon authenticity{'\n'}
              • We reserve the right to void fraudulent redemptions
            </Text>
          </View>

          {/* Rewards and Cashback Program */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>7. Rewards and Cashback Program</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Rewards Points:</Text>{'\n'}
              • Points are earned through legitimate app usage{'\n'}
              • Points have no cash value and cannot be transferred{'\n'}
              • We may adjust point values or requirements{'\n'}
              • Points may expire after periods of inactivity{'\n'}
              • Badge achievements are based on verified activities
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Cashback Terms:</Text>{'\n'}
              • Cashback rates may vary by business and promotion{'\n'}
              • Minimum withdrawal amount is $5.00{'\n'}
              • Processing times may vary (typically 3-5 business days){'\n'}
              • Cashback is subject to verification and anti-fraud measures{'\n'}
              • We reserve the right to reverse fraudulent cashback{'\n'}
              • Tax reporting may be required for cashback over $600/year
            </Text>
          </View>

          {/* AI Recommendations */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>8. AI-Powered Recommendations</Text>
            <Text style={styles.bodyText}>
              Our AI system provides personalized recommendations based on:{'\n'}
              • Your app usage patterns and preferences{'\n'}
              • Location data (with your permission){'\n'}
              • Historical redemption behavior{'\n'}
              • Similar user patterns and trends{'\n\n'}
              Recommendations are suggestions only and do not guarantee:{'\n'}
              • Availability of offers{'\n'}
              • Satisfaction with recommended businesses{'\n'}
              • Accuracy of business information{'\n'}
              • Quality of products or services
            </Text>
          </View>

          {/* User Content and Reviews */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>9. User Content and Reviews</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Content Guidelines:</Text>{'\n'}
              • Reviews must be based on genuine experiences{'\n'}
              • Content must be respectful and appropriate{'\n'}
              • No offensive, discriminatory, or illegal content{'\n'}
              • No personal information of others{'\n'}
              • No promotional or commercial content
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Content Rights:</Text>{'\n'}
              • You retain ownership of your content{'\n'}
              • You grant us a license to use, display, and moderate content{'\n'}
              • We may remove content that violates these terms{'\n'}
              • We are not responsible for user-generated content
            </Text>
          </View>

          {/* Privacy and Data */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>10. Privacy and Data Use</Text>
            <Text style={styles.bodyText}>
              Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information. By using our services, you consent to our data practices as described in the Privacy Policy.
            </Text>
          </View>

          {/* Payment and Billing */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>11. Payment and Billing</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>General:</Text>{'\n'}
              • Basic app usage is free for consumers{'\n'}
              • Payment processing is handled securely through Stripe{'\n'}
              • We do not store credit card information{'\n'}
              • All transactions are subject to verification
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Refunds:</Text>{'\n'}
              • Refunds for app-related issues will be considered case-by-case{'\n'}
              • Business-related refunds must be handled directly with the business{'\n'}
              • Cashback reversals may occur for fraudulent activity{'\n'}
              • Processing fees may apply to certain transactions
            </Text>
          </View>

          {/* Intellectual Property */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>12. Intellectual Property</Text>
            <Text style={styles.bodyText}>
              The CouponApp application, including all content, features, and functionality, is owned by us and protected by copyright, trademark, and other intellectual property laws. You may not:{'\n'}
              • Copy, modify, or distribute our content{'\n'}
              • Use our trademarks without permission{'\n'}
              • Create derivative works{'\n'}
              • Reverse engineer the application
            </Text>
          </View>

          {/* Disclaimers */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>13. Disclaimers</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Service Availability:</Text>{'\n'}
              • Services are provided "as is" without warranties{'\n'}
              • We do not guarantee uninterrupted service{'\n'}
              • Features may be modified or discontinued{'\n'}
              • Third-party integrations may be subject to changes
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business Relationships:</Text>{'\n'}
              • We are not responsible for business quality or service{'\n'}
              • Disputes with businesses must be resolved directly{'\n'}
              • Business information may be inaccurate or outdated{'\n'}
              • We do not endorse any particular business
            </Text>
          </View>

          {/* Limitation of Liability */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>14. Limitation of Liability</Text>
            <Text style={styles.bodyText}>
              To the fullest extent permitted by law, CouponApp and its affiliates shall not be liable for:{'\n'}
              • Indirect, incidental, or consequential damages{'\n'}
              • Loss of profits, data, or business opportunities{'\n'}
              • Issues arising from business interactions{'\n'}
              • Technical failures or security breaches{'\n'}
              • Actions of other users or third parties{'\n\n'}
              Our total liability shall not exceed $100 or the amount you paid us in the past 12 months, whichever is greater.
            </Text>
          </View>

          {/* Termination */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>15. Termination</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Your Rights:</Text>{'\n'}
              • You may delete your account at any time{'\n'}
              • Account deletion removes personal data as per our Privacy Policy{'\n'}
              • Outstanding cashback will be processed before deletion
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Our Rights:</Text>{'\n'}
              • We may suspend or terminate accounts for Terms violations{'\n'}
              • We may discontinue services at any time{'\n'}
              • Terminated accounts forfeit unused rewards and cashback{'\n'}
              • We will provide reasonable notice when possible
            </Text>
          </View>

          {/* Changes to Terms */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>16. Changes to Terms</Text>
            <Text style={styles.bodyText}>
              We may modify these Terms periodically. Material changes will be communicated through the app or email. Continued use after changes constitutes acceptance of the updated Terms. If you disagree with changes, please discontinue use and delete your account.
            </Text>
          </View>

          {/* Governing Law */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>17. Governing Law and Disputes</Text>
            <Text style={styles.bodyText}>
              These Terms are governed by [Your State/Country] law. Disputes will be resolved through binding arbitration, except for small claims court matters. Class action lawsuits are waived. If any provision is unenforceable, the remaining terms remain in effect.
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>18. Contact Information</Text>
            <Text style={styles.bodyText}>
              For questions about these Terms of Use, please contact us:{'\n\n'}
              Email: support@couponapp.com{'\n'}
              Address: [Your Business Address]{'\n'}
              Phone: [Your Contact Number]{'\n\n'}
              For legal matters: legal@couponapp.com
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