import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Play, BookOpen, GraduationCap, Timer, Shuffle, ArrowDownUp, Award, Plus, Minus, EyeOff } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import { QuizMode } from '@/types/quiz';
import Colors from '@/constants/colors';

export default function QuizSettingsScreen() {
  const router = useRouter();
  const { quizSetId } = useLocalSearchParams<{ quizSetId: string }>();
  const { getQuizSetById, getQuestionsForSet } = useQuiz();

  const quizSet = useMemo(() => getQuizSetById(quizSetId ?? ''), [quizSetId, getQuizSetById]);
  const questions = useMemo(() => getQuestionsForSet(quizSetId ?? ''), [quizSetId, getQuestionsForSet]);

  const [mode, setMode] = useState<QuizMode>('study');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [randomize, setRandomize] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [scoringEnabled, setScoringEnabled] = useState(false);
  const [pointsPerCorrect, setPointsPerCorrect] = useState(1);
  const [penaltyPerWrong, setPenaltyPerWrong] = useState(0);

  const pointOptions = [0.25, 0.5, 1, 1.5, 2, 3];
  const penaltyOptions = [0, 0.25, 0.5, 1, 1.5, 2];

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/quiz-player' as any,
      params: {
        quizSetId: quizSetId ?? '',
        mode,
        timerEnabled: timerEnabled ? '1' : '0',
        timerMinutes: String(timerMinutes),
        randomize: randomize ? '1' : '0',
        shuffleAnswers: shuffleAnswers ? '1' : '0',
        practiceMode: mode === 'study' && practiceMode ? '1' : '0',
        scoringEnabled: mode === 'exam' && scoringEnabled ? '1' : '0',
        pointsPerCorrect: String(pointsPerCorrect),
        penaltyPerWrong: String(penaltyPerWrong),
      },
    });
  }, [quizSetId, mode, timerEnabled, timerMinutes, randomize, shuffleAnswers, practiceMode, scoringEnabled, pointsPerCorrect, penaltyPerWrong, router]);

  if (!quizSet) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Quiz set not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: quizSet.title }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{quizSet.title}</Text>
          <Text style={styles.infoMeta}>
            {questions.length} question{questions.length !== 1 ? 's' : ''}
            {quizSet.sourcePdfName ? ` · ${quizSet.sourcePdfName}` : ''}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Quiz Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeCard, mode === 'study' && styles.modeCardActive]}
            onPress={() => { setMode('study'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.7}
          >
            <BookOpen color={mode === 'study' ? Colors.primary : Colors.textSecondary} size={24} />
            <Text style={[styles.modeTitle, mode === 'study' && styles.modeTitleActive]}>Study</Text>
            <Text style={styles.modeDesc}>See answers after each question</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, mode === 'exam' && styles.modeCardActive]}
            onPress={() => { setMode('exam'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.7}
          >
            <GraduationCap color={mode === 'exam' ? Colors.primary : Colors.textSecondary} size={24} />
            <Text style={[styles.modeTitle, mode === 'exam' && styles.modeTitleActive]}>Exam</Text>
            <Text style={styles.modeDesc}>Results shown at the end</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Options</Text>
        <View style={styles.optionsCard}>
          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Shuffle color={Colors.textSecondary} size={20} />
              <View>
                <Text style={styles.optionTitle}>Shuffle Questions</Text>
                <Text style={styles.optionDesc}>Randomize the order of questions</Text>
              </View>
            </View>
            <Switch
              value={randomize}
              onValueChange={setRandomize}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.surface}
            />
          </View>

          <View style={[styles.optionRow, styles.optionRowBorder]}>
            <View style={styles.optionLeft}>
              <ArrowDownUp color={Colors.textSecondary} size={20} />
              <View>
                <Text style={styles.optionTitle}>Shuffle Answers</Text>
                <Text style={styles.optionDesc}>Randomize the order of answer choices</Text>
              </View>
            </View>
            <Switch
              value={shuffleAnswers}
              onValueChange={setShuffleAnswers}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.surface}
            />
          </View>

          {mode === 'exam' && (
            <>
              <View style={[styles.optionRow, styles.optionRowBorder]}>
                <View style={styles.optionLeft}>
                  <Timer color={Colors.textSecondary} size={20} />
                  <View>
                    <Text style={styles.optionTitle}>Timer</Text>
                    <Text style={styles.optionDesc}>
                      {timerEnabled ? `${timerMinutes} minutes` : 'No time limit'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={timerEnabled}
                  onValueChange={setTimerEnabled}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                  thumbColor={Colors.surface}
                />
              </View>

              {timerEnabled && (
                <View style={styles.timerOptions}>
                  {[5, 10, 15, 20, 30].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.timerChip,
                        timerMinutes === mins && styles.timerChipActive,
                      ]}
                      onPress={() => setTimerMinutes(mins)}
                    >
                      <Text style={[
                        styles.timerChipText,
                        timerMinutes === mins && styles.timerChipTextActive,
                      ]}>
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {mode === 'study' && (
            <View style={[styles.optionRow, styles.optionRowBorder]}>
              <View style={styles.optionLeft}>
                <EyeOff color={Colors.textSecondary} size={20} />
                <View>
                  <Text style={styles.optionTitle}>Practice Mode</Text>
                  <Text style={styles.optionDesc}>Results won't affect your statistics</Text>
                </View>
              </View>
              <Switch
                value={practiceMode}
                onValueChange={setPracticeMode}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={Colors.surface}
              />
            </View>
          )}

          {mode === 'exam' && (
            <>
              <View style={[styles.optionRow, styles.optionRowBorder]}>
                <View style={styles.optionLeft}>
                  <Award color={Colors.textSecondary} size={20} />
                  <View>
                    <Text style={styles.optionTitle}>Custom Scoring</Text>
                    <Text style={styles.optionDesc}>
                      {scoringEnabled
                        ? `+${pointsPerCorrect} correct${penaltyPerWrong > 0 ? ` / -${penaltyPerWrong} wrong` : ''}`
                        : 'Set points & penalties'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={scoringEnabled}
                  onValueChange={setScoringEnabled}
                  trackColor={{ false: Colors.border, true: Colors.accent }}
                  thumbColor={Colors.surface}
                />
              </View>

              {scoringEnabled && (
                <View style={styles.scoringConfig}>
                  <View style={styles.scoringRow}>
                    <View style={styles.scoringLabelRow}>
                      <View style={[styles.scoringDot, { backgroundColor: Colors.success }]} />
                      <Text style={styles.scoringLabel}>Correct answer</Text>
                    </View>
                    <View style={styles.scoringChips}>
                      {pointOptions.map((val) => (
                        <TouchableOpacity
                          key={`pts-${val}`}
                          style={[
                            styles.scoringChip,
                            pointsPerCorrect === val && styles.scoringChipActiveGreen,
                          ]}
                          onPress={() => { setPointsPerCorrect(val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        >
                          <Text style={[
                            styles.scoringChipText,
                            pointsPerCorrect === val && styles.scoringChipTextActive,
                          ]}>
                            +{val}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.scoringRow, { marginTop: 12 }]}>
                    <View style={styles.scoringLabelRow}>
                      <View style={[styles.scoringDot, { backgroundColor: Colors.error }]} />
                      <Text style={styles.scoringLabel}>Wrong answer</Text>
                    </View>
                    <View style={styles.scoringChips}>
                      {penaltyOptions.map((val) => (
                        <TouchableOpacity
                          key={`pen-${val}`}
                          style={[
                            styles.scoringChip,
                            penaltyPerWrong === val && (val === 0 ? styles.scoringChipActiveNeutral : styles.scoringChipActiveRed),
                          ]}
                          onPress={() => { setPenaltyPerWrong(val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        >
                          <Text style={[
                            styles.scoringChipText,
                            penaltyPerWrong === val && styles.scoringChipTextActive,
                          ]}>
                            {val === 0 ? '0' : `-${val}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.scoringPreview}>
                    <Text style={styles.scoringPreviewLabel}>Max possible score</Text>
                    <Text style={styles.scoringPreviewValue}>
                      {(questions.length * pointsPerCorrect).toFixed(questions.length * pointsPerCorrect % 1 === 0 ? 0 : 2)} pts
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStart}
          activeOpacity={0.85}
          testID="start-quiz-button"
        >
          <Play color={Colors.surface} size={20} />
          <Text style={styles.startButtonText}>Start Quiz</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
  },
  infoCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  infoMeta: {
    fontSize: 14,
    color: Colors.primary,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  modeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.accentLight,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modeTitleActive: {
    color: Colors.primary,
  },
  modeDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  optionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  optionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  optionDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  timerOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  timerChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
  },
  timerChipActive: {
    backgroundColor: Colors.primary,
  },
  timerChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  timerChipTextActive: {
    color: Colors.surface,
  },
  scoringConfig: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scoringRow: {},
  scoringLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scoringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoringLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  scoringChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoringChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    minWidth: 48,
    alignItems: 'center',
  },
  scoringChipActiveGreen: {
    backgroundColor: Colors.success,
  },
  scoringChipActiveRed: {
    backgroundColor: Colors.error,
  },
  scoringChipActiveNeutral: {
    backgroundColor: Colors.textSecondary,
  },
  scoringChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  scoringChipTextActive: {
    color: Colors.surface,
  },
  scoringPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  scoringPreviewLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  scoringPreviewValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
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
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    color: Colors.surface,
    fontSize: 17,
    fontWeight: '600' as const,
  },
});
