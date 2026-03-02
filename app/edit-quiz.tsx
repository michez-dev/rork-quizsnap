import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import {
  Check,
  AlertTriangle,
  Trash2,
  Plus,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  X,
  Sparkles,
} from 'lucide-react-native';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useQuiz } from '@/providers/QuizProvider';
import { ParsedQuestion, QuestionType } from '@/types/quiz';
import Colors from '@/constants/colors';

const TYPE_LABELS: Record<QuestionType, string> = {
  'multiple-choice': 'Multiple Choice',
  'multiple-select': 'Multiple Select',
  'true-false': 'True / False',
  'short-answer': 'Short Answer',
};

const SWITCHABLE_TYPES: QuestionType[] = ['multiple-choice', 'multiple-select', 'true-false', 'short-answer'];

export default function EditQuizScreen() {
  const router = useRouter();
  const { quizSetId } = useLocalSearchParams<{ quizSetId: string }>();
  const {
    getQuestionsForSet,
    getQuizSetById,
    updateQuestionsForSet,
  } = useQuiz();

  const quizSet = useMemo(() => getQuizSetById(quizSetId ?? ''), [quizSetId, getQuizSetById]);
  const existingQuestions = useMemo(() => getQuestionsForSet(quizSetId ?? ''), [quizSetId, getQuestionsForSet]);

  const [questions, setQuestions] = useState<ParsedQuestion[]>(() =>
    existingQuestions.map(q => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      type: q.type,
      verified: q.verified,
      section: q.section,
      pageRef: q.pageRef,
      imageUri: q.imageUri,
    }))
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [convertingIndex, setConvertingIndex] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const unverifiedCount = questions.filter(q => !q.verified).length;

  const handleUpdateQuestion = useCallback((index: number, updates: Partial<ParsedQuestion>) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  }, []);

  const handleDeleteQuestion = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Question',
      'Are you sure you want to remove this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setQuestions(prev => prev.filter((_, i) => i !== index)),
        },
      ]
    );
  }, []);

  const handleAddQuestion = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newQ: ParsedQuestion = {
      text: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      type: 'multiple-choice',
      verified: false,
    };
    setQuestions(prev => [...prev, newQ]);
    setExpandedIndex(questions.length);
  }, [questions.length]);

  const handleToggleCorrectAnswer = useCallback((qIndex: number, option: string) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIndex];

      if (q.type === 'multiple-select') {
        const currentCorrect = Array.isArray(q.correctAnswer) ? [...q.correctAnswer] : q.correctAnswer ? [q.correctAnswer] : [];
        const existingIdx = currentCorrect.indexOf(option);
        if (existingIdx >= 0) {
          currentCorrect.splice(existingIdx, 1);
        } else {
          currentCorrect.push(option);
        }
        updated[qIndex] = {
          ...q,
          correctAnswer: currentCorrect.length > 0 ? currentCorrect : [],
          verified: currentCorrect.length > 0,
        };
      } else {
        updated[qIndex] = {
          ...q,
          correctAnswer: option,
          verified: true,
        };
      }
      return updated;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleChangeType = useCallback((qIndex: number, newType: QuestionType) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIndex];
      let newCorrectAnswer: string | string[] = q.correctAnswer;

      if (newType === 'multiple-select') {
        if (!Array.isArray(newCorrectAnswer)) {
          newCorrectAnswer = newCorrectAnswer ? [newCorrectAnswer] : [];
        }
      } else {
        if (Array.isArray(newCorrectAnswer)) {
          newCorrectAnswer = newCorrectAnswer[0] ?? '';
        }
      }

      if (newType === 'true-false') {
        updated[qIndex] = {
          ...q,
          type: newType,
          options: ['True', 'False'],
          correctAnswer: typeof newCorrectAnswer === 'string' ? newCorrectAnswer : '',
          verified: false,
        };
      } else {
        updated[qIndex] = {
          ...q,
          type: newType,
          correctAnswer: newCorrectAnswer,
        };
      }
      return updated;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleUpdateOption = useCallback((qIndex: number, optIndex: number, value: string) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIndex];
      const opts = [...q.options];
      const oldOpt = opts[optIndex];
      opts[optIndex] = value;

      let newCorrect = q.correctAnswer;
      if (Array.isArray(newCorrect)) {
        newCorrect = newCorrect.map(a => a === oldOpt ? value : a);
      } else if (newCorrect === oldOpt) {
        newCorrect = value;
      }

      updated[qIndex] = { ...q, options: opts, correctAnswer: newCorrect };
      return updated;
    });
  }, []);

  const handleAddOption = useCallback((qIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIndex];
      updated[qIndex] = { ...q, options: [...q.options, ''] };
      return updated;
    });
  }, []);

  const handleRemoveOption = useCallback((qIndex: number, optIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIndex];
      const removedOpt = q.options[optIndex];
      const opts = q.options.filter((_, i) => i !== optIndex);

      let newCorrect = q.correctAnswer;
      if (Array.isArray(newCorrect)) {
        newCorrect = newCorrect.filter(a => a !== removedOpt);
      } else if (newCorrect === removedOpt) {
        newCorrect = '';
      }

      updated[qIndex] = { ...q, options: opts, correctAnswer: newCorrect };
      return updated;
    });
  }, []);

  const handlePickImage = useCallback(async (qIndex: number) => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleUpdateQuestion(qIndex, { imageUri: result.assets[0].uri });
      }
    } catch (e) {
      console.log('Image picker error:', e);
      Alert.alert('Error', 'Could not pick image. Please try again.');
    }
  }, [handleUpdateQuestion]);

  const handleRemoveImage = useCallback((qIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleUpdateQuestion(qIndex, { imageUri: undefined });
  }, [handleUpdateQuestion]);

  const handleAiFormatMath = useCallback(async (qIndex: number) => {
    const q = questions[qIndex];
    if (!q) return;

    setConvertingIndex(qIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const LATEX_PROMPT = `Convert any mathematical expressions in the following text to LaTeX notation wrapped in $...$ delimiters for inline math.

RULES:
- Only convert mathematical expressions (formulas, equations, fractions, exponents, roots, integrals, summations, Greek letters, variables, etc.)
- Keep all non-math text EXACTLY as-is. Do not rephrase, rewrite, or add anything.
- Use $...$ for inline math, $$...$$ for display/block math (only if the entire line is a formula)
- Examples: "x^2 + 3x" → "$x^2 + 3x$", "sqrt(x)" → "$\\sqrt{x}$", "a/b" (math) → "$\\frac{a}{b}$", "alpha" (Greek) → "$\\alpha$"
- If the text already has correct LaTeX notation, leave it unchanged.
- If there is no math in the text, return the text unchanged.
- Return ONLY the converted text, nothing else.`;

    try {
      const allParts = [q.text, ...q.options];
      const combinedInput = allParts.map((part, i) => `[PART ${i}]: ${part}`).join('\n');

      const result = await generateText({
        messages: [
          {
            role: 'user',
            content: `${LATEX_PROMPT}\n\nConvert each part below. Return each part on a new line, prefixed with [PART N]: exactly as shown.\n\n${combinedInput}`,
          },
        ],
      });

      console.log('AI LaTeX result:', result);

      const partRegex = /\[PART (\d+)\]:\s*(.*)/g;
      const converted: Record<number, string> = {};
      let match;
      while ((match = partRegex.exec(result)) !== null) {
        converted[parseInt(match[1], 10)] = match[2].trim();
      }

      const newText = converted[0] ?? q.text;
      const newOptions = q.options.map((opt, i) => converted[i + 1] ?? opt);

      let newCorrectAnswer = q.correctAnswer;
      if (Array.isArray(q.correctAnswer)) {
        newCorrectAnswer = q.correctAnswer.map(ca => {
          const optIdx = q.options.indexOf(ca);
          return optIdx >= 0 ? newOptions[optIdx] : ca;
        });
      } else if (typeof q.correctAnswer === 'string') {
        const optIdx = q.options.indexOf(q.correctAnswer);
        if (optIdx >= 0) {
          newCorrectAnswer = newOptions[optIdx];
        }
      }

      handleUpdateQuestion(qIndex, {
        text: newText,
        options: newOptions,
        correctAnswer: newCorrectAnswer,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('AI LaTeX conversion error:', e);
      Alert.alert('Conversion Failed', 'Could not convert math expressions. Please try again.');
    } finally {
      setConvertingIndex(null);
    }
  }, [questions, handleUpdateQuestion]);

  const handleSave = useCallback(async () => {
    if (!quizSetId) return;

    if (questions.length === 0) {
      Alert.alert('No Questions', 'You need at least one question in the quiz.');
      return;
    }

    setIsSaving(true);
    try {
      await updateQuestionsForSet({ quizSetId, questions });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.log('Error saving quiz:', e);
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [quizSetId, questions, updateQuestionsForSet, router]);

  const isOptionCorrect = (q: ParsedQuestion, option: string): boolean => {
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer.includes(option);
    }
    return q.correctAnswer === option;
  };

  const getCorrectCountLabel = (q: ParsedQuestion): string => {
    if (q.type === 'multiple-select') {
      const count = Array.isArray(q.correctAnswer) ? q.correctAnswer.length : q.correctAnswer ? 1 : 0;
      return `${count} correct`;
    }
    return '';
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: `Edit: ${quizSet?.title ?? 'Quiz'}` }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statText}>{questions.length} questions</Text>
          </View>
          {unverifiedCount > 0 && (
            <View style={[styles.statBadge, { backgroundColor: Colors.warningLight }]}>
              <AlertTriangle color={Colors.warning} size={12} />
              <Text style={[styles.statText, { color: Colors.warning }]}>
                {unverifiedCount} unverified
              </Text>
            </View>
          )}
        </View>

        {questions.map((q, qIndex) => {
          const isExpanded = expandedIndex === qIndex;
          const isMultiSelect = q.type === 'multiple-select';
          return (
            <View key={qIndex} style={styles.questionCard}>
              <TouchableOpacity
                style={styles.questionHeader}
                onPress={() => setExpandedIndex(isExpanded ? null : qIndex)}
                activeOpacity={0.7}
              >
                <View style={styles.questionHeaderLeft}>
                  <View style={[
                    styles.qNumber,
                    !q.verified && styles.qNumberUnverified,
                  ]}>
                    {q.verified ? (
                      <CheckCircle color={Colors.success} size={16} />
                    ) : (
                      <AlertTriangle color={Colors.warning} size={16} />
                    )}
                  </View>
                  <View style={styles.questionHeaderText}>
                    <Text style={styles.questionPreview} numberOfLines={isExpanded ? undefined : 2}>
                      {q.text || 'New question (tap to edit)'}
                    </Text>
                    <View style={styles.typeBadgeRow}>
                      <Text style={styles.questionType}>{TYPE_LABELS[q.type]}</Text>
                      {isMultiSelect && (
                        <Text style={styles.multiSelectHint}>{getCorrectCountLabel(q)}</Text>
                      )}
                      {q.imageUri && (
                        <Text style={styles.imageAttachedHint}>📷 Image</Text>
                      )}
                    </View>
                  </View>
                </View>
                {isExpanded ? (
                  <ChevronUp color={Colors.textTertiary} size={20} />
                ) : (
                  <ChevronDown color={Colors.textTertiary} size={20} />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.questionBody}>
                  <Text style={styles.fieldLabel}>Question Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                    <View style={styles.typeChips}>
                      {SWITCHABLE_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeChip, q.type === t && styles.typeChipActive]}
                          onPress={() => handleChangeType(qIndex, t)}
                        >
                          <Text style={[styles.typeChipText, q.type === t && styles.typeChipTextActive]}>
                            {TYPE_LABELS[t]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Question Text</Text>
                    <TouchableOpacity
                      style={styles.aiMathButton}
                      onPress={() => handleAiFormatMath(qIndex)}
                      disabled={convertingIndex !== null}
                      activeOpacity={0.7}
                    >
                      {convertingIndex === qIndex ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                      ) : (
                        <>
                          <Sparkles color={Colors.primary} size={13} />
                          <Text style={styles.aiMathButtonText}>Format Math</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    value={q.text}
                    onChangeText={(text) => handleUpdateQuestion(qIndex, { text })}
                    multiline
                    placeholder="Enter question text"
                    placeholderTextColor={Colors.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Question Image (optional)</Text>
                  {q.imageUri ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: q.imageUri }}
                        style={styles.imagePreview}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(qIndex)}
                      >
                        <X color={Colors.surface} size={16} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.changeImageButton}
                        onPress={() => handlePickImage(qIndex)}
                        activeOpacity={0.8}
                      >
                        <ImagePlus color={Colors.primary} size={14} />
                        <Text style={styles.changeImageText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addImageButton}
                      onPress={() => handlePickImage(qIndex)}
                      activeOpacity={0.7}
                    >
                      <ImagePlus color={Colors.textSecondary} size={20} />
                      <Text style={styles.addImageText}>Add Image</Text>
                    </TouchableOpacity>
                  )}

                  {q.options.length > 0 && (
                    <>
                      <Text style={styles.fieldLabel}>
                        {isMultiSelect
                          ? 'Options (tap to toggle correct — select all that apply)'
                          : 'Options (tap to set correct)'}
                      </Text>
                      {q.options.map((opt, optIndex) => {
                        const isCorrect = isOptionCorrect(q, opt);
                        return (
                          <View key={optIndex} style={styles.optionRow}>
                            <TouchableOpacity
                              style={[
                                isMultiSelect ? styles.optionIndicatorSquare : styles.optionIndicator,
                                isCorrect && styles.optionIndicatorCorrect,
                              ]}
                              onPress={() => handleToggleCorrectAnswer(qIndex, opt)}
                            >
                              {isCorrect && <Check color={Colors.surface} size={12} />}
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.optionInput, isCorrect && styles.optionInputCorrect]}
                              value={opt}
                              onChangeText={(val) => handleUpdateOption(qIndex, optIndex, val)}
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              placeholderTextColor={Colors.textTertiary}
                            />
                            {q.options.length > 2 && (
                              <TouchableOpacity
                                style={styles.removeOptionBtn}
                                onPress={() => handleRemoveOption(qIndex, optIndex)}
                              >
                                <Text style={styles.removeOptionText}>✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                      <TouchableOpacity
                        style={styles.addOptionButton}
                        onPress={() => handleAddOption(qIndex)}
                      >
                        <Plus color={Colors.textSecondary} size={14} />
                        <Text style={styles.addOptionText}>Add Option</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteQuestion(qIndex)}
                  >
                    <Trash2 color={Colors.error} size={16} />
                    <Text style={styles.deleteButtonText}>Remove Question</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addQuestionButton}
          onPress={handleAddQuestion}
          activeOpacity={0.7}
        >
          <Plus color={Colors.primary} size={18} />
          <Text style={styles.addQuestionText}>Add Question</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          testID="save-quiz-button"
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.surface} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  questionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  qNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qNumberUnverified: {
    backgroundColor: Colors.warningLight,
  },
  questionHeaderText: {
    flex: 1,
  },
  questionPreview: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  questionType: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  multiSelectHint: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600' as const,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  imageAttachedHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  questionBody: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  typeScroll: {
    marginBottom: 4,
  },
  typeChips: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: Colors.surface,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
  },
  aiMathButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  aiMathButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    minHeight: 44,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceAlt,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.accentLight,
  },
  changeImageText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.surfaceAlt,
  },
  addImageText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndicatorSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndicatorCorrect: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  optionInput: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: Colors.text,
  },
  optionInputCorrect: {
    backgroundColor: Colors.successLight,
  },
  removeOptionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeOptionText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  addOptionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  deleteButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addQuestionText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
