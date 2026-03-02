import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { FileUp, Type, FileText, ArrowRight, AlertTriangle, Sparkles, Brain, Camera, Image as ImageIcon, Link } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import { parseTextToQuestions } from '@/utils/text-parser';
import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import Colors from '@/constants/colors';

type UploadMethod = 'pdf' | 'paste' | 'image' | 'shared' | null;

async function readFileContent(uri: string, mimeType?: string): Promise<{ text: string | null; base64: string | null }> {
  const isTextType = mimeType === 'text/plain' || uri.endsWith('.txt');
  console.log('readFileContent called:', { uri: uri.substring(0, 100), mimeType, isTextType, platform: Platform.OS });

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      console.log('Web blob size:', blob.size, 'type:', blob.type);
      if (isTextType) {
        const text = await blob.text();
        if (text && text.length > 0) {
          console.log('Web: read text, length:', text.length);
          return { text, base64: null };
        }
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const b64 = result.split(',')[1] ?? '';
          console.log('Web: read base64, length:', b64.length);
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (base64 && base64.length > 0) {
        return { text: null, base64 };
      }
      return { text: null, base64: null };
    } catch (e) {
      console.log('Web file read error:', e);
      return { text: null, base64: null };
    }
  }

  try {
    const FileSystemLegacy = await import('expo-file-system/legacy');
    if (isTextType) {
      const text = await FileSystemLegacy.readAsStringAsync(uri, { encoding: 'utf8' });
      console.log('Native: read text via legacy API, length:', text.length);
      if (text && text.length > 0) {
        return { text, base64: null };
      }
    }
    const base64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: FileSystemLegacy.EncodingType.Base64 });
    console.log('Native: read base64 via legacy API, length:', base64.length);
    if (base64 && base64.length > 0) {
      return { text: null, base64 };
    }
    return { text: null, base64: null };
  } catch (legacyError) {
    console.log('Native legacy file read error:', legacyError);
  }

  try {
    const { File: ExpoFile } = await import('expo-file-system');
    const file = new ExpoFile(uri);
    if (isTextType) {
      const text = await file.text();
      console.log('Native: read text via new File API, length:', text.length);
      return { text, base64: null };
    }
    const base64 = await file.base64();
    console.log('Native: read base64 via new File API, length:', base64.length);
    return { text: null, base64 };
  } catch (e) {
    console.log('Native new File API error:', e);
    return { text: null, base64: null };
  }
}

const parsedQuestionSchema = z.object({
  questions: z.array(z.object({
    text: z.string().describe('The exact question text from the PDF'),
    options: z.array(z.string()).describe('Answer options exactly as written in the PDF'),
    correctAnswers: z.array(z.string()).describe('The correct answer(s) exactly as written. Can be multiple for multi-select questions.'),
    type: z.enum(['multiple-choice', 'multiple-select', 'true-false', 'short-answer']).describe('Question type'),
  })),
  title: z.string().describe('A suggested title for the quiz based on PDF content'),
  warnings: z.array(z.string()).describe('Any issues found during parsing, like missing answers or ambiguous questions'),
});

export default function UploadScreen() {
  const router = useRouter();
  const { setPendingQuestions, setPendingTitle, setPendingSource, importQuizSets, isImporting } = useQuiz();
  const [method, setMethod] = useState<UploadMethod>(null);
  const [pastedText, setPastedText] = useState('');
  const [title, setTitle] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiProgress, setAiProgress] = useState('');
  const [sharedText, setSharedText] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const AI_PROMPT = `Extract all questions, answer options, and correct answers from this document.

RULES:
- Preserve the EXACT original wording of the content. Do not rephrase, improve, or create new content.
- IMPORTANT: Strip leading option letters/numbers from the answer text. The options array should contain ONLY the answer text, NOT the letter prefix. For example if the document says "A) Paris" or "A. Paris" or "a) Paris", the option should be just "Paris". Similarly "1) Paris" should become "Paris". The letter/number is just a label and must be removed. The correctAnswers must also contain ONLY the answer text without any letter prefix.
- If a question has multiple correct answers, list all of them in correctAnswers array.
- If correct answers cannot be determined, leave correctAnswers empty and add a warning.
- Detect question type: multiple-choice (single correct), multiple-select (multiple correct), true-false, or short-answer.
- If there is an answer key at the end (e.g. "1. A", "2. B,C"), map those answers to the questions by matching the letter to the corresponding option text. The correctAnswers should contain the actual option TEXT, not the letter.
- Include any parsing issues in warnings.
- IMPORTANT: If any question or answer option contains mathematical expressions, formulas, equations, fractions, exponents, roots, integrals, summations, Greek letters, or any math notation, wrap them in LaTeX delimiters using $...$ for inline math. For example: "x^2 + 3x - 5" should become "$x^2 + 3x - 5$", "sqrt(x)" should become "$\\sqrt{x}$", "a/b" in math context should become "$\\frac{a}{b}$", "alpha" as a Greek letter should become "$\\alpha$". Preserve the surrounding non-math text exactly as-is.`;

  const processAiResult = useCallback((parsed: z.infer<typeof parsedQuestionSchema>, fallbackTitle: string) => {
    if (!parsed.questions || parsed.questions.length === 0) {
      setIsAiParsing(false);
      setAiProgress('');
      setWarnings(parsed.warnings || ['No questions found in the document.']);
      Alert.alert(
        'No Questions Found',
        'The AI could not detect any questions. Try pasting the text manually.',
        [
          { text: 'Use Paste', onPress: () => setMethod('paste') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return false;
    }

    const questions = parsed.questions.map(q => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswers.length > 1
        ? q.correctAnswers
        : q.correctAnswers[0] ?? '',
      type: q.type as 'multiple-choice' | 'multiple-select' | 'true-false' | 'short-answer',
      verified: q.correctAnswers.length > 0,
    }));

    setWarnings(parsed.warnings || []);
    setPendingQuestions(questions);
    setPendingTitle(parsed.title || fallbackTitle || 'Untitled Quiz');
    return true;
  }, [setPendingQuestions, setPendingTitle]);

  const handlePickImage = useCallback(async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.9,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          base64: true,
          allowsMultipleSelection: true,
          selectionLimit: 10,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const assets = result.assets;
      const validAssets = assets.filter(a => a.base64 && a.base64.length > 0);

      if (validAssets.length === 0) {
        Alert.alert('Error', 'Could not read image data. Please try again.');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsAiParsing(true);
      const imageCount = validAssets.length;
      setAiProgress(`AI is analyzing ${imageCount} image${imageCount > 1 ? 's' : ''}...`);

      const imageContentParts = validAssets.map(asset => {
        const mimeType = asset.mimeType || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${asset.base64}`;
        console.log('Adding image to AI request, mime:', mimeType, 'base64 length:', asset.base64!.length);
        return { type: 'image' as const, image: dataUri };
      });

      try {
        const parsed = await generateObject({
          messages: [
            {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: `${AI_PROMPT}\n\nIMPORTANT: You are receiving ${imageCount} image(s). Extract ALL questions from ALL images and combine them into a single quiz. Process each image in order.` },
                ...imageContentParts,
              ],
            },
          ],
          schema: parsedQuestionSchema,
        });

        console.log('AI image parse result:', JSON.stringify(parsed, null, 2));

        if (processAiResult(parsed, title || 'Image Quiz')) {
          setPendingSource(`${imageCount} photo${imageCount > 1 ? 's' : ''} upload`);
          setIsAiParsing(false);
          setAiProgress('');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.push('/preview-editor' as any);
        }
      } catch (aiError) {
        console.log('AI image parsing error:', aiError);
        setIsAiParsing(false);
        setAiProgress('');
        Alert.alert(
          'AI Parsing Failed',
          'Could not extract questions from the image(s). Make sure the text is clearly visible and try again.',
          [{ text: 'OK', style: 'cancel' }]
        );
      }
    } catch (e) {
      console.log('Image picker error:', e);
      setIsAiParsing(false);
      setAiProgress('');
      Alert.alert('Error', 'Could not pick image. Please try again.');
    }
  }, [title, setPendingSource, processAiResult, router]);

  const handleAiParsePdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const fileName = file.name.replace(/\.\w+$/, '');
      setTitle(fileName);
      setPendingSource(file.name);
      setIsAiParsing(true);
      setAiProgress('Reading file...');

      const fileMime = file.mimeType || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
      const { text: fileText, base64: fileBase64 } = await readFileContent(file.uri, fileMime);

      if (!fileText && !fileBase64) {
        setIsAiParsing(false);
        setAiProgress('');
        Alert.alert(
          'Could not read file',
          'Unable to read the file contents. Try copying the text from your PDF and using the "Paste Text" option instead.',
          [
            { text: 'Use Paste', onPress: () => setMethod('paste') },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }

      setAiProgress('AI is extracting questions...');

      try {
        let messages: any[];
        if (fileText) {
          messages = [
            {
              role: 'user' as const,
              content: `${AI_PROMPT}\n\nDOCUMENT TEXT:\n${fileText}`,
            },
          ];
        } else if (fileBase64) {
          const imgMime = fileMime === 'application/pdf' ? 'application/pdf' : fileMime;
          const dataUri = `data:${imgMime};base64,${fileBase64}`;
          console.log('Sending file to AI as data URI, mime:', imgMime, 'base64 length:', fileBase64.length);
          messages = [
            {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: AI_PROMPT },
                { type: 'image' as const, image: dataUri },
              ],
            },
          ];
        } else {
          throw new Error('No file content available');
        }

        const parsed = await generateObject({
          messages,
          schema: parsedQuestionSchema,
        });

        console.log('AI parsed result:', JSON.stringify(parsed, null, 2));

        if (processAiResult(parsed, fileName)) {
          setIsAiParsing(false);
          setAiProgress('');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.push('/preview-editor' as any);
        }
      } catch (aiError) {
        console.log('AI parsing error:', aiError);
        setIsAiParsing(false);
        setAiProgress('');
        Alert.alert(
          'AI Parsing Failed',
          'Could not extract questions with AI. Try pasting the text content manually.',
          [
            { text: 'Use Paste', onPress: () => setMethod('paste') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    } catch (e) {
      console.log('Document picker error:', e);
      setIsAiParsing(false);
      setAiProgress('');
      Alert.alert('Error', 'Could not pick document. Please try again.');
    }
  }, [setPendingSource, setPendingQuestions, setPendingTitle, router, processAiResult]);

  const handleParseText = useCallback(() => {
    if (!pastedText.trim()) {
      Alert.alert('Empty', 'Please paste some text content first.');
      return;
    }

    setIsParsing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(() => {
      const result = parseTextToQuestions(pastedText);
      setIsParsing(false);

      if (result.questions.length === 0) {
        setWarnings(result.warnings);
        Alert.alert(
          'No Questions Found',
          'Could not detect question patterns in the text. Try using numbered format:\n\n1. Question text\nA) Option 1\nB) Option 2\nAnswer: A',
        );
        return;
      }

      setWarnings(result.warnings);
      setPendingQuestions(result.questions);
      setPendingTitle(title || 'Untitled Quiz');
      setPendingSource(title ? `${title}.txt` : 'Pasted text');

      router.push('/preview-editor' as any);
    }, 500);
  }, [pastedText, title, setPendingQuestions, setPendingTitle, setPendingSource, router]);

  const handleImportShared = useCallback(async () => {
    const trimmed = sharedText.trim();
    if (!trimmed) {
      Alert.alert('Empty', 'Please paste the shared quiz code.');
      return;
    }
    if (!trimmed.startsWith('QUIZSHARE:')) {
      Alert.alert('Invalid Format', 'This doesn\'t look like a shared quiz code. Make sure you copied the entire message.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await importQuizSets(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const count = result.length;
      Alert.alert(
        'Imported!',
        `Successfully imported ${count} quiz${count !== 1 ? 'zes' : ''}. You can find ${count !== 1 ? 'them' : 'it'} on the home screen.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      console.log('Import error:', e);
      Alert.alert('Import Failed', 'Could not import the quiz. The shared code may be corrupted or invalid.');
    }
  }, [sharedText, importQuizSets, router]);

  const handleAiParseText = useCallback(async () => {
    if (!pastedText.trim()) {
      Alert.alert('Empty', 'Please paste some text content first.');
      return;
    }

    setIsAiParsing(true);
    setAiProgress('AI is extracting questions...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const parsed = await generateObject({
        messages: [
          {
            role: 'user',
            content: `${AI_PROMPT}\n\nTEXT:\n${pastedText}`,
          },
        ],
        schema: parsedQuestionSchema,
      });

      console.log('AI parsed text result:', JSON.stringify(parsed, null, 2));

      if (processAiResult(parsed, title)) {
        setPendingSource(title ? `${title}.txt` : 'Pasted text');
        setIsAiParsing(false);
        setAiProgress('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push('/preview-editor' as any);
      }
    } catch (e) {
      console.log('AI text parsing error:', e);
      setIsAiParsing(false);
      setAiProgress('');
      Alert.alert('AI Parsing Failed', 'Could not extract questions. Try the standard parser.');
    }
  }, [pastedText, title, setPendingQuestions, setPendingTitle, setPendingSource, router, processAiResult]);

  if (isAiParsing) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Brain color={Colors.primary} size={32} style={styles.loadingIcon} />
          <Text style={styles.loadingTitle}>Processing Document</Text>
          <Text style={styles.loadingSubtext}>{aiProgress}</Text>
          <Text style={styles.loadingHint}>This may take a moment for large files</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Import Questions</Text>
        <Text style={styles.subheading}>
          Upload a PDF or paste text with questions and answers. AI extracts questions while preserving original content.
        </Text>

        {method === null && (
          <View style={styles.methodGrid}>
            <TouchableOpacity
              style={styles.methodCard}
              onPress={handleAiParsePdf}
              activeOpacity={0.7}
              testID="method-pdf"
            >
              <View style={[styles.methodIcon, { backgroundColor: Colors.accentLight }]}>
                <FileUp color={Colors.primary} size={28} />
              </View>
              <View style={styles.methodCardHeader}>
                <Text style={styles.methodTitle}>Upload PDF</Text>
                <View style={styles.aiBadge}>
                  <Sparkles color={Colors.surface} size={10} />
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              </View>
              <Text style={styles.methodDesc}>
                AI reads your PDF and extracts questions, options, and correct answers automatically
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => { setMethod('image'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.7}
              testID="method-image"
            >
              <View style={[styles.methodIcon, { backgroundColor: '#FFF7ED' }]}>
                <Camera color="#EA580C" size={28} />
              </View>
              <View style={styles.methodCardHeader}>
                <Text style={styles.methodTitle}>Upload Image</Text>
                <View style={styles.aiBadge}>
                  <Sparkles color={Colors.surface} size={10} />
                  <Text style={styles.aiBadgeText}>AI</Text>
                </View>
              </View>
              <Text style={styles.methodDesc}>
                Take a photo or pick a screenshot — AI reads the image and extracts questions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => { setMethod('paste'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.7}
              testID="method-paste"
            >
              <View style={[styles.methodIcon, { backgroundColor: '#F0FDF4' }]}>
                <Type color={Colors.success} size={28} />
              </View>
              <Text style={styles.methodTitle}>Paste Text</Text>
              <Text style={styles.methodDesc}>
                Paste copied text from your PDF — standard or AI parser
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => { setMethod('shared'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.7}
              testID="method-shared"
            >
              <View style={[styles.methodIcon, { backgroundColor: '#F5F3FF' }]}>
                <Link color="#7C3AED" size={28} />
              </View>
              <Text style={styles.methodTitle}>Import Shared Quiz</Text>
              <Text style={styles.methodDesc}>
                Paste a quiz code received from a friend to import their quiz
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {method === 'image' && (
          <View style={styles.imageSection}>
            <Text style={styles.inputLabel}>Quiz Title (optional)</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g. Biology Chapter 5"
              placeholderTextColor={Colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              testID="image-title-input"
            />

            <Text style={styles.imageSectionTitle}>Choose how to capture</Text>

            <TouchableOpacity
              style={styles.imageOptionCard}
              onPress={() => handlePickImage('camera')}
              activeOpacity={0.7}
              testID="image-camera"
            >
              <View style={[styles.imageOptionIcon, { backgroundColor: '#FFF1F2' }]}>
                <Camera color="#E11D48" size={24} />
              </View>
              <View style={styles.imageOptionText}>
                <Text style={styles.imageOptionTitle}>Take Photo</Text>
                <Text style={styles.imageOptionDesc}>Snap a photo of your quiz page</Text>
              </View>
              <ArrowRight color={Colors.textTertiary} size={18} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageOptionCard}
              onPress={() => handlePickImage('library')}
              activeOpacity={0.7}
              testID="image-library"
            >
              <View style={[styles.imageOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                <ImageIcon color="#2563EB" size={24} />
              </View>
              <View style={styles.imageOptionText}>
                <Text style={styles.imageOptionTitle}>Pick from Gallery</Text>
                <Text style={styles.imageOptionDesc}>Select up to 10 screenshots or images</Text>
              </View>
              <ArrowRight color={Colors.textTertiary} size={18} />
            </TouchableOpacity>

            <View style={styles.imageTips}>
              <AlertTriangle color={Colors.warning} size={16} />
              <Text style={styles.imageTipsText}>
                For best results: use clear, well-lit photos with readable text. You can select up to 10 images at once.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => { setMethod(null); setWarnings([]); }}
            >
              <Text style={styles.backLinkText}>← Choose different method</Text>
            </TouchableOpacity>
          </View>
        )}

        {method === 'shared' && (
          <View style={styles.pasteSection}>
            <Text style={styles.inputLabel}>Shared Quiz Code</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Paste the shared quiz code here (starts with QUIZSHARE:)..."
              placeholderTextColor={Colors.textTertiary}
              value={sharedText}
              onChangeText={setSharedText}
              multiline
              textAlignVertical="top"
              testID="shared-input"
            />

            <View style={styles.formatHint}>
              <Link color={Colors.textSecondary} size={16} />
              <Text style={styles.formatHintText}>
                Ask your friend to share a quiz from their app. They can tap the menu on any quiz and select "Share".
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.parseButton, styles.parseButtonAi, isImporting && styles.parseButtonDisabled, { marginTop: 20 }]}
              onPress={handleImportShared}
              disabled={isImporting}
              activeOpacity={0.8}
              testID="import-shared-button"
            >
              {isImporting ? (
                <ActivityIndicator color={Colors.surface} size="small" />
              ) : (
                <>
                  <Link color={Colors.surface} size={16} />
                  <Text style={styles.parseButtonTextAi}>Import Quiz</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => { setMethod(null); setSharedText(''); }}
            >
              <Text style={styles.backLinkText}>← Choose different method</Text>
            </TouchableOpacity>
          </View>
        )}

        {method === 'paste' && (
          <View style={styles.pasteSection}>
            <Text style={styles.inputLabel}>Quiz Title</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g. Biology Chapter 5"
              placeholderTextColor={Colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              testID="title-input"
            />

            <Text style={styles.inputLabel}>Paste Questions</Text>
            <TextInput
              style={styles.textArea}
              placeholder={"1. What is the capital of France?\nA) London\nB) Paris\nC) Berlin\nD) Madrid\nAnswer: B\n\n2. Which are prime numbers? (select all)\nA) 2\nB) 4\nC) 5\nD) 9\nAnswers: A, C"}
              placeholderTextColor={Colors.textTertiary}
              value={pastedText}
              onChangeText={setPastedText}
              multiline
              textAlignVertical="top"
              testID="paste-input"
            />

            <View style={styles.formatHint}>
              <FileText color={Colors.textSecondary} size={16} />
              <Text style={styles.formatHintText}>
                Supports numbered questions with lettered options. For multiple correct answers use: "Answers: A, C, D"
              </Text>
            </View>

            {warnings.length > 0 && (
              <View style={styles.warningsContainer}>
                {warnings.map((w, i) => (
                  <View key={i} style={styles.warningRow}>
                    <AlertTriangle color={Colors.warning} size={14} />
                    <Text style={styles.warningText}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.parseButtonsRow}>
              <TouchableOpacity
                style={[styles.parseButton, styles.parseButtonStandard, isParsing && styles.parseButtonDisabled]}
                onPress={handleParseText}
                disabled={isParsing || isAiParsing}
                activeOpacity={0.8}
                testID="parse-button"
              >
                {isParsing ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <>
                    <Text style={styles.parseButtonTextStandard}>Standard</Text>
                    <ArrowRight color={Colors.primary} size={16} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.parseButton, styles.parseButtonAi, isAiParsing && styles.parseButtonDisabled]}
                onPress={handleAiParseText}
                disabled={isParsing || isAiParsing}
                activeOpacity={0.8}
                testID="ai-parse-button"
              >
                {isAiParsing ? (
                  <ActivityIndicator color={Colors.surface} size="small" />
                ) : (
                  <>
                    <Sparkles color={Colors.surface} size={16} />
                    <Text style={styles.parseButtonTextAi}>AI Parse</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => { setMethod(null); setWarnings([]); }}
            >
              <Text style={styles.backLinkText}>← Choose different method</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingIcon: {
    marginTop: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
    marginTop: 8,
  },
  loadingHint: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  methodGrid: {
    gap: 14,
  },
  methodCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  methodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.surface,
  },
  methodDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  pasteSection: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  titleInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 220,
    lineHeight: 20,
  },
  formatHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  formatHintText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  warningsContainer: {
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  parseButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  parseButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  parseButtonStandard: {
    backgroundColor: Colors.accentLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  parseButtonAi: {
    backgroundColor: Colors.primary,
  },
  parseButtonDisabled: {
    opacity: 0.7,
  },
  parseButtonTextStandard: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  parseButtonTextAi: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backLinkText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  imageSection: {
    gap: 4,
  },
  imageSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  imageOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  imageOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  imageOptionText: {
    flex: 1,
  },
  imageOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  imageOptionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  imageTips: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  imageTipsText: {
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
    lineHeight: 18,
  },
});
