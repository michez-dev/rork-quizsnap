import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Trash2, FileText, Shield, Info, ChevronRight } from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import Colors from '@/constants/colors';

export default function SettingsScreen() {
  const { quizSets, allAttempts, clearAllData } = useQuiz();

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all quiz sets, questions, and attempt history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              console.log('Error clearing data:', e);
              Alert.alert('Error', 'Could not clear data. Please try again.');
            }
          },
        },
      ]
    );
  }, [clearAllData]);

  const handleExportData = useCallback(() => {
    const data = {
      quizSets: quizSets.length,
      attempts: allAttempts.length,
    };
    Alert.alert(
      'Export Data',
      `You have ${data.quizSets} quiz set${data.quizSets !== 1 ? 's' : ''} and ${data.attempts} attempt${data.attempts !== 1 ? 's' : ''}.\n\nJSON export feature coming soon.`,
    );
  }, [quizSets, allAttempts]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appInfoCard}>
          <View style={styles.appIcon}>
            <FileText color={Colors.primary} size={28} />
          </View>
          <Text style={styles.appName}>QuizSnap</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appDesc}>
            Snap your study materials into interactive quizzes. All content is preserved exactly as written.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.accentLight }]}>
                <FileText color={Colors.primary} size={18} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Quiz Sets</Text>
                <Text style={styles.menuSubtitle}>{quizSets.length} set{quizSets.length !== 1 ? 's' : ''} saved locally</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={handleExportData}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#F0FDF4' }]}>
                <FileText color={Colors.success} size={18} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Export Data</Text>
                <Text style={styles.menuSubtitle}>Share quiz sets as JSON</Text>
              </View>
            </View>
            <ChevronRight color={Colors.textTertiary} size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={handleClearData}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.errorLight }]}>
                <Trash2 color={Colors.error} size={18} />
              </View>
              <View>
                <Text style={[styles.menuTitle, { color: Colors.error }]}>Clear All Data</Text>
                <Text style={styles.menuSubtitle}>Delete everything permanently</Text>
              </View>
            </View>
            <ChevronRight color={Colors.textTertiary} size={18} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Privacy</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                <Shield color="#3B82F6" size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>On-Device Processing</Text>
                <Text style={styles.menuSubtitle}>
                  All quiz data is stored locally on your device. No data is sent to external servers.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.surfaceAlt }]}>
                <Info color={Colors.textSecondary} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>How It Works</Text>
                <Text style={styles.menuSubtitle}>
                  Paste text from your PDF containing questions and answers. The parser detects common formats (numbered questions with lettered options). Review and edit before creating your quiz set.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 40,
  },
  appInfoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  appVersion: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 10,
  },
  appDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  menuGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 1,
    lineHeight: 18,
  },
});
