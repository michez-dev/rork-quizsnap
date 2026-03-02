import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { X, ChevronRight, Check, XCircle, Clock } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import { Question, AnswerRecord, QuizMode, ScoringConfig } from '@/types/quiz';
import { generateId } from '@/utils/generateId';
import MathText from '@/components/MathText';
import Colors from '@/constants/colors';

export default function QuizPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    quizSetId: string;
    mode: QuizMode;
    timerEnabled: string;
    timerMinutes: string;
    randomize: string;
    shuffleAnswers: string;
    practiceMode: string;
    scoringEnabled: string;
    pointsPerCorrect: string;
    penaltyPerWrong: string;
  }>();

  const { getQuestionsForSet, getQuizSetById, saveAttempt } = useQuiz();

  const quizSet = useMemo(() => getQuizSetById(params.quizSetId ?? ''), [params.quizSetId, getQuizSetById]);
  const rawQuestions = useMemo(() => getQuestionsForSet(params.quizSetId ?? ''), [params.quizSetId, getQuestionsForSet]);

  const questions = useMemo(() => {
    let result = [...rawQuestions];
    if (params.randomize === '1') {
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
    }
    if (params.shuffleAnswers === '1') {
      result = result.map(q => {
        if (q.options.length <= 1) return q;
        const shuffledOptions = [...q.options];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }
        return { ...q, options: shuffledOptions };
      });
    }
    return result;
  }, [rawQuestions, params.randomize, params.shuffleAnswers]);

  const mode = params.mode ?? 'study';
  const timerEnabled = params.timerEnabled === '1';
  const timerMinutes = parseInt(params.timerMinutes ?? '10', 10);
  const practiceMode = params.practiceMode === '1';
  const scoringEnabled = params.scoringEnabled === '1';
  const pointsPerCorrect = parseFloat(params.pointsPerCorrect ?? '1');
  const penaltyPerWrong = parseFloat(params.penaltyPerWrong ?? '0');

  const scoringConfig: ScoringConfig | undefined = scoringEnabled
    ? { enabled: true, pointsPerCorrect, penaltyPerWrong }
    : undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [startTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(timerMinutes * 60);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = questions[currentIndex];
  const quizHasMultiSelect = useMemo(() => questions.some(q => q.type === 'multiple-select'), [questions]);
  const isMultiSelect = quizHasMultiSelect;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / questions.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, questions.length]);

  useEffect(() => {
    if (!timerEnabled) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerEnabled]);

  const animateSlide = useCallback(() => {
    slideAnim.setValue(50);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [slideAnim]);

  const handleSelectAnswer = useCallback((answer: string) => {
    if (showFeedback && mode === 'study') return;

    if (isMultiSelect) {
      setSelectedAnswers(prev => {
        const exists = prev.includes(answer);
        if (exists) {
          return prev.filter(a => a !== answer);
        }
        return [...prev, answer];
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      setSelectedAnswers([answer]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (mode === 'study') {
        setShowFeedback(true);
        Animated.spring(feedbackAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();

        const isCorrect = checkCorrectSingle(answer, currentQuestion);
        if (isCorrect) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    }
  }, [showFeedback, mode, currentQuestion, feedbackAnim, isMultiSelect]);

  const handleConfirmMultiSelect = useCallback(() => {
    if (selectedAnswers.length === 0) return;
    if (showFeedback && mode === 'study') return;

    if (mode === 'study') {
      setShowFeedback(true);
      Animated.spring(feedbackAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      const isCorrect = checkCorrectMulti(selectedAnswers, currentQuestion);
      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [selectedAnswers, showFeedback, mode, currentQuestion, feedbackAnim]);

  const checkCorrectSingle = (answer: string, question: Question): boolean => {
    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.length === 1 && question.correctAnswer[0].toLowerCase().trim() === answer.toLowerCase().trim();
    }
    return question.correctAnswer.toLowerCase().trim() === answer.toLowerCase().trim();
  };

  const checkCorrectMulti = (answers: string[], question: Question): boolean => {
    const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
    if (answers.length !== correct.length) return false;
    const sortedAnswers = [...answers].sort();
    const sortedCorrect = [...correct].map(a => a.toLowerCase().trim()).sort();
    const sortedUserAnswers = sortedAnswers.map(a => a.toLowerCase().trim());
    return sortedUserAnswers.every((a, i) => a === sortedCorrect[i]);
  };

  const isOptionCorrectAnswer = (option: string, question: Question): boolean => {
    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.some(a => a.toLowerCase().trim() === option.toLowerCase().trim());
    }
    return question.correctAnswer.toLowerCase().trim() === option.toLowerCase().trim();
  };

  const recordAnswer = useCallback(() => {
    if (selectedAnswers.length === 0 || !currentQuestion) return;

    const userAnswer = isMultiSelect ? selectedAnswers : selectedAnswers[0];
    const isCorrect = isMultiSelect
      ? checkCorrectMulti(selectedAnswers, currentQuestion)
      : checkCorrectSingle(selectedAnswers[0], currentQuestion);
    const timeSpent = (Date.now() - questionStartTime) / 1000;

    const pointsEarned = scoringEnabled
      ? (isCorrect ? pointsPerCorrect : (penaltyPerWrong > 0 ? -penaltyPerWrong : 0))
      : undefined;

    const record: AnswerRecord = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text,
      options: currentQuestion.options,
      correctAnswer: currentQuestion.correctAnswer,
      userAnswer,
      isCorrect,
      timeSpent,
      pointsEarned,
    };

    setAnswers(prev => [...prev, record]);
    return record;
  }, [selectedAnswers, currentQuestion, questionStartTime, isMultiSelect]);

  const handleNext = useCallback(() => {
    recordAnswer();

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setShowFeedback(false);
      feedbackAnim.setValue(0);
      setQuestionStartTime(Date.now());
      animateSlide();
    } else {
      handleFinish();
    }
  }, [currentIndex, questions.length, recordAnswer, animateSlide, feedbackAnim]);

  const handleFinish = useCallback(async () => {
    const finalAnswers = [...answers];
    if (selectedAnswers.length > 0 && currentQuestion) {
      const userAnswer = isMultiSelect ? selectedAnswers : selectedAnswers[0];
      const isCorrect = isMultiSelect
        ? checkCorrectMulti(selectedAnswers, currentQuestion)
        : checkCorrectSingle(selectedAnswers[0], currentQuestion);
      const timeSpent = (Date.now() - questionStartTime) / 1000;
      finalAnswers.push({
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        options: currentQuestion.options,
        correctAnswer: currentQuestion.correctAnswer,
        userAnswer,
        isCorrect,
        timeSpent,
      });
    }

    const score = finalAnswers.filter(a => a.isCorrect).length;
    const totalPoints = scoringEnabled
      ? finalAnswers.reduce((sum, a) => {
          const pts = a.isCorrect ? pointsPerCorrect : (penaltyPerWrong > 0 ? -penaltyPerWrong : 0);
          return sum + pts;
        }, 0)
      : undefined;

    finalAnswers.forEach(a => {
      if (scoringEnabled && a.pointsEarned === undefined) {
        a.pointsEarned = a.isCorrect ? pointsPerCorrect : (penaltyPerWrong > 0 ? -penaltyPerWrong : 0);
      }
    });

    const attempt = {
      id: generateId(),
      quizSetId: params.quizSetId ?? '',
      quizSetTitle: quizSet?.title ?? 'Quiz',
      startedAt: new Date(startTime).toISOString(),
      endedAt: new Date().toISOString(),
      score,
      totalQuestions: questions.length,
      mode,
      answers: finalAnswers,
      scoring: scoringConfig,
      totalPoints,
    };

    if (!practiceMode) {
      try {
        await saveAttempt(attempt);
      } catch (e) {
        console.log('Error saving attempt:', e);
      }
    } else {
      console.log('Practice mode: skipping save');
    }

    router.replace({ pathname: '/results' as any, params: { attemptId: attempt.id } });
  }, [answers, selectedAnswers, currentQuestion, questionStartTime, params.quizSetId, quizSet, startTime, questions.length, mode, saveAttempt, router, isMultiSelect]);

  const handleQuit = useCallback(() => {
    Alert.alert(
      'Quit Quiz?',
      'Your progress will be lost.',
      [
        { text: 'Continue', style: 'cancel' },
        { text: 'Quit', style: 'destructive', onPress: () => router.back() },
      ]
    );
  }, [router]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion || questions.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>No questions available.</Text>
      </View>
    );
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const hasSelection = selectedAnswers.length > 0;
  const canProceed = isMultiSelect
    ? hasSelection && (mode === 'exam' || showFeedback)
    : hasSelection && (mode === 'exam' || showFeedback);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleQuit} style={styles.quitButton} testID="quit-button">
          <X color={Colors.textSecondary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.questionCounter}>
            {currentIndex + 1} / {questions.length}
          </Text>
          {timerEnabled && (
            <View style={styles.timerBadge}>
              <Clock color={timeRemaining < 60 ? Colors.error : Colors.textSecondary} size={14} />
              <Text style={[
                styles.timerText,
                timeRemaining < 60 && { color: Colors.error },
              ]}>
                {formatTime(timeRemaining)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.progressContainer}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <MathText
            text={currentQuestion.text}
            style={styles.questionText}
            fontSize={20}
            color={Colors.text}
          />

          {currentQuestion.imageUri ? (
            <View style={styles.questionImageContainer}>
              <Image
                source={{ uri: currentQuestion.imageUri }}
                style={styles.questionImage}
                contentFit="contain"
              />
            </View>
          ) : null}


          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswers.includes(option);
              const isCorrectOption = showFeedback && isOptionCorrectAnswer(option, currentQuestion);
              const isWrongSelection = showFeedback && isSelected && !isCorrectOption;

              let optionStyle = styles.optionButton;
              let textStyle = styles.optionText;
              let letterStyle = styles.optionLetter;

              if (isCorrectOption && showFeedback) {
                optionStyle = { ...styles.optionButton, ...styles.optionCorrect };
                textStyle = { ...styles.optionText, ...styles.optionTextCorrect };
                letterStyle = { ...styles.optionLetter, ...styles.optionLetterCorrect };
              } else if (isWrongSelection) {
                optionStyle = { ...styles.optionButton, ...styles.optionWrong };
                textStyle = { ...styles.optionText, ...styles.optionTextWrong };
                letterStyle = { ...styles.optionLetter, ...styles.optionLetterWrong };
              } else if (isSelected && !showFeedback) {
                optionStyle = { ...styles.optionButton, ...styles.optionSelected };
                textStyle = { ...styles.optionText, ...styles.optionTextSelected };
                letterStyle = { ...styles.optionLetter, ...styles.optionLetterSelected };
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[optionStyle]}
                  onPress={() => handleSelectAnswer(option)}
                  activeOpacity={0.7}
                  disabled={showFeedback && mode === 'study'}
                  testID={`option-${index}`}
                >
                  <View style={styles.optionContent}>
                    <View style={[
                      isMultiSelect ? styles.optionLetterSquare : styles.optionLetterCircle,
                      isSelected && !showFeedback && styles.optionLetterSelectedBg,
                      isCorrectOption && showFeedback && styles.optionLetterCorrectBg,
                      isWrongSelection && styles.optionLetterWrongBg,
                    ]}>
                      {isMultiSelect && isSelected ? (
                        <Check color={showFeedback ? (isCorrectOption ? Colors.surface : Colors.surface) : Colors.surface} size={14} />
                      ) : (
                        <Text style={[
                          letterStyle,
                          { backgroundColor: 'transparent' },
                        ]}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <MathText
                        text={option}
                        style={textStyle}
                        fontSize={15}
                        color={textStyle.color ?? Colors.text}
                      />
                    </View>
                  </View>
                  {showFeedback && isCorrectOption && !isMultiSelect && (
                    <Check color={Colors.success} size={20} />
                  )}
                  {isWrongSelection && !isMultiSelect && (
                    <XCircle color={Colors.error} size={20} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {isMultiSelect && !showFeedback && mode === 'study' && (
          <TouchableOpacity
            style={[styles.confirmButton, selectedAnswers.length === 0 && styles.confirmButtonDisabled]}
            onPress={handleConfirmMultiSelect}
            disabled={selectedAnswers.length === 0}
            activeOpacity={0.85}
            testID="confirm-button"
          >
            <Text style={styles.confirmButtonText}>
              Confirm Selection ({selectedAnswers.length})
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
          activeOpacity={0.85}
          testID="next-button"
        >
          <Text style={styles.nextButtonText}>
            {isLastQuestion ? 'Finish' : 'Next'}
          </Text>
          <ChevronRight color={Colors.surface} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  questionCounter: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    height: 4,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 180,
  },
  questionImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: Colors.surfaceAlt,
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 16,
    marginTop: 12,
  },

  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.accentLight,
  },
  optionCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  optionWrong: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionLetterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterSelectedBg: {
    backgroundColor: Colors.primary,
  },
  optionLetterCorrectBg: {
    backgroundColor: Colors.success,
  },
  optionLetterWrongBg: {
    backgroundColor: Colors.error,
  },
  optionLetter: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  optionLetterSelected: {
    color: Colors.surface,
  },
  optionLetterCorrect: {
    color: Colors.surface,
  },
  optionLetterWrong: {
    color: Colors.surface,
  },
  optionText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
    lineHeight: 22,
  },
  optionTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '500' as const,
  },
  optionTextCorrect: {
    color: Colors.success,
    fontWeight: '500' as const,
  },
  optionTextWrong: {
    color: Colors.error,
    fontWeight: '500' as const,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  confirmButton: {
    backgroundColor: Colors.accentLight,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
