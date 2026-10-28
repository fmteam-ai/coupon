import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useTranslation, useRTLStyle } from '../contexts/LanguageContext';

const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface VoiceResult {
  success: boolean;
  intent: string;
  response: string;
  voice_response: string;
  data: any[];
  count?: number;
  error?: string;
}

interface VoiceAssistantProps {
  onDealFound?: (deals: any[]) => void;
  onClose?: () => void;
  compact?: boolean;
}

export default function VoiceAssistant({ 
  onDealFound, 
  onClose, 
  compact = false 
}: VoiceAssistantProps) {
  const t = useTranslation();
  const { isRTL, getTextAlign, getFlexDirection } = useRTLStyle();

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [lastResult, setLastResult] = useState<VoiceResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeVoice();
    loadSuggestions();
    
    return () => {
      Voice.destroy();
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isListening]);

  const initializeVoice = async () => {
    try {
      Voice.onSpeechStart = onSpeechStart;
      Voice.onSpeechRecognized = onSpeechRecognized;
      Voice.onSpeechEnd = onSpeechEnd;
      Voice.onSpeechError = onSpeechError;
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechPartialResults = onSpeechPartialResults;
    } catch (error) {
      console.error('Voice initialization error:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${EXPO_BACKEND_URL}/api/voice/suggestions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Wave animation
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      })
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    waveAnim.stopAnimation();
    pulseAnim.setValue(1);
    waveAnim.setValue(0);
  };

  const onSpeechStart = () => {
    console.log('Speech started');
  };

  const onSpeechRecognized = () => {
    console.log('Speech recognized');
  };

  const onSpeechEnd = () => {
    console.log('Speech ended');
    setIsListening(false);
  };

  const onSpeechError = (error: any) => {
    console.error('Speech error:', error);
    setIsListening(false);
    Alert.alert('Voice Error', 'Could not recognize speech. Please try again.');
  };

  const onSpeechResults = (event: any) => {
    const text = event.value[0];
    setVoiceText(text);
    processVoiceCommand(text);
  };

  const onSpeechPartialResults = (event: any) => {
    const text = event.value[0];
    setVoiceText(text);
  };

  const startListening = async () => {
    try {
      setVoiceText('');
      setIsListening(true);
      await Voice.start('en-US'); // Could be dynamically set based on user's language
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setIsListening(false);
      Alert.alert('Voice Error', 'Could not start voice recognition');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const processVoiceCommand = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    
    try {
      // Get user location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const locationData = await Location.getCurrentPositionAsync({});
          location = {
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude
          };
        }
      } catch (locError) {
        console.log('Location not available:', locError);
      }

      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert('Authentication Required', 'Please log in to use voice commands');
        return;
      }

      const response = await fetch(`${EXPO_BACKEND_URL}/api/voice/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          voice_text: text,
          location: location
        })
      });

      if (response.ok) {
        const result = await response.json();
        setLastResult(result);
        
        // Speak the response
        if (result.voice_response) {
          speakResponse(result.voice_response);
        }

        // If deals were found, notify parent component
        if (result.data && result.data.length > 0 && onDealFound) {
          onDealFound(result.data);
        }

        // Show results modal for detailed view
        setShowModal(true);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to process voice command');
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      Alert.alert('Error', 'Failed to process voice command');
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'en-US', // Could be dynamic based on user's language
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleSuggestionPress = (suggestion: string) => {
    setVoiceText(suggestion);
    processVoiceCommand(suggestion);
  };

  const renderCompactView = () => (
    <TouchableOpacity
      style={[styles.compactButton, isListening && styles.listeningButton]}
      onPress={isListening ? stopListening : startListening}
      disabled={isProcessing}
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        {isProcessing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons 
            name={isListening ? "mic" : "mic-outline"} 
            size={24} 
            color="#fff" 
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );

  const renderFullView = () => (
    <View style={[styles.container, isRTL && styles.rtlContainer]}>
      {/* Voice Button */}
      <TouchableOpacity
        style={[styles.voiceButton, isListening && styles.listeningButton]}
        onPress={isListening ? stopListening : startListening}
        disabled={isProcessing}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          {isProcessing ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons 
              name={isListening ? "mic" : "mic-outline"} 
              size={48} 
              color="#fff" 
            />
          )}
        </Animated.View>
        
        {/* Wave animation during listening */}
        {isListening && (
          <Animated.View 
            style={[
              styles.waveRing,
              {
                opacity: waveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 0],
                }),
                transform: [{
                  scale: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2],
                  }),
                }],
              }
            ]}
          />
        )}
      </TouchableOpacity>

      {/* Status Text */}
      <Text style={[styles.statusText, { textAlign: getTextAlign('center') }]}>
        {isProcessing 
          ? 'Processing your request...' 
          : isListening 
            ? 'Listening... Say something!'
            : 'Tap to start voice search'
        }
      </Text>

      {/* Voice Text Display */}
      {voiceText ? (
        <View style={styles.voiceTextContainer}>
          <Text style={[styles.voiceText, { textAlign: getTextAlign('center') }]}>
            "{voiceText}"
          </Text>
        </View>
      ) : null}

      {/* Suggestions */}
      {suggestions.length > 0 && !isListening && !isProcessing && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsTitle, { textAlign: getTextAlign('left') }]}>
            Try saying:
          </Text>
          {suggestions.slice(0, 3).map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionButton}
              onPress={() => handleSuggestionPress(suggestion)}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#007AFF" />
              <Text style={[styles.suggestionText, { textAlign: getTextAlign('left') }]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Close Button */}
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <>
      {compact ? renderCompactView() : renderFullView()}
      
      {/* Results Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { flexDirection: getFlexDirection('row') }]}>
            <Text style={[styles.modalTitle, { textAlign: getTextAlign('left') }]}>
              Voice Search Results
            </Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {lastResult && (
              <>
                {/* Response */}
                <View style={styles.responseContainer}>
                  <Text style={[styles.responseText, { textAlign: getTextAlign('left') }]}>
                    {lastResult.response}
                  </Text>
                  
                  {isSpeaking && (
                    <TouchableOpacity
                      style={styles.speakingIndicator}
                      onPress={() => Speech.stop()}
                    >
                      <Ionicons name="volume-high" size={20} color="#007AFF" />
                      <Text style={styles.speakingText}>Speaking...</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Results */}
                {lastResult.data && lastResult.data.length > 0 && (
                  <View style={styles.resultsContainer}>
                    <Text style={[styles.resultsTitle, { textAlign: getTextAlign('left') }]}>
                      Found {lastResult.count || lastResult.data.length} deals:
                    </Text>
                    
                    {lastResult.data.slice(0, 5).map((deal, index) => (
                      <View key={deal.id || index} style={styles.dealItem}>
                        <View style={styles.dealHeader}>
                          <Text style={[styles.dealTitle, { textAlign: getTextAlign('left') }]}>
                            {deal.title}
                          </Text>
                          <Text style={styles.dealValue}>
                            {deal.discount_type === 'percentage' 
                              ? `${deal.discount_value}% OFF`
                              : `$${deal.discount_value} OFF`
                            }
                          </Text>
                        </View>
                        
                        <Text style={[styles.dealBusiness, { textAlign: getTextAlign('left') }]}>
                          {deal.business?.name}
                        </Text>
                        
                        {deal.description && (
                          <Text style={[styles.dealDescription, { textAlign: getTextAlign('left') }]}>
                            {deal.description}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  rtlContainer: {
    // RTL specific styles if needed
  },
  voiceButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  listeningButton: {
    backgroundColor: '#34C759',
  },
  waveRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#34C759',
  },
  compactButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 16,
    fontWeight: '500',
  },
  voiceTextContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    minWidth: 200,
  },
  voiceText: {
    fontSize: 16,
    color: '#333',
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    width: '100%',
    marginTop: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  suggestionText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  responseContainer: {
    backgroundColor: '#f0f7ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  responseText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 6,
  },
  speakingText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  resultsContainer: {
    marginTop: 10,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  dealItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  dealValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34C759',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dealBusiness: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dealDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});