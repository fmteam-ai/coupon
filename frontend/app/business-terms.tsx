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

export default function BusinessTermsPage() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Terms</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>
          
          <Text style={styles.introText}>
            These Business Terms of Service govern your use of CouponApp as a business partner, including subscription services and promotional offerings.
          </Text>

          {/* Agreement to Terms */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>1. Agreement to Business Terms</Text>
            <Text style={styles.bodyText}>
              By registering as a business on CouponApp, you agree to these Business Terms in addition to our general Terms of Use and Privacy Policy. These terms form a binding agreement between your business and CouponApp.
            </Text>
          </View>

          {/* Business Eligibility */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>2. Business Eligibility and Registration</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Eligibility Requirements:</Text>{'\n'}
              • You must be a legitimate business entity{'\n'}
              • You must have legal authority to bind the business{'\n'}
              • Your business must comply with all applicable laws{'\n'}
              • You must provide accurate business information{'\n'}
              • Your business must be in good standing
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Registration Process:</Text>{'\n'}
              • Complete business verification process{'\n'}
              • Provide required documentation (business license, tax ID){'\n'}
              • Submit to admin approval process{'\n'}
              • Agree to ongoing compliance monitoring{'\n'}
              • Maintain current and accurate business information
            </Text>
          </View>

          {/* Subscription Services */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>3. Subscription Services and Pricing</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Free Trial Period:</Text>{'\n'}
              • New businesses receive a 1-year free trial{'\n'}
              • Trial includes full access to all features{'\n'}
              • No payment required during trial period{'\n'}
              • Trial terms may be modified for promotional purposes{'\n'}
              • Early upgrade to paid plans available anytime
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Paid Subscription:</Text>{'\n'}
              • Annual subscription billing after trial expires{'\n'}
              • Pricing displayed at time of subscription{'\n'}
              • Payment processed securely through Stripe{'\n'}
              • Automatic renewal unless cancelled{'\n'}
              • Pro-rated refunds may apply within 30 days{'\n'}
              • Price changes will be communicated 30 days in advance
            </Text>
          </View>

          {/* Business Services */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>4. Business Services and Features</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Discount Management:</Text>{'\n'}
              • Create and manage promotional offers{'\n'}
              • Set discount parameters (value, expiry, limits){'\n'}
              • Generate QR codes for coupon validation{'\n'}
              • Track redemption analytics and performance{'\n'}
              • Modify or cancel promotions as needed
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Analytics and Insights:</Text>{'\n'}
              • Customer behavior and demographics analysis{'\n'}
              • Redemption tracking and conversion metrics{'\n'}
              • Performance benchmarking and trends{'\n'}
              • Customer lifetime value calculations{'\n'}
              • AI-powered business recommendations
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Customer Engagement:</Text>{'\n'}
              • Profile visibility in app directory{'\n'}
              • Customer rating and review system{'\n'}
              • Location-based discovery features{'\n'}
              • Targeted promotion capabilities{'\n'}
              • Integration with loyalty programs
            </Text>
          </View>

          {/* Business Obligations */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>5. Business Obligations and Responsibilities</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Discount Fulfillment:</Text>{'\n'}
              • Honor all published discounts and promotions{'\n'}
              • Maintain adequate inventory for promoted items{'\n'}
              • Train staff on coupon redemption procedures{'\n'}
              • Provide clear terms and conditions for offers{'\n'}
              • Handle customer service issues professionally
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Compliance Requirements:</Text>{'\n'}
              • Comply with all applicable laws and regulations{'\n'}
              • Maintain necessary business licenses and permits{'\n'}
              • Follow advertising and promotional standards{'\n'}
              • Respect customer privacy and data protection{'\n'}
              • Report and resolve customer complaints promptly
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Content Standards:</Text>{'\n'}
              • Provide accurate business information{'\n'}
              • Use appropriate and professional content{'\n'}
              • Respect intellectual property rights{'\n'}
              • Avoid misleading or deceptive practices{'\n'}
              • Maintain brand standards and guidelines
            </Text>
          </View>

          {/* Payment and Financial Terms */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>6. Payment and Financial Terms</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Subscription Payments:</Text>{'\n'}
              • Annual subscription fees due in advance{'\n'}
              • Payments processed on subscription anniversary{'\n'}
              • Late payment may result in service suspension{'\n'}
              • All fees are non-refundable except as stated{'\n'}
              • Payment disputes must be reported within 30 days
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Transaction Processing:</Text>{'\n'}
              • Cashback payments processed through our system{'\n'}
              • Businesses may be charged for cashback provided to customers{'\n'}
              • Transaction fees and processing costs may apply{'\n'}
              • Settlement periods and terms vary by agreement{'\n'}
              • Detailed transaction reporting provided
            </Text>
          </View>

          {/* Data and Analytics */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>7. Data Usage and Analytics</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business Data:</Text>{'\n'}
              • We collect business performance and customer interaction data{'\n'}
              • Data is used to provide analytics and insights{'\n'}
              • Aggregated data may be used for platform improvements{'\n'}
              • Individual customer data remains confidential{'\n'}
              • Businesses receive detailed analytics reports
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Data Sharing:</Text>{'\n'}
              • Anonymized performance data may be shared for benchmarking{'\n'}
              • Customer data is never shared with competitors{'\n'}
              • Businesses may opt-out of certain data sharing{'\n'}
              • All data usage complies with privacy regulations{'\n'}
              • Data retention policies apply as outlined in Privacy Policy
            </Text>
          </View>

          {/* Prohibited Business Activities */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>8. Prohibited Business Activities</Text>
            <Text style={styles.bodyText}>
              Businesses must not:{'\n'}
              • Create fraudulent or misleading promotions{'\n'}
              • Discriminate against customers based on protected characteristics{'\n'}
              • Use the platform for illegal activities{'\n'}
              • Manipulate reviews or ratings{'\n'}
              • Compete unfairly with other platform businesses{'\n'}
              • Violate intellectual property rights{'\n'}
              • Engage in predatory or unfair business practices{'\n'}
              • Abuse customer data or privacy{'\n'}
              • Circumvent platform fees or payment systems
            </Text>
          </View>

          {/* Quality Standards */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>9. Quality Standards and Performance</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Service Standards:</Text>{'\n'}
              • Maintain high standards of customer service{'\n'}
              • Respond to customer inquiries within 24 hours{'\n'}
              • Resolve complaints professionally and promptly{'\n'}
              • Honor promotional terms and conditions{'\n'}
              • Provide consistent quality products and services
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Performance Monitoring:</Text>{'\n'}
              • Customer satisfaction ratings are monitored{'\n'}
              • Consistent poor performance may result in account review{'\n'}
              • Businesses may be required to implement improvement plans{'\n'}
              • Repeated violations may result in account suspension{'\n'}
              • Appeals process available for disputed actions
            </Text>
          </View>

          {/* Intellectual Property */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>10. Intellectual Property Rights</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business Content:</Text>{'\n'}
              • You retain ownership of your business content{'\n'}
              • You grant us license to display and promote your content{'\n'}
              • You warrant that you have rights to all submitted content{'\n'}
              • You are responsible for trademark and copyright compliance{'\n'}
              • Platform branding and features remain our property
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Platform Usage:</Text>{'\n'}
              • Limited license to use platform for business purposes{'\n'}
              • No right to modify, copy, or redistribute platform technology{'\n'}
              • CouponApp trademarks and branding are protected{'\n'}
              • Businesses may reference platform partnership in marketing{'\n'}
              • Usage guidelines apply to all promotional materials
            </Text>
          </View>

          {/* Termination and Suspension */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>11. Account Termination and Suspension</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business-Initiated Termination:</Text>{'\n'}
              • Cancel subscription anytime with 30 days notice{'\n'}
              • Account remains active through current billing period{'\n'}
              • Data export available for 90 days after cancellation{'\n'}
              • Outstanding obligations must be fulfilled{'\n'}
              • Refunds processed according to refund policy
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Platform-Initiated Actions:</Text>{'\n'}
              • Accounts may be suspended for Terms violations{'\n'}
              • Immediate suspension for legal or safety concerns{'\n'}
              • Notice provided when possible before termination{'\n'}
              • Appeals process available for disputed actions{'\n'}
              • Data retention follows legal requirements
            </Text>
          </View>

          {/* Liability and Insurance */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>12. Liability and Insurance</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Business Liability:</Text>{'\n'}
              • Businesses are responsible for their products and services{'\n'}
              • Maintain appropriate business insurance coverage{'\n'}
              • Indemnify platform against claims arising from business operations{'\n'}
              • Comply with local health, safety, and regulatory requirements{'\n'}
              • Handle customer disputes and claims directly
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Platform Liability:</Text>{'\n'}
              • Platform provides technology services only{'\n'}
              • No warranty regarding business success or performance{'\n'}
              • Limited liability for platform-related issues{'\n'}
              • Force majeure protections apply{'\n'}
              • Dispute resolution through arbitration when applicable
            </Text>
          </View>

          {/* Modifications to Business Terms */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>13. Modifications to Business Terms</Text>
            <Text style={styles.bodyText}>
              We may modify these Business Terms with 30 days advance notice to active business subscribers. Material changes affecting pricing or core services will include prominent notification. Continued use after the effective date constitutes acceptance of modified terms.
            </Text>
          </View>

          {/* Support and Resources */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>14. Business Support and Resources</Text>
            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Available Support:</Text>{'\n'}
              • Dedicated business support channel{'\n'}
              • Platform training and onboarding resources{'\n'}
              • Technical assistance for platform features{'\n'}
              • Marketing best practices and guidance{'\n'}
              • Regular platform updates and feature announcements
            </Text>

            <Text style={styles.bodyText}>
              <Text style={styles.bold}>Response Times:</Text>{'\n'}
              • General inquiries: 24-48 hours{'\n'}
              • Technical issues: 4-12 hours{'\n'}
              • Billing questions: 24 hours{'\n'}
              • Critical system issues: 2-4 hours{'\n'}
              • Enhanced support available for premium subscribers
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>15. Business Contact Information</Text>
            <Text style={styles.bodyText}>
              For business-related questions and support:{'\n\n'}
              Business Support: business@couponapp.com{'\n'}
              Billing Questions: billing@couponapp.com{'\n'}
              Technical Support: support@couponapp.com{'\n'}
              Legal Matters: legal@couponapp.com{'\n\n'}
              Mailing Address:{'\n'}
              [Your Business Address]{'\n'}
              [City, State, ZIP Code]{'\n\n'}
              Phone: [Business Support Number]{'\n'}
              Business Hours: Monday-Friday, 9 AM - 6 PM [Your Timezone]
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