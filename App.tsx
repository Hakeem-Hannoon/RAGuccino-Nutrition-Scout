import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type DimensionValue,
} from "react-native";
import type { ChatMessage, ChatResponse, HealthResponse } from "./src/lib/types";

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_RAG_API_URL || "http://localhost:8787";

const starterMessages: ChatMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content:
      "Drop a food, drink, or nutrition question. I will search the cosmos, bring receipts, and keep the macro math grounded.",
  },
];

const QUICK_PROMPTS = [
  "What are the nutrition facts for Starbucks summer drinks?",
  "Is this latte bulking or cutting?",
  "Protein check, no cap: Greek yogurt vs cottage cheese",
  "Cosmic brownie macro math",
];

const STAR_FIELD = Array.from({ length: 90 }, (_, index) => ({
  id: `star-${index}`,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 7) % 100}%`,
  size: 1 + (index % 3),
  opacity: 0.16 + (index % 5) * 0.11,
}));

function trimUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function nowId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("What are the nutrition facts for Starbucks summer drinks?");
  const [webEnabled, setWebEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { width } = useWindowDimensions();

  const isWide = width >= 940;
  const apiBase = useMemo(() => trimUrl(apiUrl), [apiUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadHealth() {
      try {
        const res = await fetch(`${apiBase}/health`);
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth(null);
      }
    }
    loadHealth();
    const id = setInterval(loadHealth, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apiBase]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const userMessage: ChatMessage = { id: nowId("user"), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webSearchEnabled: webEnabled,
          messages: nextMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ChatResponse;
      setMessages((current) => [
        ...current,
        {
          id: nowId("assistant"),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          retrievalSummary: `${data.retrieval.provider} · ${data.retrieval.fetchedPages} pages · ${data.retrieval.fdcMatches} FDC matches`,
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: nowId("assistant"),
          role: "assistant",
          content:
            err instanceof Error
              ? `I could not reach the RAG API. Check that the local server is running and the API URL is correct.\n\n${err.message}`
              : "I could not reach the RAG API.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function applyPrompt(prompt: string) {
    setInput(prompt);
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        <View style={[styles.avatar, isUser ? styles.userAvatar : styles.assistantAvatar]}>
          <Text style={[styles.avatarText, isUser ? styles.userAvatarText : styles.assistantAvatarText]}>
            {isUser ? "U" : "R"}
          </Text>
        </View>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {item.content}
          </Text>
          {item.retrievalSummary ? <Text style={styles.retrievalText}>{item.retrievalSummary}</Text> : null}
          {item.citations?.length ? (
            <View style={styles.citations}>
              {item.citations.map((citation) => (
                <Pressable
                  key={citation.id}
                  style={styles.citation}
                  onPress={() => Linking.openURL(citation.url)}
                >
                  <View style={styles.citationIcon}>
                    <Ionicons name="link" size={14} color="#67E8F9" />
                  </View>
                  <View style={styles.citationBody}>
                    <Text style={styles.citationTitle} numberOfLines={2}>
                      {citation.title}
                    </Text>
                    <Text style={styles.citationSnippet} numberOfLines={3}>
                      {citation.snippet}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  const healthTone = health?.modelConfigured && health.searchConfigured ? "#A3E635" : "#F59E0B";
  const healthText = health
    ? `${health.modelConfigured ? health.modelName : "model key missing"} · ${
        health.searchConfigured ? health.searchProvider : "search key missing"
      }`
    : "API offline";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.spaceLayer}>
        {STAR_FIELD.map((star) => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                top: star.top as DimensionValue,
                left: star.left as DimensionValue,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>
      <KeyboardAvoidingView
        style={[styles.shell, isWide && styles.shellWide]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {isWide ? (
          <View style={styles.rail}>
            <View style={styles.railBrand}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>R</Text>
              </View>
              <View>
                <Text style={styles.railTitle}>RAGuccino</Text>
                <Text style={styles.railSubtitle}>meme fuel · space facts</Text>
              </View>
            </View>

            <View style={styles.railSection}>
              <Text style={styles.railLabel}>Prompt Launchpad</Text>
              {QUICK_PROMPTS.map((prompt) => (
                <Pressable key={prompt} style={styles.railPrompt} onPress={() => applyPrompt(prompt)}>
                  <Ionicons name="sparkles-outline" size={15} color="#F0ABFC" />
                  <Text style={styles.railPromptText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.railFooter}>
              <Text style={styles.railFooterText}>Starbucks seasonality defense system</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.chatPanel, isWide && styles.chatPanelWide]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>RAGuccino Nutrition Scout</Text>
              <Text style={styles.subtitle}>retrieval with citation receipts</Text>
            </View>
            <View style={[styles.statusPill, { borderColor: healthTone }]}>
              <View style={[styles.statusDot, { backgroundColor: healthTone }]} />
              <Text style={styles.statusText} numberOfLines={1}>
                {healthText}
              </Text>
            </View>
          </View>

          {!isWide ? (
            <View style={styles.promptStrip}>
              {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                <Pressable key={prompt} style={styles.promptChip} onPress={() => applyPrompt(prompt)}>
                  <Text style={styles.promptChipText} numberOfLines={1}>
                    {prompt}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.configRow}>
            <Ionicons name="server-outline" size={18} color="#94A3B8" />
            <TextInput
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.apiInput}
              placeholder="http://localhost:8787"
              placeholderTextColor="#71717A"
            />
            <Pressable
              style={[styles.webToggle, webEnabled && styles.webToggleOn]}
              onPress={() => setWebEnabled((value) => !value)}
            >
              <Ionicons
                name={webEnabled ? "globe" : "globe-outline"}
                size={16}
                color={webEnabled ? "#050505" : "#D4D4D8"}
              />
              <Text style={[styles.webToggleText, webEnabled && styles.webToggleTextOn]}>Web RAG</Text>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.list}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
          />

          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              multiline
              style={styles.composerInput}
              placeholder="Ask about a food, drink, or nutrition question..."
              placeholderTextColor="#71717A"
              returnKeyType="send"
            />
            <Pressable
              style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
              onPress={send}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color="#050505" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={22} color="#050505" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  spaceLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#050505",
    pointerEvents: "none",
  },
  star: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#E4E4E7",
  },
  shell: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shellWide: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  rail: {
    width: 300,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "rgba(12, 12, 14, 0.92)",
    padding: 16,
  },
  railBrand: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#A3E635",
  },
  brandMarkText: {
    color: "#050505",
    fontSize: 22,
    fontWeight: "900",
  },
  railTitle: {
    color: "#FAFAFA",
    fontSize: 20,
    fontWeight: "900",
  },
  railSubtitle: {
    marginTop: 2,
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
  },
  railSection: {
    marginTop: 28,
    gap: 10,
  },
  railLabel: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  railPrompt: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "#111113",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  railPromptText: {
    flex: 1,
    color: "#E4E4E7",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  railFooter: {
    marginTop: "auto",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3F3F46",
    backgroundColor: "#18181B",
    padding: 12,
  },
  railFooterText: {
    color: "#FDE68A",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  chatPanel: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "rgba(9, 9, 11, 0.94)",
    overflow: "hidden",
  },
  chatPanelWide: {
    maxWidth: 1040,
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#FAFAFA",
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 3,
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
  },
  statusPill: {
    maxWidth: 220,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: "#111113",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 11,
    color: "#D4D4D8",
    fontWeight: "800",
  },
  promptStrip: {
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptChip: {
    flex: 1,
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3F3F46",
    backgroundColor: "#18181B",
    paddingHorizontal: 10,
  },
  promptChipText: {
    color: "#E4E4E7",
    fontSize: 11,
    fontWeight: "800",
  },
  configRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
    paddingHorizontal: 16,
    backgroundColor: "#0B0B0D",
  },
  apiInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "#111113",
    paddingHorizontal: 10,
    color: "#FAFAFA",
    fontSize: 13,
    fontWeight: "700",
  },
  webToggle: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3F3F46",
    paddingHorizontal: 12,
    backgroundColor: "#18181B",
  },
  webToggleOn: {
    backgroundColor: "#A3E635",
    borderColor: "#A3E635",
  },
  webToggleText: {
    color: "#D4D4D8",
    fontSize: 12,
    fontWeight: "900",
  },
  webToggleTextOn: {
    color: "#050505",
  },
  list: {
    flex: 1,
  },
  messages: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  messageRowUser: {
    flexDirection: "row-reverse",
  },
  messageRowAssistant: {
    flexDirection: "row",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  userAvatar: {
    backgroundColor: "#FB7185",
    borderColor: "#FDA4AF",
  },
  assistantAvatar: {
    backgroundColor: "#22D3EE",
    borderColor: "#67E8F9",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "900",
  },
  userAvatarText: {
    color: "#050505",
  },
  assistantAvatarText: {
    color: "#050505",
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 8,
    padding: 13,
  },
  userBubble: {
    backgroundColor: "#3B0A18",
    borderWidth: 1,
    borderColor: "#FB7185",
  },
  assistantBubble: {
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#FFE4E6",
    fontWeight: "700",
  },
  assistantText: {
    color: "#F4F4F5",
  },
  retrievalText: {
    marginTop: 10,
    color: "#A3E635",
    fontSize: 11,
    fontWeight: "900",
  },
  citations: {
    marginTop: 12,
    gap: 8,
  },
  citation: {
    minHeight: 66,
    flexDirection: "row",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#164E63",
    padding: 10,
    backgroundColor: "#082F49",
  },
  citationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E7490",
  },
  citationBody: {
    flex: 1,
  },
  citationTitle: {
    color: "#ECFEFF",
    fontSize: 12,
    fontWeight: "900",
  },
  citationSnippet: {
    marginTop: 3,
    color: "#CFFAFE",
    fontSize: 11,
    lineHeight: 15,
  },
  composer: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#27272A",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  composerInput: {
    flex: 1,
    minHeight: 50,
    maxHeight: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3F3F46",
    backgroundColor: "#18181B",
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: "#FAFAFA",
    fontSize: 15,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#A3E635",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
