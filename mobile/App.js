import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  Alert
} from 'react-native';
import {
  fetchMobileModels,
  sendMobileMessage,
  mobileLoginApi,
  mobileRegisterApi,
  mobileFetchSuperAdminCredentials,
  DEFAULT_MOBILE_SERVER,
  FALLBACK_MODELS
} from './src/services/api';

export default function App() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_MOBILE_SERVER);

  // Auth State
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [superAdminInfo, setSuperAdminInfo] = useState({
    email: 'admin@namogpt.com',
    password: 'Admin@NamoGPT2026!',
    role: 'superadmin',
    name: 'Super Admin'
  });

  // Modals
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const flatListRef = useRef(null);

  // Fetch models and superadmin info on mount
  useEffect(() => {
    fetchMobileModels(serverUrl).then(setModels);
    mobileFetchSuperAdminCredentials(serverUrl).then(info => {
      if (info) setSuperAdminInfo(info);
    });
  }, [serverUrl]);

  async function handleSend() {
    if (!inputPrompt.trim() || isLoading) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');

    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const outgoing = newMessages.map(m => ({ role: m.role, content: m.content }));
      const reply = await sendMobileMessage({
        messages: outgoing,
        model: selectedModel,
        serverUrl,
        token
      });

      setMessages(prev => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          content: reply
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Failed to get response: ${err.message || 'Check your server connection or API keys in .env.'}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAuthSubmit() {
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const res = await mobileLoginApi(serverUrl, {
          email: authEmail,
          password: authPassword
        });
        setToken(res.token);
        setUser(res.user);
        setIsAuthModalOpen(false);
      } else {
        const res = await mobileRegisterApi(serverUrl, {
          name: authName,
          email: authEmail,
          password: authPassword
        });
        setToken(res.token);
        setUser(res.user);
        setIsAuthModalOpen(false);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleDemoAdminLogin() {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await mobileLoginApi(serverUrl, {
        email: superAdminInfo.email,
        password: superAdminInfo.password
      });
      setToken(res.token);
      setUser(res.user);
      setIsAuthModalOpen(false);
    } catch (err) {
      setAuthError(err.message || 'Super Admin demo login failed');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setToken(null);
    setIsSettingsModalOpen(false);
  }

  function handleNewChat() {
    setMessages([]);
  }

  const currentModelObj = models.find(m => m.id === selectedModel) || models[0];
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#171717" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setIsSettingsModalOpen(true)}
          style={styles.headerIconButton}
        >
          <Text style={styles.headerIconText}>⚙️</Text>
        </TouchableOpacity>

        {/* Model Selector Pill */}
        <TouchableOpacity
          onPress={() => setIsModelModalOpen(true)}
          style={styles.modelPill}
        >
          <Text style={styles.modelPillTitle} numberOfLines={1}>
            {currentModelObj.name}
          </Text>
          <View style={styles.modelBadge}>
            <Text style={styles.modelBadgeText}>{currentModelObj.badge || 'Free'}</Text>
          </View>
          <Text style={styles.modelArrow}>▼</Text>
        </TouchableOpacity>

        {/* Auth Profile / Login Button */}
        {user ? (
          <TouchableOpacity
            onPress={() => setIsSettingsModalOpen(true)}
            style={styles.avatarButton}
          >
            {isSuperAdmin && <Text style={styles.crownSmall}>👑</Text>}
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setIsAuthModalOpen(true)}
            style={styles.loginPillButton}
          >
            <Text style={styles.loginPillText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages or Empty State */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.chatContainer}
      >
        {messages.length === 0 ? (
          <ScrollView
            contentContainerStyle={[
              styles.emptyContainer,
              { maxWidth: isTablet ? 600 : '100%' }
            ]}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>✨</Text>
            </View>
            <Text style={styles.welcomeTitle}>NamoGPT</Text>
            <Text style={styles.welcomeSubtitle}>
              Multi-model AI assistant powered by LiteLLM Proxy.
            </Text>

            {user && (
              <View style={styles.userBadgeCard}>
                <Text style={styles.userBadgeText}>
                  {isSuperAdmin ? '👑 Logged in as Super Admin' : `👤 Logged in as ${user.name}`}
                </Text>
              </View>
            )}

            <View style={styles.promptsGrid}>
              {[
                "🚀 Build a fullstack web app architecture",
                "🧠 Explain quantum computing simply",
                "💻 Python performance optimization tricks",
                "✍️ Draft an executive project summary"
              ].map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setInputPrompt(p)}
                  style={styles.promptCard}
                >
                  <Text style={styles.promptText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.assistantRow
                  ]}
                >
                  {!isUser && (
                    <View style={styles.botAvatar}>
                      <Text style={styles.botAvatarText}>✨</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                      { maxWidth: isTablet ? '70%' : '85%' }
                    ]}
                  >
                    <Text style={styles.messageContent}>{item.content}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#10a37f" />
            <Text style={styles.loadingText}>NamoGPT is thinking...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <View style={[styles.inputCard, { maxWidth: isTablet ? 700 : '100%' }]}>
            <TextInput
              style={styles.input}
              value={inputPrompt}
              onChangeText={setInputPrompt}
              placeholder="Message NamoGPT..."
              placeholderTextColor="#888"
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputPrompt.trim() || isLoading}
              style={[
                styles.sendButton,
                inputPrompt.trim() && !isLoading ? styles.sendActive : styles.sendDisabled
              ]}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Model Picker Modal */}
      <Modal
        visible={isModelModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModelModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: height * 0.8, maxWidth: isTablet ? 500 : '100%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose AI Model</Text>
              <TouchableOpacity onPress={() => setIsModelModalOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modelListScroll}>
              {models.map(m => {
                const isSelected = m.id === selectedModel;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setSelectedModel(m.id);
                      setIsModelModalOpen(false);
                    }}
                    style={[
                      styles.modelCard,
                      isSelected && styles.modelCardSelected
                    ]}
                  >
                    <View style={styles.modelCardHeader}>
                      <Text style={styles.modelCardName}>{m.name}</Text>
                      <Text style={styles.modelCardBadge}>{m.badge || 'Free'}</Text>
                    </View>
                    <Text style={styles.modelCardDesc}>{m.description}</Text>
                    <Text style={styles.modelCardMeta}>{m.provider} • {m.speed}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Auth Modal (Login / Register / 1-Click Super Admin) */}
      <Modal
        visible={isAuthModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAuthModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: height * 0.85, maxWidth: isTablet ? 450 : '100%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {authMode === 'login' ? 'Sign In to NamoGPT' : 'Create Account'}
              </Text>
              <TouchableOpacity onPress={() => setIsAuthModalOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.authScroll}>
              {/* Quick Super Admin Demo Card */}
              <View style={styles.adminBanner}>
                <Text style={styles.adminBannerTitle}>👑 Super Admin (Demo)</Text>
                <Text style={styles.adminBannerSubtitle}>
                  Instant access to run all models using keys in .env
                </Text>
                <TouchableOpacity
                  onPress={handleDemoAdminLogin}
                  disabled={authLoading}
                  style={styles.adminDemoBtn}
                >
                  <Text style={styles.adminDemoBtnText}>
                    {authLoading ? 'Signing in...' : '1-Click Login as Super Admin'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Mode Toggle */}
              <View style={styles.authToggle}>
                <TouchableOpacity
                  onPress={() => setAuthMode('login')}
                  style={[styles.authToggleBtn, authMode === 'login' && styles.authToggleActive]}
                >
                  <Text style={[styles.authToggleText, authMode === 'login' && styles.authToggleTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAuthMode('register')}
                  style={[styles.authToggleBtn, authMode === 'register' && styles.authToggleActive]}
                >
                  <Text style={[styles.authToggleText, authMode === 'register' && styles.authToggleTextActive]}>
                    Register
                  </Text>
                </TouchableOpacity>
              </View>

              {authError ? (
                <Text style={styles.authErrorText}>{authError}</Text>
              ) : null}

              {authMode === 'register' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={authName}
                    onChangeText={setAuthName}
                    placeholder="Your Name"
                    placeholderTextColor="#666"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Password</Text>
                <TextInput
                  style={styles.formInput}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                onPress={handleAuthSubmit}
                disabled={authLoading}
                style={styles.authSubmitBtn}
              >
                <Text style={styles.authSubmitText}>
                  {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={isSettingsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSettingsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: isTablet ? 500 : '100%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>App Settings</Text>
              <TouchableOpacity onPress={() => setIsSettingsModalOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsBody}>
              {user && (
                <View style={styles.userProfileSection}>
                  <Text style={styles.userProfileName}>{user.name}</Text>
                  <Text style={styles.userProfileEmail}>{user.email}</Text>
                  <Text style={styles.userProfileRole}>Role: {user.role}</Text>
                  <TouchableOpacity
                    onPress={handleLogout}
                    style={styles.logoutBtn}
                  >
                    <Text style={styles.logoutBtnText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.settingsLabel}>LiteLLM Proxy Server URL</Text>
              <TextInput
                style={styles.settingsInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://10.0.2.2:3001"
                placeholderTextColor="#777"
                autoCapitalize="none"
              />
              <Text style={styles.settingsHint}>
                For Android Emulator use http://10.0.2.2:3001. For physical phone use your machine's LAN IP e.g. http://192.168.1.50:3001
              </Text>

              <TouchableOpacity
                onPress={handleNewChat}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Clear Messages</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsSettingsModalOpen(false)}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Done</Text>
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
    backgroundColor: '#171717'
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#2b2b2b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#171717'
  },
  headerIconButton: {
    padding: 8
  },
  headerIconText: {
    fontSize: 18
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    maxWidth: '55%'
  },
  modelPillTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  modelBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  modelBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600'
  },
  modelArrow: {
    color: '#888',
    fontSize: 10
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  crownSmall: {
    fontSize: 12
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userAvatarText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14
  },
  loginPillButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14
  },
  loginPillText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold'
  },
  chatContainer: {
    flex: 1
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    alignSelf: 'center',
    width: '100%'
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  logoEmoji: {
    fontSize: 24
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6
  },
  welcomeSubtitle: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20
  },
  userBadgeCard: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 20
  },
  userBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600'
  },
  promptsGrid: {
    width: '100%',
    gap: 10
  },
  promptCard: {
    backgroundColor: '#212121',
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 12,
    padding: 12
  },
  promptText: {
    color: '#ccc',
    fontSize: 13
  },
  messageList: {
    padding: 16,
    gap: 16
  },
  messageRow: {
    flexDirection: 'row',
    gap: 10
  },
  userRow: {
    justifyContent: 'flex-end'
  },
  assistantRow: {
    justifyContent: 'flex-start'
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  botAvatarText: {
    fontSize: 12
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16
  },
  userBubble: {
    backgroundColor: '#2f2f2f'
  },
  assistantBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0
  },
  messageContent: {
    color: '#eee',
    fontSize: 14,
    lineHeight: 20
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8
  },
  loadingText: {
    color: '#888',
    fontSize: 12
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2b2b2b',
    backgroundColor: '#171717',
    alignItems: 'center'
  },
  inputCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333'
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 6
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  sendActive: {
    backgroundColor: '#fff'
  },
  sendDisabled: {
    backgroundColor: '#404040'
  },
  sendIcon: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  modalClose: {
    color: '#888',
    fontSize: 18,
    padding: 4
  },
  modelListScroll: {
    maxHeight: 350
  },
  modelCard: {
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333'
  },
  modelCardSelected: {
    borderColor: '#10a37f',
    backgroundColor: '#1a2e26'
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  modelCardName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  modelCardBadge: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(52,211,153,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  modelCardDesc: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4
  },
  modelCardMeta: {
    color: '#777',
    fontSize: 11
  },
  authScroll: {
    maxHeight: 450
  },
  adminBanner: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  adminBannerTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: 'bold'
  },
  adminBannerSubtitle: {
    color: '#bbb',
    fontSize: 11,
    marginVertical: 4
  },
  adminDemoBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6
  },
  adminDemoBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12
  },
  authToggle: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16
  },
  authToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8
  },
  authToggleActive: {
    backgroundColor: '#333'
  },
  authToggleText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600'
  },
  authToggleTextActive: {
    color: '#fff'
  },
  authErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center'
  },
  formGroup: {
    marginBottom: 12
  },
  formLabel: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4
  },
  formInput: {
    backgroundColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#383838'
  },
  authSubmitBtn: {
    backgroundColor: '#10a37f',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  },
  authSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13
  },
  settingsBody: {
    gap: 12
  },
  userProfileSection: {
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6
  },
  userProfileName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  userProfileEmail: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2
  },
  userProfileRole: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 4
  },
  logoutBtn: {
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600'
  },
  settingsLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  settingsInput: {
    backgroundColor: '#262626',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#383838'
  },
  settingsHint: {
    color: '#888',
    fontSize: 11,
    lineHeight: 16
  },
  clearBtn: {
    paddingVertical: 8,
    alignItems: 'center'
  },
  clearBtnText: {
    color: '#f87171',
    fontSize: 12
  },
  saveButton: {
    backgroundColor: '#10a37f',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  }
});
