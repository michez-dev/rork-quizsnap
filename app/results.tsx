import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Trophy, RotateCcw, Eye, Home, Clock, Target, XCircle, Award } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import Colors from '@/constants/colors';

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { allAttempts } = useQuiz();

  const attempt = useMemo(
    () => allAttempts.find(a => a.id === attemptId),
    [allAttempts, attemptId]
  );

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const percentage = attempt ? Math.round((attempt.score / attempt.totalQuestions) * 100) : 0;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }),
      ]),
      Animated.timing(scoreAnim, {
        toValue: percentage,
        duration: 800,
        useNativeDriver: false,
      }),
    ]).start();

    if (percentage >= 80) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (percentage >= 50) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [percentage]);

  if (!attempt) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Results not found.</Text>
        <TouchableOpacity onPress={() => router.dismissAll()} style={styles.homeLink}>
          <Text style={styles.homeLinkText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const correctCount = attempt.answers.filter(a => a.isCorrect).length;
  const incorrectCount = attempt.answers.filter(a => !a.isCorrect).length;
  const totalTime = attempt.answers.reduce((sum, a) => sum + a.timeSpent, 0);
  const avgTime = totalTime / attempt.answers.length;
  const hasScoring = attempt.scoring?.enabled === true;
  const totalPoints = attempt.totalPoints ?? 0;
  const maxPoints = hasScoring ? attempt.totalQuestions * (attempt.scoring?.pointsPerCorrect ?? 1) : 0;
  const pointsPercentage = hasScoring && maxPoints > 0 ? Math.round((Math.max(totalPoints, 0) / maxPoints) * 100) : percentage;
  const displayPercentage = hasScoring ? pointsPercentage : percentage;

  const scoreColor = displayPercentage >= 80 ? Colors.success : displayPercentage >= 50 ? Colors.warning : Colors.error;
  const scoreMessage = displayPercentage >= 80 ? 'Excellent!' : displayPercentage >= 50 ? 'Good effort!' : 'Keep practicing!';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.scoreSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
            <Trophy color={scoreColor} size={28} />
            <Animated.Text style={[styles.scorePercentage, { color: scoreColor }]}>
              {displayPercentage}%
            </Animated.Text>
          </View>
          <Text style={styles.scoreMessage}>{scoreMessage}</Text>
          <Text style={styles.scoreSubtext}>
            {attempt.score} out of {attempt.totalQuestions} correct
          </Text>
          {hasScoring && (
            <View style={styles.pointsBadge}>
              <Award color={Colors.primary} size={16} />
              <Text style={styles.pointsBadgeText}>
                {totalPoints % 1 === 0 ? totalPoints : totalPoints.toFixed(2)} / {maxPoints % 1 === 0 ? maxPoints : maxPoints.toFixed(2)} pts
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
          <View style={styles.statCard}>
            <Target color={Colors.success} size={20} />
            <Text style={styles.statValue}>{correctCount}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={styles.statCard}>
            <XCircle color={Colors.error} size={20} />
            <Text style={styles.statValue}>{incorrectCount}</Text>
            <Text style={styles.statLabel}>Incorrect</Text>
          </View>
          <View style={styles.statCard}>
            <Clock color={Colors.accent} size={20} />
            <Text style={styles.statValue}>{avgTime.toFixed(1)}s</Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </View>
        </Animated.View>

        {hasScoring && (
          <Animated.View style={[styles.scoringBreakdown, { opacity: fadeAnim }]}>
            <Text style={styles.breakdownTitle}>Scoring Details</Text>
            <View style={styles.scoringDetailRow}>
              <Text style={styles.scoringDetailLabel}>Points per correct</Text>
              <Text style={[styles.scoringDetailValue, { color: Colors.success }]}>+{attempt.scoring?.pointsPerCorrect}</Text>
            </View>
            {(attempt.scoring?.penaltyPerWrong ?? 0) > 0 && (
              <View style={styles.scoringDetailRow}>
                <Text style={styles.scoringDetailLabel}>Penalty per wrong</Text>
                <Text style={[styles.scoringDetailValue, { color: Colors.error }]}>-{attempt.scoring?.penaltyPerWrong}</Text>
              </View>
            )}
            <View style={[styles.scoringDetailRow, styles.scoringDetailTotal]}>
              <Text style={styles.scoringDetailTotalLabel}>Total score</Text>
              <Text style={[styles.scoringDetailTotalValue, { color: scoreColor }]}>
                {totalPoints % 1 === 0 ? totalPoints : totalPoints.toFixed(2)} pts
              </Text>
            </View>
          </Animated.View>
        )}

        <Animated.View style={[styles.questionsBreakdown, { opacity: fadeAnim }]}>
          <Text style={styles.breakdownTitle}>Question Breakdown</Text>
          {attempt.answers.map((answer, index) => (
            <View key={index} style={styles.breakdownRow}>
              <View style={[
                styles.breakdownIndicator,
                { backgroundColor: answer.isCorrect ? Colors.success : Colors.error },
              ]} />
              <Text style={styles.breakdownText} numberOfLines={2}>
                {answer.questionText}
              </Text>
              {hasScoring && answer.pointsEarned !== undefined ? (
                <Text style={[
                  styles.breakdownPoints,
                  { color: answer.pointsEarned > 0 ? Colors.success : answer.pointsEarned < 0 ? Colors.error : Colors.textTertiary },
                ]}>
                  {answer.pointsEarned > 0 ? '+' : ''}{answer.pointsEarned % 1 === 0 ? answer.pointsEarned : answer.pointsEarned.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.breakdownTime}>{answer.timeSpent.toFixed(0)}s</Text>
              )}
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {incorrectCount > 0 && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/review' as any, params: { attemptId: attempt.id } });
            }}
            activeOpacity={0.8}
          >
            <Eye color={Colors.primary} size={18} />
            <Text style={styles.reviewButtonText}>Review Incorrect</Text>
          </TouchableOpacity>
        )}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.replace({
                pathname: '/quiz-settings' as any,
                params: { quizSetId: attempt.quizSetId },
              });
            }}
            activeOpacity={0.8}
          >
            <RotateCcw color={Colors.primary} size={18} />
            <Text style={styles.retakeButtonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => {
              router.dismissAll();
            }}
            activeOpacity={0.85}
          >
            <Home color={Colors.surface} size={18} />
            <Text style={styles.homeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
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
  homeLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  homeLinkText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  scorePercentage: {
    fontSize: 36,
    fontWeight: '800' as const,
    marginTop: 4,
  },
  scoreMessage: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  scoreSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  questionsBreakdown: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  breakdownIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  breakdownTime: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  reviewButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  reviewButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
  },
  retakeButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  homeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  homeButtonText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pointsBadgeText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  scoringBreakdown: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  scoringDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  scoringDetailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scoringDetailValue: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  scoringDetailTotal: {
    borderBottomWidth: 0,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  scoringDetailTotalLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  scoringDetailTotalValue: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  breakdownPoints: {
    fontSize: 13,
    fontWeight: '600' as const,
    minWidth: 36,
    textAlign: 'right' as const,
  },
});
