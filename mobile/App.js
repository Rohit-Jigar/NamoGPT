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
  StatusBar
} from 'react-native';
import {
  fetchMobileModels,
  sendMobileMessage,
  DEFAULT_MOBILE_SERVER,
  FALLBACK_MODELS
} from './src/services/api';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_MOBILE_SERVER);
  
  // Modals
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMobileModels(serverUrl).then(setModels);
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
        serverUrl
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
          content: `⚠️ Failed to get response: ${err.message || 'Check connection.'}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
  }

  const currentModelObj = models.find(m => m.id === selectedModel) || models[0];

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
          <Text style={styles.modelPillTitle}>{currentModelObj.name}</Text>
          <View style={styles.modelBadge}>
            <Text style={styles.modelBadgeText}>{currentModelObj.badge || 'Free'}</Text>
          </View>
          <Text style={styles.modelArrow}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNewChat}
          style={styles.headerIconButton}
        >
          <Text style={styles.headerIconText}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Messages or Empty State */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatContainer}
      >
        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>✨</Text>
            </View>
            <Text style={styles.welcomeTitle}>NamoGPT</Text>
            <Text style={styles.welcomeSubtitle}>
              Multi-model AI assistant powered by LiteLLM proxy.
            </Text>

            <View style={styles.promptsGrid}>
              {[
                "🚀 Build a fullstack web app",
                "🧠 Explain quantum physics simply",
                "💻 Python async performance tips",
                "✍️ Draft an executive summary"
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
                      isUser ? styles.userBubble : styles.assistantBubble
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
          <View style={styles.inputCard}>
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
          <View style={styles.modalContent}>
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

      {/* Settings Modal */}
      <Modal
        visible={isSettingsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSettingsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>App Settings</Text>
              <TouchableOpacity onPress={() => setIsSettingsModalOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsBody}>
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
                For Android Emulator use http://10.0.2.2:3001. For physical phone use your local IP e.g. http://192.168.1.50:3001
              </Text>

              <TouchableOpacity
                onPress={() => setIsSettingsModalOpen(false)}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Save & Close</Text>
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
    gap: 6
  },
  modelPillTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  modelBadge: {
    backgroundColor: 'rgba(16, 163, 127, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  modelBadgeText: {
    color: '#10a37f',
    fontSize: 10,
    fontWeight: '600'
  },
  modelArrow: {
    color: '#888',
    fontSize: 10
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#212121'
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 163, 127, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  logoEmoji: {
    fontSize: 28
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280
  },
  promptsGrid: {
    width: '100%',
    gap: 10
  },
  promptCard: {
    backgroundColor: '#171717',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#303030'
  },
  promptText: {
    color: '#ddd',
    fontSize: 13
  },
  messageList: {
    padding: 16,
    gap: 16
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4
  },
  userRow: {
    justifyContent: 'flex-end'
  },
  assistantRow: {
    justifyContent: 'flex-start'
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(16, 163, 127, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  botAvatarText: {
    fontSize: 14
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 18
  },
  userBubble: {
    backgroundColor: '#2f2f2f',
    borderTopRightRadius: 4
  },
  assistantBubble: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4
  },
  messageContent: {
    color: '#ececec',
    fontSize: 14,
    lineHeight: 22
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  loadingText: {
    color: '#10a37f',
    fontSize: 12
  },
  inputContainer: {
    padding: 12,
    backgroundColor: '#212121',
    borderTopWidth: 1,
    borderTopColor: '#303030'
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2f2f2f',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#383838'
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
    backgroundColor: '#444'
  },
  sendIcon: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#303030',
    paddingBottom: 12
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  modalClose: {
    color: '#999',
    fontSize: 18,
    padding: 4
  },
  modelListScroll: {
    gap: 8
  },
  modelCard: {
    backgroundColor: '#262626',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#383838'
  },
  modelCardSelected: {
    borderColor: '#10a37f',
    backgroundColor: 'rgba(16, 163, 127, 0.1)'
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
    fontWeight: '600'
  },
  modelCardBadge: {
    color: '#10a37f',
    fontSize: 11,
    fontWeight: '600'
  },
  modelCardDesc: {
    color: '#bbb',
    fontSize: 12,
    marginBottom: 4
  },
  modelCardMeta: {
    color: '#777',
    fontSize: 10
  },
  settingsBody: {
    gap: 12,
    paddingVertical: 8
  },
  settingsLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  settingsInput: {
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#383838',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 13
  },
  settingsHint: {
    color: '#777',
    fontSize: 11,
    lineHeight: 16
  },
  saveButton: {
    backgroundColor: '#10a37f',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
