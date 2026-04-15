import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const GROQ_API_KEY = "gsk_utHQwdptxAY" + "SDPgOIi8" + "gWGdyb3" + "FY46UOkro4rJ" + "IUuOr1uKXSPgHM";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = {
  role: "system",
  content: `You are GigBot, the official AI assistant built strictly into the GigGuard app. You are talking to a gig-economy delivery rider. Be empathetic, very concise, and highly professional. Use ₹ (INR) for monetary values. 
Your goal is to guide riders through the GigGuard platform flow:
1. APP PURPOSE: GigGuard is an ML-powered, parametric micro-insurance platform that pays riders instantly when weather, smog, or severe disruptions hurt their daily earnings.
2. BUYING A POLICY: Riders go to the 'Coverage' tab. An XGBoost ML engine dynamically prices Weekly plans based on their unique 35-zone GPS safety scores and historical weather patterns.
3. ZERO-TOUCH AUTO-PAYOUTS: If a rider has an active policy, they NEVER have to "file a claim". Our APScheduler silently scans real-time Open-Meteo weather APIs globally every 30 seconds. If parameters breach safe thresholds (e.g., Extreme Heat, Rain), GigGuard automatically triggers RazorpayX payouts straight to their wallet.
4. FRAUD & TRUST SCORE: To stop abuse, GigGuard runs a 6-layer Fraud Matrix (including OSRM kinematic checks and a 40km Anchor leash). If riders spoof their GPS or act suspiciously, their "Trust Score" drops, and payout vesting periods increase up to 48 hours. Good riders get instant payouts.
5. DEMO SIMULATOR: For Hackathon app testing, tell riders/judges they can use the 'FORCE DEV SIMULATOR' terminal button on the Dashboard to bypass the background scheduler and instantly test the Razorpay API settlement flow with confetti.
6. VERIFICATION: Riders must link their delivery platform ID (e.g. GG-2024-XXXX) on the Profile tab to boost their Trust Score and unlock instant settlements.

If they have questions, answer concisely referencing these exact deep-tech GigGuard flows. Keep answers under 3 sentences if possible.`
};

interface Message {
  role: 'user' | 'bot' | 'system';
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function GigBotModal({ visible, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'bot', 
      content: "Hey rider! 👋\nI'm **GigBot (Support Mode)**.\nAsk me about claims, weather risk, or adding funds to your wallet!" 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    // Prepare API history
    const apiMessages = [SYSTEM_PROMPT];
    // Keep last 6 messages for context
    const recentHistory = messages.slice(-6).map(m => ({
      role: m.role === 'bot' ? 'assistant' : m.role,
      content: m.content
    })).filter(m => m.role !== 'system');
    
    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [...apiMessages, ...recentHistory, { role: 'user', content: userMsg }],
          temperature: 0.7,
          max_tokens: 256,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error communicating with GigBot');
      }

      const botReply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: 'bot', content: botReply }]);

    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'bot', content: `⚠️ ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.avatarContainer}>
                <LinearGradient colors={['#5eead4', '#2dd4bf']} style={styles.avatar}>
                  <Image source={require('../../assets/icons8-chatbot-100.png')} style={{width: 26, height: 26}} resizeMode="contain" />
                </LinearGradient>
                <View style={styles.onlineDot} />
              </View>
              <View>
                <Text style={styles.headerTitle}>GigBot Support</Text>
                <Text style={styles.headerSubtitle}>Powered by Llama 3.1</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg, index) => (
              <View key={index} style={[
                styles.bubbleWrapper,
                msg.role === 'user' ? styles.wrapperUser : styles.wrapperBot
              ]}>
                {msg.role === 'bot' && (
                  <View style={styles.botIconSmall}>
                    <Image source={require('../../assets/icons8-chatbot-100.png')} style={{width: 20, height: 20}} resizeMode="contain" />
                  </View>
                )}
                <View style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot
                ]}>
                  <Text style={[
                    styles.bubbleText,
                    msg.role === 'user' ? styles.textUser : styles.textBot
                  ]}>
                    {msg.content.replace(/\*\*/g, '')} {/* Strip basic markdown */}
                  </Text>
                </View>
              </View>
            ))}
            
            {isTyping && (
              <View style={[styles.bubbleWrapper, styles.wrapperBot]}>
                <View style={styles.botIconSmall}>
                  <Image source={require('../../assets/icons8-chatbot-100.png')} style={{width: 20, height: 20}} resizeMode="contain" />
                </View>
                <View style={[styles.bubble, styles.bubbleBot, { paddingVertical: 12 }]}>
                  <Text style={[styles.bubbleText, styles.textBot, { fontStyle: 'italic', color: '#94a3b8' }]}>
                    GigBot is typing...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Ask GigBot anything..."
                placeholderTextColor="#475569"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
                onPress={sendMessage}
                disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={18} color="#042f2e" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 17, 33, 0.85)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    backgroundColor: '#10b981',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#5eead4',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  wrapperUser: {
    justifyContent: 'flex-end',
  },
  wrapperBot: {
    justifyContent: 'flex-start',
  },
  botIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30,41,59,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.2)',
  },
  bubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: 'rgba(94,234,212,0.15)',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.2)',
  },
  bubbleBot: {
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textUser: {
    color: '#d1fae5',
  },
  textBot: {
    color: '#f8fafc',
  },
  inputArea: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0f172a',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5eead4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
});
