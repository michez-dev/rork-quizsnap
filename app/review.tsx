import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import MathText from '@/components/MathText';
import Colors from '@/constants/colors';

export default function ReviewScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { allAttempts } = useQuiz();

  const attempt = useMemo(
    () => allAttempts.find(a => a.id === attemptId),
    [allAttempts, attemptId]
  );

  if (!attempt) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Attempt not found.</Text>
      </View>
    );
  }

  const incorrectAnswers = attempt.answers.filter(a => !a.isCorrect);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>
          {incorrectAnswers.length} Incorrect Answer{incorrectAnswers.length !== 1 ? 's' : ''}
        </Text>

        {incorrectAnswers.map((answer, index) => (
          <View key={index} style={styles.reviewCard}>
            <Text style={styles.questionNumber}>Question {index + 1}</Text>
            <MathText
              text={answer.questionText}
              style={styles.questionText}
              fontSize={16}
              color={Colors.text}
            />

            <View style={styles.answersSection}>
              {answer.options.map((option, optIndex) => {
                const isUserAnswer = Array.isArray(answer.userAnswer)
                  ? answer.userAnswer.includes(option)
                  : answer.userAnswer === option;
                const isCorrectAnswer = Array.isArray(answer.correctAnswer)
                  ? answer.correctAnswer.includes(option)
                  : answer.correctAnswer === option;

                return (
                  <View
                    key={optIndex}
                    style={[
                      styles.optionRow,
                      isCorrectAnswer && styles.optionCorrect,
                      isUserAnswer && !isCorrectAnswer && styles.optionWrong,
                    ]}
                  >
                    <Text style={styles.optionLetter}>
                      {String.fromCharCode(65 + optIndex)}
                    </Text>
                    <MathText
                      text={option}
                      style={{
                        ...styles.optionText,
                        ...(isCorrectAnswer ? styles.optionTextCorrect : {}),
                        ...(isUserAnswer && !isCorrectAnswer ? styles.optionTextWrong : {}),
                      }}
                      fontSize={14}
                      color={isCorrectAnswer ? Colors.success : (isUserAnswer && !isCorrectAnswer ? Colors.error : Colors.text)}
                    />
                    {isCorrectAnswer && <Check color={Colors.success} size={16} />}
                    {isUserAnswer && !isCorrectAnswer && <X color={Colors.error} size={16} />}
                  </View>
                );
              })}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Your answer</Text>
                <Text style={[styles.summaryValue, { color: Colors.error }]}>
                  {Array.isArray(answer.userAnswer) ? answer.userAnswer.join(', ') : answer.userAnswer}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Correct answer</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {Array.isArray(answer.correctAnswer) ? answer.correctAnswer.join(', ') : answer.correctAnswer}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 14,
  },
  answersSection: {
    gap: 6,
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    gap: 10,
  },
  optionCorrect: {
    backgroundColor: Colors.successLight,
  },
  optionWrong: {
    backgroundColor: Colors.errorLight,
  },
  optionLetter: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    width: 20,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  optionTextCorrect: {
    color: Colors.success,
    fontWeight: '500' as const,
  },
  optionTextWrong: {
    color: Colors.error,
    fontWeight: '500' as const,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
