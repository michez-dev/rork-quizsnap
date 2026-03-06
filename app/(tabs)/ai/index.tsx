import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Send, ImagePlus, X, Bot, User, Sparkles, BookOpen, Camera } from 'lucide-react-native';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { useQuiz } from '@/providers/QuizProvider';
import { parseTextToQuestions } from '@/utils/text-parser';
import { extractQuizFromImages } from '@/utils/quiz-ai-extraction';
import Colors from '@/constants/colors';

interface AttachedImage {
  uri: string;
  base64?: string;
  mimeType: string;
  width?: number;
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AIAssistantScreen() {
  const router = useRouter();
  const { setPendingQuestions, setPendingTitle, setPendingSource } = useQuiz();
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastSentImagesRef = useRef<AttachedImage[]>([]);
  const lastSentPromptRef = useRef('');

  const SYSTEM_PROMPT = `You are a quiz extraction and creation assistant.

When the user message includes attached screenshots or photos of quiz questions, you MUST call extractQuizFromImages immediately.
- Do not manually transcribe the screenshot yourself.
- Do not ask follow-up questions about symbols or markers.
- The tool handles question extraction, option separation, correct-answer detection, and image cropping.

When the user asks you to create or generate a brand new quiz without screenshots, you MUST generate the quiz and call createQuizFromText.

Use createQuizFromText only for text-based quiz generation or when the user directly provides quiz text.

For generated quiz text, always use this exact format:
1. Question text here
A) First option
B) Second option
C) Third option
D) Fourth option
Answer: B

2. Next question text
A) Option
B) Option
C) Option
D) Option
Answer: A

When math appears, write it in LaTeX with $...$ delimiters.
When the user is just chatting and not asking to create a quiz, answer normally.`;

  const { messages, error, sendMessage, setMessages } = useRorkAgent({
    // @ts-expect-error system prompt passed through to transport body
    system: SYSTEM_PROMPT,
    tools: {
      extractQuizFromImages: createRorkTool({
        description: 'Extract a quiz directly from the currently attached screenshots or photos. Use this whenever the user sends quiz images.',
        zodSchema: z.object({
          title: z.string().optional().describe('Optional short title for the extracted quiz'),
        }),
        async execute(toolInput) {
          const sourceImages = lastSentImagesRef.current;
          console.log('extractQuizFromImages tool called:', {
            imageCount: sourceImages.length,
            title: toolInput.title,
            prompt: lastSentPromptRef.current,
          });

          if (sourceImages.length === 0) {
            return 'No screenshots are currently attached. Ask the user to attach quiz images and try again.';
          }

          const extraction = await extractQuizFromImages({
            assets: sourceImages,
            fallbackTitle: toolInput.title?.trim() || 'Image Quiz',
            userHint: lastSentPromptRef.current,
          });

          if (extraction.questions.length === 0) {
            return extraction.warnings[0] ?? 'I could not detect any quiz questions in the attached screenshots.';
          }

          setPendingQuestions(extraction.questions);
          setPendingTitle(extraction.title);
          setPendingSource(`AI Assistant (${sourceImages.length} image${sourceImages.length > 1 ? 's' : ''})`);

          setTimeout(() => {
            router.push('/preview-editor' as any);
          }, 500);

          const imageCount = extraction.questions.filter(question => Boolean(question.imageUri && question.imageRegion)).length;
          const warnings = extraction.warnings.length > 0
            ? `\nWarnings: ${extraction.warnings.join(', ')}`
            : '';
          const imageNote = imageCount > 0
            ? `\n${imageCount} question image crop(s) were detected and attached.`
            : '';

          return `Successfully extracted ${extraction.questions.length} questions for "${extraction.title}". Redirecting to the preview editor where you can review and save them.${imageNote}${warnings}`;
        },
      }),
      createQuizFromText: createRorkTool({
        description: 'Create a quiz from provided or generated text. Pass quiz text in numbered format with options and answers. Math expressions must use LaTeX with $...$ delimiters.',
        zodSchema: z.object({
          title: z.string().describe('Title for the quiz set'),
          quizText: z.string().describe('The quiz text in numbered format with options and answers.'),
        }),
        execute(toolInput) {
          console.log('createQuizFromText tool called:', toolInput.title);
          console.log('Quiz text length:', toolInput.quizText.length);
          const result = parseTextToQuestions(toolInput.quizText);
          console.log('Parsed questions:', result.questions.length, 'warnings:', result.warnings.length);

          if (result.questions.length === 0) {
            return 'Could not parse any questions from the text. Please provide questions in numbered format (1. Question text) with options (A) Option) and answers (Answer: A).';
          }

          setPendingQuestions(result.questions);
          setPendingTitle(toolInput.title);
          setPendingSource('AI Assistant');

          setTimeout(() => {
            router.push('/preview-editor' as any);
          }, 500);

          const warnings = result.warnings.length > 0
            ? `\nWarnings: ${result.warnings.join(', ')}`
            : '';

          return `Successfully parsed ${result.questions.length} questions for "${toolInput.title}". Redirecting to the preview editor where you can review and save them.${warnings}`;
        },
      }),
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    setIsPickingImage(true);
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
          setIsPickingImage(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          base64: true,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          base64: true,
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 4,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newImages: AttachedImage[] = result.assets.map(asset => ({
          uri: asset.uri,
          base64: asset.base64 ?? undefined,
          mimeType: asset.mimeType ?? 'image/jpeg',
          width: asset.width,
          height: asset.height,
        }));
        setAttachedImages(prev => [...prev, ...newImages].slice(0, 4));
      }
    } catch (e) {
      console.log('Error picking image:', e);
    }
    setIsPickingImage(false);
  }, []);

  const removeImage = useCallback((index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && attachedImages.length === 0) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const validImages = attachedImages.filter(img => img.base64);
    const files = validImages.map(img => ({
      type: 'file' as const,
      mediaType: img.mimeType,
      url: `data:${img.mimeType};base64,${img.base64}`,
    }));

    if (validImages.length > 0) {
      lastSentImagesRef.current = validImages;
    }
    lastSentPromptRef.current = text;

    const messageText = text || 'Please extract the quiz questions from these screenshots and create a quiz.';

    if (files.length > 0) {
      sendMessage({ text: messageText, files });
    } else {
      sendMessage(messageText);
    }

    setInput('');
    setAttachedImages([]);
  }, [input, attachedImages, sendMessage]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear the conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMessages([]);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [setMessages]);

  const isStreaming = messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant' &&
    messages[messages.length - 1].parts.some(
      (p: any) => p.type === 'tool' && (p.state === 'input-streaming' || p.state === 'input-available')
    );

  const getToolStatusText = useCallback((toolName: string) => {
    switch (toolName) {
      case 'extractQuizFromImages': return 'Extracting quiz from screenshots...';
      case 'createQuizFromText': return 'Creating quiz...';
      default: return `Running ${toolName}...`;
    }
  }, []);

  const renderMessage = useCallback(({ item: m }: { item: typeof messages[0] }) => {
    const isUser = m.role === 'user';

    return (
      <View style={[styles.messageBubbleRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <View style={styles.botAvatar}>
              <Sparkles color="#fff" size={14} />
            </View>
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {m.parts.map((part: any, i: number) => {
            switch (part.type) {
              case 'text':
                if (!part.text) return null;
                return (
                  <Text
                    key={`${m.id}-${i}`}
                    style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}
                    selectable
                  >
                    {part.text}
                  </Text>
                );
              case 'file':
                if (part.mimeType?.startsWith('image/')) {
                  return (
                    <View key={`${m.id}-${i}`} style={styles.messageImageContainer}>
                      <Image
                        source={{ uri: part.uri || part.url }}
                        style={styles.messageImage}
                        contentFit="cover"
                      />
                    </View>
                  );
                }
                return null;
              case 'tool':
                const toolName = part.toolName;
                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return (
                      <View key={`${m.id}-${i}`} style={styles.toolCallContainer}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.toolCallText}>
                          {getToolStatusText(toolName)}
                        </Text>
                      </View>
                    );
                  case 'output-available':
                    return (
                      <View key={`${m.id}-${i}`} style={styles.toolResultContainer}>
                        <BookOpen color={Colors.success} size={16} />
                        <Text style={styles.toolResultText}>
                          {typeof part.output === 'string' ? part.output : JSON.stringify(part.output)}
                        </Text>
                      </View>
                    );
                  case 'output-error':
                    return (
                      <View key={`${m.id}-${i}`} style={styles.toolErrorContainer}>
                        <Text style={styles.toolErrorText}>Error: {part.errorText}</Text>
                      </View>
                    );
                  default:
                    return null;
                }
              default:
                return null;
            }
          })}
        </View>
        {isUser && (
          <View style={styles.avatarContainer}>
            <View style={styles.userAvatar}>
              <User color="#fff" size={14} />
            </View>
          </View>
        )}
      </View>
    );
  }, [getToolStatusText]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconOuter}>
        <Animated.View style={[styles.emptyIconInner, { opacity: pulseAnim }]}>
          <Bot color={Colors.primary} size={40} />
        </Animated.View>
      </View>
      <Text style={styles.emptyTitle}>Quiz AI Assistant</Text>
      <Text style={styles.emptySubtitle}>
        Send a photo of quiz questions and I'll extract them into a quiz you can study. You can also ask me questions!
      </Text>
      <View style={styles.suggestionsContainer}>
        <TouchableOpacity
          style={styles.suggestionChip}
          onPress={() => {
            setInput('Extract questions from this image and create a quiz');
            void pickImage('library');
          }}
          activeOpacity={0.7}
        >
          <ImagePlus color={Colors.primary} size={14} />
          <Text style={styles.suggestionText}>Scan a quiz photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.suggestionChip}
          onPress={() => {
            setInput('Take a photo of my quiz and create questions from it');
            void pickImage('camera');
          }}
          activeOpacity={0.7}
        >
          <Camera color={Colors.primary} size={14} />
          <Text style={styles.suggestionText}>Take a photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.suggestionChip}
          onPress={() => {
            setInput('Create a 10-question multiple choice quiz about world history');
          }}
          activeOpacity={0.7}
        >
          <Sparkles color={Colors.primary} size={14} />
          <Text style={styles.suggestionText}>Generate a quiz</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [pulseAnim, pickImage]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {messages.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClearChat} activeOpacity={0.7}>
          <Text style={styles.clearButtonText}>Clear chat</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.messagesListEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Something went wrong. Please try again.</Text>
        </View>
      )}

      {attachedImages.length > 0 && (
        <View style={styles.attachmentStrip}>
          {attachedImages.map((img, idx) => (
            <View key={idx} style={styles.attachmentThumb}>
              <Image source={{ uri: img.uri }} style={styles.attachmentImage} contentFit="cover" />
              <TouchableOpacity
                style={styles.attachmentRemove}
                onPress={() => removeImage(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color="#fff" size={12} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputBar}>
        <View style={styles.inputActions}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => pickImage('library')}
            disabled={isPickingImage}
            activeOpacity={0.7}
            testID="attach-image-btn"
          >
            <ImagePlus color={Colors.primary} size={22} />
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => pickImage('camera')}
              disabled={isPickingImage}
              activeOpacity={0.7}
              testID="camera-btn"
            >
              <Camera color={Colors.primary} size={22} />
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about quizzes or attach a photo..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={4000}
          testID="ai-input"
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() && attachedImages.length === 0) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={(!input.trim() && attachedImages.length === 0) || isStreaming}
          activeOpacity={0.7}
          testID="send-btn"
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send color="#fff" size={18} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  clearButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 20,
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 8,
  },
  messagesListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emptyIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginBottom: 2,
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.72,
    borderRadius: 18,
    padding: 12,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: Colors.text,
  },
  messageImageContainer: {
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  toolCallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  toolCallText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  toolResultContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.successLight,
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  toolResultText: {
    fontSize: 13,
    color: Colors.success,
    flex: 1,
    lineHeight: 18,
  },
  toolErrorContainer: {
    backgroundColor: Colors.errorLight,
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  toolErrorText: {
    fontSize: 13,
    color: Colors.error,
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  attachmentStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  attachmentThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 56,
    height: 56,
  },
  attachmentRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: 6,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 120,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
});
