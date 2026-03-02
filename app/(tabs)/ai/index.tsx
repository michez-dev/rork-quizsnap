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
import Colors from '@/constants/colors';

interface AttachedImage {
  uri: string;
  base64?: string;
  mimeType: string;
}

interface ImageMapEntry {
  questionNumber: number;
  questionText: string;
  spatialPosition: string;
  imageDescription: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const IMAGE_EDIT_URL = 'https://toolkit.rork.com/images/edit/';

export default function AIAssistantScreen() {
  const router = useRouter();
  const { setPendingQuestions, setPendingTitle, setPendingSource } = useQuiz();
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastSentImagesRef = useRef<string[]>([]);
  const extractedImagesRef = useRef<Record<number, string>>({});
  const imageMapRef = useRef<ImageMapEntry[]>([]);

  const SYSTEM_PROMPT = `You are a quiz extraction and creation assistant. You can extract quizzes from images AND generate new quizzes from scratch when asked.

When the user asks you to CREATE or GENERATE a quiz (e.g. "create a 10-question quiz about X", "make a quiz on Y"), you MUST:
1. Generate the questions yourself with 4 answer options (A, B, C, D) each
2. Include the correct answer for each question
3. Call the createQuizFromText tool with the generated quiz text

FORMAT for quiz text (this is critical - the parser needs this exact format):
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

CRITICAL RULES:
- Always include 4 options (A, B, C, D) for each question
- Always include "Answer: X" line after each question
- Number questions sequentially (1. 2. 3. etc.)
- When you encounter ANY mathematical expressions, formulas, equations, symbols, or notation, you MUST write them using LaTeX notation with dollar sign delimiters ($...$)
- Examples: "$x^2 + 3x - 5$", "$\\sqrt{x}$", "$\\frac{a}{b}$", "$\\int x \\, dx$", "$\\alpha$", "$x \\geq 5$", "$\\lim_{x \\to 0}$"
- This applies to ALL math content in question text AND answer choices

IMAGE EXTRACTION FROM SCREENSHOTS (VERY IMPORTANT - follow these steps exactly):
When extracting quizzes from screenshots that contain images/diagrams/figures/graphs:
1. FIRST call analyzeScreenshotImages to precisely map which questions have images and where they are spatially in the screenshot. This is MANDATORY before any extraction.
2. THEN call extractQuestionImage for EACH question that has an image, ONE AT A TIME, using the spatial data from the analysis step.
3. FINALLY call createQuizFromText with the quiz text and the list of question numbers that have images.

NEVER skip the analysis step. NEVER try to crop images without analyzing first.
The analysis step creates a precise spatial map that prevents image swapping between questions.
Process images strictly one at a time and in order from top to bottom of the screenshot.`;

  const { messages, error, sendMessage, setMessages } = useRorkAgent({
    // @ts-expect-error system prompt passed through to transport body
    system: SYSTEM_PROMPT,
    tools: {
      analyzeScreenshotImages: createRorkTool({
        description: 'STEP 1 (MANDATORY): Analyze a quiz screenshot to identify which questions contain images and their precise spatial locations. You MUST call this FIRST before extracting any images. This creates an accurate spatial map so images are correctly matched to questions and never swapped. Returns structured data about each image found.',
        zodSchema: z.object({
          imageIndex: z.number().describe('Index of the source screenshot (0-based)'),
          totalQuestions: z.number().describe('Total number of questions visible in the screenshot'),
          questionsWithImages: z.array(z.object({
            questionNumber: z.number().describe('The question number (1-based) that has an image'),
            questionTextSnippet: z.string().describe('First 60 characters of the question text, for verification'),
            spatialPosition: z.string().describe('Precise spatial position in the screenshot: e.g. "top-left quarter", "center-right between Q2 and Q3 text", "bottom third, left side"'),
            imageDescription: z.string().describe('Detailed visual description of what the image actually shows (e.g. "a right triangle with sides labeled a=3, b=4, c=5", "a bar chart with 4 bars showing population by decade", "a circuit diagram with 3 resistors in series"). Be very specific.'),
            verticalPosition: z.string().describe('Approximate vertical percentage range from top of screenshot: e.g. "10-25%" means the image is between 10% and 25% from the top'),
          })).describe('Array of questions that have accompanying images/diagrams/figures'),
        }),
        execute(toolInput) {
          console.log('analyzeScreenshotImages called:', JSON.stringify(toolInput, null, 2));
          const sourceImages = lastSentImagesRef.current;
          const idx = toolInput.imageIndex;

          if (idx < 0 || idx >= sourceImages.length) {
            return `Image index ${idx} is out of range. Available images: 0 to ${sourceImages.length - 1}.`;
          }

          const imageMap: ImageMapEntry[] = toolInput.questionsWithImages.map(q => ({
            questionNumber: q.questionNumber,
            questionText: q.questionTextSnippet,
            spatialPosition: `${q.spatialPosition} (vertical: ${q.verticalPosition})`,
            imageDescription: q.imageDescription,
          }));

          imageMapRef.current = imageMap;
          console.log('Image map created with', imageMap.length, 'entries');

          if (imageMap.length === 0) {
            return 'No images found in the screenshot. Proceed with text-only quiz creation using createQuizFromText.';
          }

          const summary = imageMap.map(m =>
            `Q${m.questionNumber}: "${m.questionText}" -> Image at ${m.spatialPosition}: ${m.imageDescription}`
          ).join('\n');

          return `Analysis complete. Found ${imageMap.length} image(s):\n${summary}\n\nNow call extractQuestionImage for EACH image listed above, one at a time, in order from top to bottom. Start with Q${imageMap[0].questionNumber}.`;
        },
      }),
      extractQuestionImage: createRorkTool({
        description: 'STEP 2: Extract a specific image from the screenshot for ONE question. Call this AFTER analyzeScreenshotImages, once per question that has an image. Process them one at a time, in order from top to bottom. The tool uses the spatial map from analysis to precisely locate the correct image.',
        zodSchema: z.object({
          imageIndex: z.number().describe('Index of the source screenshot (0-based)'),
          questionNumber: z.number().describe('The question number (1-based) this image belongs to'),
        }),
        async execute(toolInput) {
          console.log('extractQuestionImage called for question', toolInput.questionNumber);
          const sourceImages = lastSentImagesRef.current;
          const idx = toolInput.imageIndex;

          if (idx < 0 || idx >= sourceImages.length) {
            return `Image index ${idx} is out of range.`;
          }

          const mapEntry = imageMapRef.current.find(m => m.questionNumber === toolInput.questionNumber);
          if (!mapEntry) {
            return `No image mapping found for question ${toolInput.questionNumber}. Did you run analyzeScreenshotImages first?`;
          }

          try {
            const extractPrompt = [
              `TASK: You are looking at a quiz screenshot. Extract ONLY ONE specific image/diagram/figure from it.`,
              ``,
              `TARGET IMAGE DETAILS:`,
              `- Belongs to: Question ${mapEntry.questionNumber}`,
              `- Question text starts with: "${mapEntry.questionText}"`,
              `- Location in screenshot: ${mapEntry.spatialPosition}`,
              `- What the image shows: ${mapEntry.imageDescription}`,
              ``,
              `INSTRUCTIONS:`,
              `- Find the image/diagram/figure at the specified location in the screenshot`,
              `- Extract ONLY that specific image - nothing else`,
              `- Do NOT include any question text, numbers, or answer options`,
              `- Do NOT include images from other questions - ONLY the one at the specified position`,
              `- Do NOT generate or recreate the image - faithfully reproduce what exists in the screenshot`,
              `- Keep the extracted image on a clean white background`,
              `- Preserve all labels, markings, and details that are part of the diagram/figure`,
              `- The output should be ONLY the diagram/figure, cropped tightly`,
            ].join('\n');

            console.log('Extraction prompt for Q' + mapEntry.questionNumber + ':', extractPrompt.substring(0, 200) + '...');

            const response = await fetch(IMAGE_EDIT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: extractPrompt,
                images: [{ type: 'image', image: sourceImages[idx] }],
                aspectRatio: '1:1',
              }),
            });

            if (!response.ok) {
              console.log('Image edit API error:', response.status);
              return `Failed to extract image for Q${toolInput.questionNumber} (HTTP ${response.status}). Quiz will be created without this image.`;
            }

            const data = await response.json();
            const dataUri = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
            extractedImagesRef.current[toolInput.questionNumber] = dataUri;
            console.log('Successfully extracted image for question', toolInput.questionNumber);

            const remaining = imageMapRef.current.filter(
              m => m.questionNumber > toolInput.questionNumber && !extractedImagesRef.current[m.questionNumber]
            );
            const nextHint = remaining.length > 0
              ? ` Next: extract image for Q${remaining[0].questionNumber}.`
              : ' All images extracted. Now call createQuizFromText.';

            return `Successfully extracted image for Q${toolInput.questionNumber} (${mapEntry.imageDescription}).${nextHint}`;
          } catch (err) {
            console.log('Error extracting image:', err);
            return `Failed to extract image for Q${toolInput.questionNumber}: ${err instanceof Error ? err.message : 'Unknown error'}. Quiz will be created without this image.`;
          }
        },
      }),
      createQuizFromText: createRorkTool({
        description: 'STEP 3 (final): Create a quiz from extracted text. Use AFTER extracting all images (if any). Pass quiz text in numbered format. Math expressions MUST use LaTeX with $...$ delimiters.',
        zodSchema: z.object({
          title: z.string().describe('Title for the quiz set'),
          quizText: z.string().describe('The quiz text in numbered format with options and answers'),
          questionsWithImages: z.array(z.number()).describe('Array of question numbers (1-based) that have images. Leave empty [] if no questions have images.').optional(),
        }),
        execute(toolInput) {
          console.log('createQuizFromText tool called:', toolInput.title);
          const result = parseTextToQuestions(toolInput.quizText);
          console.log('Parsed questions:', result.questions.length, 'warnings:', result.warnings.length);

          if (result.questions.length === 0) {
            return 'Could not parse any questions from the text. Please provide questions in numbered format (1. Question text) with options (A) Option) and answers (Answer: A).';
          }

          const questionsWithImages = toolInput.questionsWithImages ?? [];
          let imagesAttached = 0;
          const questionsWithExtractedImages = result.questions.map((q, index) => {
            const qNum = index + 1;
            const extractedUri = extractedImagesRef.current[qNum];
            if (extractedUri && questionsWithImages.includes(qNum)) {
              imagesAttached++;
              return { ...q, imageUri: extractedUri };
            }
            return q;
          });

          setPendingQuestions(questionsWithExtractedImages);
          setPendingTitle(toolInput.title);
          setPendingSource('AI Assistant');

          extractedImagesRef.current = {};
          imageMapRef.current = [];

          setTimeout(() => {
            router.push('/preview-editor' as any);
          }, 500);

          const warnings = result.warnings.length > 0
            ? `\nWarnings: ${result.warnings.join(', ')}`
            : '';
          const imageNote = imagesAttached > 0
            ? `\n${imagesAttached} image(s) correctly attached to their questions.`
            : '';

          return `Successfully parsed ${result.questions.length} questions for "${toolInput.title}". Redirecting to the preview editor where you can review and save them.${imageNote}${warnings}`;
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
  }, []);

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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newImages: AttachedImage[] = result.assets.map(asset => ({
          uri: asset.uri,
          base64: asset.base64 ?? undefined,
          mimeType: asset.mimeType ?? 'image/jpeg',
        }));
        setAttachedImages(prev => [...prev, ...newImages].slice(0, 4));
      }
    } catch (e) {
      console.log('Error picking image:', e);
    }
    setIsPickingImage(false);
  }, []);

  const removeImage = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && attachedImages.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const validImages = attachedImages.filter(img => img.base64);
    const files = validImages.map(img => ({
      type: 'file' as const,
      mediaType: img.mimeType,
      url: `data:${img.mimeType};base64,${img.base64}`,
    }));

    if (validImages.length > 0) {
      lastSentImagesRef.current = validImages.map(img => img.base64 as string);
      extractedImagesRef.current = {};
      imageMapRef.current = [];
    }

    const messageText = text || 'Please extract the quiz questions from this image and convert them to text format. IMPORTANT: Any mathematical expressions, formulas, equations, or symbols must be written in LaTeX format using $...$ delimiters (e.g. $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$). If any questions contain images (diagrams, figures, graphs, photos), first call analyzeScreenshotImages to map their exact positions, then extractQuestionImage for each one individually, and finally createQuizFromText.';

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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      case 'analyzeScreenshotImages': return 'Analyzing screenshot layout...';
      case 'extractQuestionImage': return 'Extracting image...';
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
            pickImage('library');
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
            pickImage('camera');
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
