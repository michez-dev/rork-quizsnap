import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BarChart3, Calendar, Target, Clock, ChevronRight, TrendingUp } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import Colors from '@/constants/colors';

export default function HistoryScreen() {
  const router = useRouter();
  const { allAttempts, quizSets } = useQuiz();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const sortedAttempts = useMemo(
    () => [...allAttempts].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [allAttempts]
  );

  const overallStats = useMemo(() => {
    if (allAttempts.length === 0) return null;

    const totalCorrect = allAttempts.reduce((sum, a) => sum + a.score, 0);
    const totalQuestions = allAttempts.reduce((sum, a) => sum + a.totalQuestions, 0);
    const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const totalTime = allAttempts.reduce((sum, a) => {
      return sum + a.answers.reduce((s, ans) => s + ans.timeSpent, 0);
    }, 0);
    const avgTimePerQ = totalQuestions > 0 ? (totalTime / totalQuestions) : 0;

    const recentFive = sortedAttempts.slice(0, 5);
    const recentAccuracy = recentFive.length > 0
      ? Math.round((recentFive.reduce((s, a) => s + a.score, 0) /
        recentFive.reduce((s, a) => s + a.totalQuestions, 0)) * 100)
      : 0;

    return {
      totalAttempts: allAttempts.length,
      avgAccuracy,
      avgTimePerQ,
      recentAccuracy,
      trend: recentAccuracy - avgAccuracy,
    };
  }, [allAttempts, sortedAttempts]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {allAttempts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <BarChart3 color={Colors.accent} size={44} />
            </View>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete a quiz to see your performance stats and progress over time.
            </Text>
          </View>
        ) : (
          <>
            {overallStats && (
              <View style={styles.overviewSection}>
                <Text style={styles.sectionLabel}>Overview</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Target color={Colors.success} size={20} />
                    <Text style={styles.statValue}>{overallStats.avgAccuracy}%</Text>
                    <Text style={styles.statLabel}>Avg Accuracy</Text>
                  </View>
                  <View style={styles.statCard}>
                    <BarChart3 color={Colors.accent} size={20} />
                    <Text style={styles.statValue}>{overallStats.totalAttempts}</Text>
                    <Text style={styles.statLabel}>Total Quizzes</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Clock color={Colors.warning} size={20} />
                    <Text style={styles.statValue}>{overallStats.avgTimePerQ.toFixed(1)}s</Text>
                    <Text style={styles.statLabel}>Avg / Question</Text>
                  </View>
                </View>

                {overallStats.trend !== 0 && (
                  <View style={[
                    styles.trendBadge,
                    { backgroundColor: overallStats.trend > 0 ? Colors.successLight : Colors.errorLight },
                  ]}>
                    <TrendingUp
                      color={overallStats.trend > 0 ? Colors.success : Colors.error}
                      size={16}
                      style={overallStats.trend < 0 ? { transform: [{ scaleY: -1 }] } : undefined}
                    />
                    <Text style={[
                      styles.trendText,
                      { color: overallStats.trend > 0 ? Colors.success : Colors.error },
                    ]}>
                      {overallStats.trend > 0 ? '+' : ''}{overallStats.trend}% from overall average (last 5 quizzes)
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.sectionLabel}>Recent Attempts</Text>
            {sortedAttempts.map((attempt, index) => {
              const pct = Math.round((attempt.score / attempt.totalQuestions) * 100);
              const scoreColor = pct >= 80 ? Colors.success : pct >= 50 ? Colors.warning : Colors.error;

              return (
                <TouchableOpacity
                  key={attempt.id}
                  style={styles.attemptCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/review' as any, params: { attemptId: attempt.id } });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.attemptLeft}>
                    <View style={[styles.scoreIndicator, { backgroundColor: scoreColor }]}>
                      <Text style={styles.scoreIndicatorText}>{pct}%</Text>
                    </View>
                    <View style={styles.attemptInfo}>
                      <Text style={styles.attemptTitle} numberOfLines={1}>
                        {attempt.quizSetTitle}
                      </Text>
                      <View style={styles.attemptMeta}>
                        <Text style={styles.attemptMetaText}>
                          {attempt.score}/{attempt.totalQuestions} correct
                        </Text>
                        <Text style={styles.attemptDot}>·</Text>
                        <Text style={styles.attemptMetaText}>
                          {attempt.mode === 'study' ? 'Study' : 'Exam'}
                        </Text>
                        <Text style={styles.attemptDot}>·</Text>
                        <Text style={styles.attemptMetaText}>
                          {formatDate(attempt.startedAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight color={Colors.textTertiary} size={18} />
                </TouchableOpacity>
              );
            })}
          </>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
  },
  overviewSection: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
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
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  attemptCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  attemptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  scoreIndicator: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreIndicatorText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  attemptInfo: {
    flex: 1,
  },
  attemptTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  attemptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  attemptMetaText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  attemptDot: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginHorizontal: 4,
  },
});
