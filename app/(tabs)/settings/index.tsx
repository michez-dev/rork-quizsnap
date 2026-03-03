import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Trash2,
  FileText,
  Info,
  ChevronRight,
  User,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react-native';
import { useQuiz } from '@/providers/QuizProvider';
import { useAuth } from '@/providers/AuthProvider';
import Colors from '@/constants/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const { quizSets, allAttempts, clearAllData } = useQuiz();
  const {
    user,
    isAuthenticated,
    isSyncing,
    lastSyncedAt,
    logout,
    syncToCloud,
    syncFromCloud,
  } = useAuth();

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

  const handleSyncToCloud = useCallback(async () => {
    try {
      await syncToCloud();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Synced!', 'Your quizzes have been uploaded to the cloud.');
    } catch (e: any) {
      console.log('Sync to cloud error:', e);
      Alert.alert('Sync Failed', e?.message || 'Could not sync data. Please try again.');
    }
  }, [syncToCloud]);

  const handleSyncFromCloud = useCallback(async () => {
    Alert.alert(
      'Download from Cloud',
      'This will replace your local data with cloud data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              await syncFromCloud();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Done!', 'Cloud data has been downloaded to your device.');
            } catch (e: any) {
              console.log('Sync from cloud error:', e);
              Alert.alert('Sync Failed', e?.message || 'Could not download data.');
            }
          },
        },
      ]
    );
  }, [syncFromCloud]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'You will be signed out. Your local data will remain on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [logout]);

  const formatSyncTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

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

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.menuGroup}>
          {isAuthenticated ? (
            <>
              <View style={styles.menuItem}>
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: '#E0F2FE' }]}>
                    <User color={Colors.primary} size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Signed In</Text>
                    <Text style={styles.menuSubtitle}>{user?.email}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemBorder]}
                onPress={handleSyncToCloud}
                disabled={isSyncing}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: '#ECFDF5' }]}>
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={Colors.success} />
                    ) : (
                      <Cloud color={Colors.success} size={18} />
                    )}
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Sync to Cloud</Text>
                    <Text style={styles.menuSubtitle}>
                      Last synced: {formatSyncTime(lastSyncedAt)}
                    </Text>
                  </View>
                </View>
                <ChevronRight color={Colors.textTertiary} size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemBorder]}
                onPress={handleSyncFromCloud}
                disabled={isSyncing}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                    <RefreshCw color="#3B82F6" size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Download from Cloud</Text>
                    <Text style={styles.menuSubtitle}>Restore data from your account</Text>
                  </View>
                </View>
                <ChevronRight color={Colors.textTertiary} size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemBorder]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: Colors.errorLight }]}>
                    <LogOut color={Colors.error} size={18} />
                  </View>
                  <View>
                    <Text style={[styles.menuTitle, { color: Colors.error }]}>Sign Out</Text>
                    <Text style={styles.menuSubtitle}>Keep local data on device</Text>
                  </View>
                </View>
                <ChevronRight color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/auth')}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#E0F2FE' }]}>
                  <LogIn color={Colors.primary} size={18} />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuTitle}>Sign In / Register</Text>
                  <Text style={styles.menuSubtitle}>Sync quizzes across devices</Text>
                </View>
              </View>
              <ChevronRight color={Colors.textTertiary} size={18} />
            </TouchableOpacity>
          )}
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
                {isAuthenticated ? (
                  <Cloud color="#3B82F6" size={18} />
                ) : (
                  <CloudOff color="#3B82F6" size={18} />
                )}
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>
                  {isAuthenticated ? 'Cloud Sync Enabled' : 'On-Device Only'}
                </Text>
                <Text style={styles.menuSubtitle}>
                  {isAuthenticated
                    ? 'Data is synced to your account when you tap "Sync to Cloud".'
                    : 'All quiz data is stored locally on your device. Sign in to enable cloud sync.'}
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
