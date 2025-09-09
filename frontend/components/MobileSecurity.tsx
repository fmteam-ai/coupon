import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

interface DeviceInfo {
  model?: string;
  brand?: string;
  os_version?: string;
  platform?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  unique_id?: string;
  app_signature?: string;
  debug_enabled?: boolean;
  is_emulator?: boolean;
  api_level?: number;
}

interface SecurityStatus {
  device_id: string;
  risk_level: string;
  is_trusted: boolean;
  security_score: number;
  violations: any[];
}

interface MobileSecurityProps {
  userId: string;
  onSecurityStatusChange?: (status: SecurityStatus) => void;
}

const MobileSecurity: React.FC<MobileSecurityProps> = ({ 
  userId, 
  onSecurityStatusChange 
}) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({});
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [certificatePins, setCertificatePins] = useState<any>(null);
  const [securityPolicies, setSecurityPolicies] = useState<any>(null);

  useEffect(() => {
    initializeMobileSecurity();
  }, []);

  const initializeMobileSecurity = async () => {
    try {
      // Collect device information
      const deviceData = await collectDeviceInfo();
      setDeviceInfo(deviceData);

      // Get security policies
      await fetchSecurityPolicies();

      // Get certificate pins
      await fetchCertificatePins();

      // Register device or check existing status
      await registerOrCheckDevice(deviceData);

    } catch (error) {
      console.error('Mobile security initialization error:', error);
      Alert.alert('Security Error', 'Failed to initialize mobile security');
    }
  };

  const collectDeviceInfo = async (): Promise<DeviceInfo> => {
    try {
      const info: DeviceInfo = {
        model: Device.modelName || 'Unknown',
        brand: Device.brand || 'Unknown',
        os_version: Device.osVersion || 'Unknown',
        platform: Platform.OS,
        screen_resolution: `${Constants.screenDimensions?.width}x${Constants.screenDimensions?.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: Constants.locales?.[0]?.languageCode || 'en',
        unique_id: Constants.sessionId || '',
        debug_enabled: __DEV__,
        is_emulator: !Device.isDevice,
        api_level: Platform.OS === 'android' ? Platform.Version : undefined,
      };

      // Add app signature (in production, get from native modules)
      info.app_signature = await getAppSignature();

      return info;
    } catch (error) {
      console.error('Device info collection error:', error);
      return {};
    }
  };

  const getAppSignature = async (): Promise<string> => {
    try {
      // In production, implement native modules to get app signature
      // For demo purposes, use app version
      const version = Application.nativeApplicationVersion || '1.0.0';
      const buildNumber = Application.nativeBuildVersion || '1';
      return `${version}_${buildNumber}`;
    } catch (error) {
      return 'unknown_signature';
    }
  };

  const fetchSecurityPolicies = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/mobile/security/policies`);
      const data = await response.json();
      
      if (data.success) {
        setSecurityPolicies(data.policies);
      }
    } catch (error) {
      console.error('Fetch security policies error:', error);
    }
  };

  const fetchCertificatePins = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/mobile/certificate/pins`);
      const data = await response.json();
      
      if (data.success) {
        setCertificatePins(data.certificate_pins);
        // In production, configure certificate pinning in HTTP client
        configureCertificatePinning(data.certificate_pins);
      }
    } catch (error) {
      console.error('Fetch certificate pins error:', error);
    }
  };

  const configureCertificatePinning = (pins: any) => {
    // In production, configure HTTP client with certificate pinning
    console.log('Certificate pins configured:', pins);
  };

  const registerOrCheckDevice = async (deviceData: DeviceInfo) => {
    setIsRegistering(true);
    
    try {
      // TODO: Add authentication token
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/mobile/device/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${authToken}` // Add auth token
        },
        body: JSON.stringify({
          device_info: deviceData
        })
      });

      const data = await response.json();

      if (data.success) {
        const status: SecurityStatus = {
          device_id: data.device_id,
          risk_level: data.risk_level,
          is_trusted: data.is_trusted,
          security_score: data.security_status?.security_score || 0,
          violations: []
        };

        setSecurityStatus(status);
        onSecurityStatusChange?.(status);

        // Handle security warnings
        if (data.risk_level === 'high' || data.risk_level === 'critical') {
          showSecurityWarning(data);
        }

        // Perform periodic security checks
        startPeriodicSecurityChecks(data.device_id);

      } else {
        throw new Error(data.error || 'Device registration failed');
      }

    } catch (error) {
      console.error('Device registration error:', error);
      Alert.alert('Security Warning', 'Device security check failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const showSecurityWarning = (data: any) => {
    const warnings = data.risk_assessment?.risk_factors || [];
    const warningText = warnings.join('\n');

    Alert.alert(
      'Security Warning',
      `Device security issues detected:\n\n${warningText}`,
      [
        { text: 'Continue', style: 'default' },
        { text: 'Security Tips', onPress: showSecurityTips }
      ]
    );
  };

  const showSecurityTips = () => {
    Alert.alert(
      'Security Tips',
      '• Keep your device OS updated\n' +
      '• Only install apps from official stores\n' +
      '• Avoid using the app on jailbroken/rooted devices\n' +
      '• Use secure networks for transactions\n' +
      '• Enable device lock screen protection',
      [{ text: 'OK' }]
    );
  };

  const startPeriodicSecurityChecks = (deviceId: string) => {
    // Perform security checks every 5 minutes
    setInterval(async () => {
      await performSecurityCheck(deviceId);
    }, 5 * 60 * 1000);
  };

  const performSecurityCheck = async (deviceId: string) => {
    try {
      // Check for runtime threats
      const threats = await detectRuntimeThreats();
      
      if (threats.length > 0) {
        // Report security violations
        for (const threat of threats) {
          await reportSecurityViolation(deviceId, threat);
        }
      }

    } catch (error) {
      console.error('Security check error:', error);
    }
  };

  const detectRuntimeThreats = async (): Promise<string[]> => {
    const threats: string[] = [];

    try {
      // Check if debugger is attached (in production, use native modules)
      if (__DEV__) {
        // In debug mode, this would be detected
        // threats.push('debugger');
      }

      // Check for emulator (basic check)
      if (!Device.isDevice) {
        threats.push('emulator');
      }

      // Check for jailbreak/root indicators
      if (await checkJailbreakRoot()) {
        threats.push(Platform.OS === 'ios' ? 'jailbreak' : 'root');
      }

      return threats;
    } catch (error) {
      console.error('Threat detection error:', error);
      return [];
    }
  };

  const checkJailbreakRoot = async (): Promise<boolean> => {
    try {
      // Basic emulator/development environment check
      // In production, implement proper jailbreak/root detection
      return !Device.isDevice || __DEV__;
    } catch (error) {
      return false;
    }
  };

  const reportSecurityViolation = async (deviceId: string, violationType: string) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/mobile/security/violation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${authToken}` // Add auth token
        },
        body: JSON.stringify({
          device_id: deviceId,
          violation_type: violationType,
          details: {
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
            app_version: Application.nativeApplicationVersion
          }
        })
      });

      const data = await response.json();

      if (data.success && data.severity === 'critical') {
        Alert.alert(
          'Security Alert',
          'Critical security violation detected. Please ensure your device is secure.',
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Security violation reporting error:', error);
    }
  };

  const getRiskLevelColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'low': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'high': return '#FF5722';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getSecurityScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    if (score >= 40) return '#FF5722';
    return '#F44336';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mobile Security Status</Text>
      </View>

      {isRegistering ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Checking device security...</Text>
        </View>
      ) : securityStatus ? (
        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <Text style={styles.cardTitle}>Device Status</Text>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Device ID:</Text>
              <Text style={styles.value}>{securityStatus.device_id.substring(0, 8)}...</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Risk Level:</Text>
              <Text style={[styles.value, { color: getRiskLevelColor(securityStatus.risk_level) }]}>
                {securityStatus.risk_level.toUpperCase()}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Trusted:</Text>
              <Text style={[styles.value, { color: securityStatus.is_trusted ? '#4CAF50' : '#F44336' }]}>
                {securityStatus.is_trusted ? 'YES' : 'NO'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Security Score:</Text>
              <Text style={[styles.value, { color: getSecurityScoreColor(securityStatus.security_score) }]}>
                {securityStatus.security_score}%
              </Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.cardTitle}>Device Information</Text>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Model:</Text>
              <Text style={styles.value}>{deviceInfo.model}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Platform:</Text>
              <Text style={styles.value}>{deviceInfo.platform} {deviceInfo.os_version}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Is Device:</Text>
              <Text style={styles.value}>{Device.isDevice ? 'Physical' : 'Emulator'}</Text>
            </View>
          </View>

          {securityPolicies && (
            <View style={styles.statusCard}>
              <Text style={styles.cardTitle}>Security Policies</Text>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Jailbreak/Root:</Text>
                <Text style={styles.value}>
                  {securityPolicies.allow_jailbroken_devices ? 'Allowed' : 'Blocked'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Emulators:</Text>
                <Text style={styles.value}>
                  {securityPolicies.allow_emulators ? 'Allowed' : 'Blocked'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Certificate Pinning:</Text>
                <Text style={styles.value}>
                  {securityPolicies.certificate_pinning_required ? 'Required' : 'Optional'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => initializeMobileSecurity()}
            >
              <Text style={styles.actionButtonText}>Refresh Security Status</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.infoButton]} 
              onPress={showSecurityTips}
            >
              <Text style={styles.actionButtonText}>Security Tips</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Security status not available</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={initializeMobileSecurity}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statusContainer: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  actionContainer: {
    marginTop: 16,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    marginBottom: 12,
  },
  infoButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MobileSecurity;