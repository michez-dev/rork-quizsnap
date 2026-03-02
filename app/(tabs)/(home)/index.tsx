import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, FileText, BookOpen, MoreVertical, Pencil, Trash2, X, Settings2, CheckCircle, Circle, Merge, Share2, Copy, FolderPlus, ChevronDown, ChevronRight, FolderInput, FolderOpen } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuiz } from '@/providers/QuizProvider';
import { QuizGroup } from '@/types/quiz';
import Colors from '@/constants/colors';

interface MenuPosition {
  x: number;
  y: number;
}

const GROUP_COLORS = [
  '#0369A1', '#059669', '#D97706', '#DC2626', '#7C3AED',
  '#DB2777', '#0891B2', '#65A30D', '#EA580C', '#4F46E5',
];

export default function HomeScreen() {
  const router = useRouter();
  const {
    quizSets, isLoading, getAttemptsForSet, deleteQuizSet, updateQuizSet,
    deleteMultipleQuizSets, mergeQuizSets, shareQuizSets, duplicateQuizSet,
    quizGroups, createGroup, updateGroup, deleteGroup, moveQuizToGroup, moveMultipleQuizzesToGroup,
  } = useQuiz();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuQuizId, setMenuQuizId] = useState<string | null>(null);
  const [menuQuizTitle, setMenuQuizTitle] = useState('');
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameQuizId, setRenameQuizId] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [mergeVisible, setMergeVisible] = useState(false);
  const [mergeTitle, setMergeTitle] = useState('');

  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const [moveToGroupVisible, setMoveToGroupVisible] = useState(false);
  const [moveQuizId, setMoveQuizId] = useState<string | null>(null);

  const [bulkMoveVisible, setBulkMoveVisible] = useState(false);

  const [addQuizzesToGroupVisible, setAddQuizzesToGroupVisible] = useState(false);
  const [addQuizzesGroupId, setAddQuizzesGroupId] = useState<string | null>(null);
  const [addQuizzesSelected, setAddQuizzesSelected] = useState<Set<string>>(new Set());

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [groupMenuVisible, setGroupMenuVisible] = useState(false);
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [groupMenuPosition, setGroupMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  const toolbarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.timing(toolbarAnim, {
      toValue: selectMode ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectMode]);

  const ungroupedQuizzes = useMemo(
    () => quizSets.filter(s => !s.groupId),
    [quizSets]
  );

  const quizzesByGroup = useMemo(() => {
    const map = new Map<string, typeof quizSets>();
    for (const group of quizGroups) {
      map.set(group.id, quizSets.filter(s => s.groupId === group.id));
    }
    return map;
  }, [quizSets, quizGroups]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleUpload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/upload' as any);
  }, [router]);

  const handleQuizPress = useCallback((quizSetId: string) => {
    if (selectMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(quizSetId)) {
          next.delete(quizSetId);
        } else {
          next.add(quizSetId);
        }
        return next;
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/quiz-settings' as any, params: { quizSetId } });
  }, [router, selectMode]);

  const handleLongPress = useCallback((quizSetId: string) => {
    if (selectMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedIds(new Set([quizSetId]));
  }, [selectMode]);

  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIds.size === quizSets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quizSets.map(s => s.id)));
    }
  }, [quizSets, selectedIds.size]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      'Delete Quizzes',
      `Are you sure you want to delete ${count} quiz${count !== 1 ? 'zes' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMultipleQuizSets(Array.from(selectedIds));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleExitSelectMode();
            } catch (e) {
              console.log('Error deleting quizzes:', e);
              Alert.alert('Error', 'Could not delete the selected quizzes.');
            }
          },
        },
      ]
    );
  }, [selectedIds, deleteMultipleQuizSets, handleExitSelectMode]);

  const handleShareSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareQuizSets(Array.from(selectedIds));
  }, [selectedIds, shareQuizSets]);

  const handleMergePress = useCallback(() => {
    if (selectedIds.size < 2) {
      Alert.alert('Select More', 'You need at least 2 quizzes to merge.');
      return;
    }
    const selectedSets = quizSets.filter(s => selectedIds.has(s.id));
    setMergeTitle(selectedSets.map(s => s.title).join(' + '));
    setMergeVisible(true);
  }, [selectedIds, quizSets]);

  const handleMergeConfirm = useCallback(async () => {
    if (!mergeTitle.trim() || selectedIds.size < 2) return;
    try {
      await mergeQuizSets({ quizSetIds: Array.from(selectedIds), newTitle: mergeTitle.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMergeVisible(false);
      handleExitSelectMode();
    } catch (e) {
      console.log('Error merging quizzes:', e);
      Alert.alert('Error', 'Could not merge the selected quizzes.');
    }
  }, [mergeTitle, selectedIds, mergeQuizSets, handleExitSelectMode]);

  const handleOpenMenu = useCallback((quizSetId: string, title: string, event: any) => {
    if (selectMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { pageX, pageY } = event.nativeEvent;
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = 200;
    const adjustedX = Math.min(pageX, screenWidth - menuWidth - 16);
    setMenuPosition({ x: adjustedX, y: pageY + 8 });
    setMenuQuizId(quizSetId);
    setMenuQuizTitle(title);
    setMenuVisible(true);
  }, [selectMode]);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
    setMenuQuizId(null);
  }, []);

  const handleRenamePress = useCallback(() => {
    setMenuVisible(false);
    setRenameValue(menuQuizTitle);
    setRenameQuizId(menuQuizId);
    setTimeout(() => setRenameVisible(true), 200);
  }, [menuQuizId, menuQuizTitle]);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameQuizId || !renameValue.trim()) return;
    try {
      await updateQuizSet({ quizSetId: renameQuizId, updates: { title: renameValue.trim() } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Error renaming quiz:', e);
      Alert.alert('Error', 'Could not rename the quiz set.');
    }
    setRenameVisible(false);
    setRenameQuizId(null);
  }, [renameQuizId, renameValue, updateQuizSet]);

  const handleDuplicatePress = useCallback(() => {
    setMenuVisible(false);
    const id = menuQuizId;
    setTimeout(() => {
      if (id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        duplicateQuizSet(id);
      }
    }, 200);
  }, [menuQuizId, duplicateQuizSet]);

  const handleModifyPress = useCallback(() => {
    setMenuVisible(false);
    const id = menuQuizId;
    setTimeout(() => {
      if (id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/edit-quiz' as any, params: { quizSetId: id } });
      }
    }, 200);
  }, [menuQuizId, router]);

  const handleMoveToGroupPress = useCallback(() => {
    setMenuVisible(false);
    const id = menuQuizId;
    setTimeout(() => {
      if (id) {
        setMoveQuizId(id);
        setMoveToGroupVisible(true);
      }
    }, 200);
  }, [menuQuizId]);

  const handleMoveToGroup = useCallback(async (groupId: string | undefined) => {
    if (!moveQuizId) return;
    try {
      await moveQuizToGroup({ quizSetId: moveQuizId, groupId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Error moving quiz to group:', e);
      Alert.alert('Error', 'Could not move the quiz.');
    }
    setMoveToGroupVisible(false);
    setMoveQuizId(null);
  }, [moveQuizId, moveQuizToGroup]);

  const handleBulkMovePress = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (quizGroups.length === 0) {
      Alert.alert('No Groups', 'Create a group first before moving quizzes.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBulkMoveVisible(true);
  }, [selectedIds, quizGroups]);

  const handleBulkMoveToGroup = useCallback(async (groupId: string | undefined) => {
    if (selectedIds.size === 0) return;
    try {
      await moveMultipleQuizzesToGroup({ quizSetIds: Array.from(selectedIds), groupId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleExitSelectMode();
    } catch (e) {
      console.log('Error bulk moving quizzes:', e);
      Alert.alert('Error', 'Could not move the selected quizzes.');
    }
    setBulkMoveVisible(false);
  }, [selectedIds, moveMultipleQuizzesToGroup, handleExitSelectMode]);

  const quizzesNotInGroup = useMemo(() => {
    if (!addQuizzesGroupId) return [];
    return quizSets.filter(s => s.groupId !== addQuizzesGroupId);
  }, [quizSets, addQuizzesGroupId]);

  const handleAddQuizzesToGroupOpen = useCallback((groupId: string) => {
    setGroupMenuVisible(false);
    setTimeout(() => {
      setAddQuizzesGroupId(groupId);
      setAddQuizzesSelected(new Set());
      setAddQuizzesToGroupVisible(true);
    }, 200);
  }, []);

  const handleToggleAddQuiz = useCallback((quizId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddQuizzesSelected(prev => {
      const next = new Set(prev);
      if (next.has(quizId)) {
        next.delete(quizId);
      } else {
        next.add(quizId);
      }
      return next;
    });
  }, []);

  const handleConfirmAddQuizzes = useCallback(async () => {
    if (!addQuizzesGroupId || addQuizzesSelected.size === 0) return;
    try {
      await moveMultipleQuizzesToGroup({ quizSetIds: Array.from(addQuizzesSelected), groupId: addQuizzesGroupId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Error adding quizzes to group:', e);
      Alert.alert('Error', 'Could not add quizzes to this group.');
    }
    setAddQuizzesToGroupVisible(false);
    setAddQuizzesGroupId(null);
  }, [addQuizzesGroupId, addQuizzesSelected, moveMultipleQuizzesToGroup]);

  const handleDeletePress = useCallback(() => {
    setMenuVisible(false);
    const id = menuQuizId;
    const title = menuQuizTitle;
    setTimeout(() => {
      Alert.alert(
        'Delete Quiz Set',
        `Are you sure you want to delete "${title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (id) {
                deleteQuizSet(id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ]
      );
    }, 200);
  }, [menuQuizId, menuQuizTitle, deleteQuizSet]);

  const handleCreateGroup = useCallback(() => {
    setEditingGroupId(null);
    setGroupName('');
    setGroupColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
    setGroupModalVisible(true);
  }, []);

  const handleEditGroup = useCallback((group: QuizGroup) => {
    setGroupMenuVisible(false);
    setTimeout(() => {
      setEditingGroupId(group.id);
      setGroupName(group.name);
      setGroupColor(group.color);
      setGroupModalVisible(true);
    }, 200);
  }, []);

  const handleSaveGroup = useCallback(async () => {
    if (!groupName.trim()) return;
    try {
      if (editingGroupId) {
        await updateGroup({ groupId: editingGroupId, updates: { name: groupName.trim(), color: groupColor } });
      } else {
        await createGroup({ name: groupName.trim(), color: groupColor });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Error saving group:', e);
      Alert.alert('Error', 'Could not save the group.');
    }
    setGroupModalVisible(false);
  }, [groupName, groupColor, editingGroupId, createGroup, updateGroup]);

  const handleDeleteGroup = useCallback((groupId: string, groupName: string) => {
    setGroupMenuVisible(false);
    setTimeout(() => {
      Alert.alert(
        'Delete Group',
        `Delete "${groupName}"? Quizzes in this group will be moved to ungrouped.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteGroup(groupId);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {
                console.log('Error deleting group:', e);
              }
            },
          },
        ]
      );
    }, 200);
  }, [deleteGroup]);

  const handleOpenGroupMenu = useCallback((groupId: string, event: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { pageX, pageY } = event.nativeEvent;
    const screenWidth = Dimensions.get('window').width;
    const menuWidth = 180;
    const adjustedX = Math.min(pageX, screenWidth - menuWidth - 16);
    setGroupMenuPosition({ x: adjustedX, y: pageY + 8 });
    setGroupMenuId(groupId);
    setGroupMenuVisible(true);
  }, []);

  const renderQuizCard = useCallback((set: typeof quizSets[0], index: number) => {
    const attempts = getAttemptsForSet(set.id);
    const lastAttempt = attempts[0];
    const bestScore = attempts.length > 0
      ? Math.max(...attempts.map(a => Math.round((a.score / a.totalQuestions) * 100)))
      : null;
    const isSelected = selectedIds.has(set.id);

    return (
      <TouchableOpacity
        key={set.id}
        style={[
          styles.quizCard,
          isSelected && styles.quizCardSelected,
        ]}
        onPress={() => handleQuizPress(set.id)}
        onLongPress={() => handleLongPress(set.id)}
        delayLongPress={400}
        activeOpacity={0.7}
        testID={`quiz-card-${index}`}
      >
        {selectMode && (
          <View style={styles.checkboxArea}>
            {isSelected ? (
              <CheckCircle color={Colors.primary} size={24} />
            ) : (
              <Circle color={Colors.textTertiary} size={24} />
            )}
          </View>
        )}
        <View style={styles.cardLeft}>
          <View style={[styles.cardIcon, isSelected && styles.cardIconSelected]}>
            <FileText color={isSelected ? Colors.surface : Colors.primary} size={22} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{set.title}</Text>
            <Text style={styles.cardMeta}>
              {set.questionCount} question{set.questionCount !== 1 ? 's' : ''}
            </Text>
            {lastAttempt && (
              <View style={styles.scoreRow}>
                <View style={[
                  styles.scoreBadge,
                  { backgroundColor: bestScore !== null && bestScore >= 70 ? Colors.successLight : Colors.warningLight }
                ]}>
                  <Text style={[
                    styles.scoreText,
                    { color: bestScore !== null && bestScore >= 70 ? Colors.success : Colors.warning }
                  ]}>
                    Best: {bestScore}%
                  </Text>
                </View>
                <Text style={styles.attemptCount}>
                  {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
        {!selectMode && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={(e) => handleOpenMenu(set.id, set.title, e)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID={`quiz-menu-${index}`}
          >
            <MoreVertical color={Colors.textTertiary} size={20} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [selectMode, selectedIds, getAttemptsForSet, handleQuizPress, handleLongPress, handleOpenMenu]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const allSelected = quizSets.length > 0 && selectedIds.size === quizSets.length;
  const currentGroupForMenu = quizGroups.find(g => g.id === groupMenuId);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {selectMode && (
        <Animated.View
          style={[
            styles.selectToolbar,
            {
              opacity: toolbarAnim,
              transform: [{ translateY: toolbarAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) }],
            },
          ]}
        >
          <View style={styles.toolbarLeft}>
            <TouchableOpacity onPress={handleExitSelectMode} style={styles.toolbarClose} activeOpacity={0.7}>
              <X color={Colors.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.toolbarCount}>
              {selectedIds.size} selected
            </Text>
          </View>
          <View style={styles.toolbarActions}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.toolbarBtn} activeOpacity={0.7}>
              <Text style={styles.toolbarBtnText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {quizSets.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <BookOpen color={Colors.accent} size={48} />
            </View>
            <Text style={styles.emptyTitle}>No quizzes yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload a PDF with questions and answers, or paste text content to create your first quiz set.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleUpload}
              activeOpacity={0.8}
              testID="empty-upload-button"
            >
              <Plus color={Colors.surface} size={20} />
              <Text style={styles.emptyButtonText}>Import Questions</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {!selectMode && (
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>{quizSets.length} Quiz Set{quizSets.length !== 1 ? 's' : ''}</Text>
                <TouchableOpacity
                  style={styles.addGroupBtn}
                  onPress={handleCreateGroup}
                  activeOpacity={0.7}
                  testID="add-group-btn"
                >
                  <FolderPlus color={Colors.primary} size={20} />
                </TouchableOpacity>
              </View>
            )}

            {quizGroups.map(group => {
              const groupQuizzes = quizzesByGroup.get(group.id) ?? [];
              const isCollapsed = collapsedGroups.has(group.id);

              return (
                <View key={group.id} style={styles.groupContainer}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroupCollapse(group.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.groupHeaderLeft}>
                      <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                      {isCollapsed ? (
                        <ChevronRight color={Colors.textSecondary} size={18} />
                      ) : (
                        <ChevronDown color={Colors.textSecondary} size={18} />
                      )}
                      <Text style={styles.groupName}>{group.name}</Text>
                      <View style={styles.groupCountBadge}>
                        <Text style={styles.groupCountText}>{groupQuizzes.length}</Text>
                      </View>
                    </View>
                    {!selectMode && (
                      <TouchableOpacity
                        onPress={(e) => handleOpenGroupMenu(group.id, e)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.groupMoreBtn}
                      >
                        <MoreVertical color={Colors.textTertiary} size={18} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {!isCollapsed && (
                    <View style={styles.groupContent}>
                      {groupQuizzes.length === 0 ? (
                        <Text style={styles.groupEmptyText}>No quizzes in this group</Text>
                      ) : (
                        groupQuizzes.map((set, idx) => renderQuizCard(set, idx))
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {ungroupedQuizzes.length > 0 && (
              <View style={styles.ungroupedSection}>
                {quizGroups.length > 0 && (
                  <View style={styles.ungroupedHeader}>
                    <Text style={styles.ungroupedTitle}>Ungrouped</Text>
                    <View style={styles.groupCountBadge}>
                      <Text style={styles.groupCountText}>{ungroupedQuizzes.length}</Text>
                    </View>
                  </View>
                )}
                {ungroupedQuizzes.map((set, index) => renderQuizCard(set, index + 1000))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {selectMode && selectedIds.size > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomBarBtn}
            onPress={handleBulkDelete}
            activeOpacity={0.7}
            testID="bulk-delete-btn"
          >
            <Trash2 color={Colors.error} size={20} />
            <Text style={[styles.bottomBarBtnText, { color: Colors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>
          <View style={styles.bottomBarDivider} />
          <TouchableOpacity
            style={styles.bottomBarBtn}
            onPress={handleShareSelected}
            activeOpacity={0.7}
            testID="share-btn"
          >
            <Share2 color={Colors.accent} size={20} />
            <Text style={[styles.bottomBarBtnText, { color: Colors.accent }]}>
              Share
            </Text>
          </TouchableOpacity>
          <View style={styles.bottomBarDivider} />
          <TouchableOpacity
            style={styles.bottomBarBtn}
            onPress={handleBulkMovePress}
            activeOpacity={0.7}
            testID="bulk-move-btn"
          >
            <FolderInput color={Colors.primary} size={20} />
            <Text style={[styles.bottomBarBtnText, { color: Colors.primary }]}>
              Move
            </Text>
          </TouchableOpacity>
          <View style={styles.bottomBarDivider} />
          <TouchableOpacity
            style={[styles.bottomBarBtn, selectedIds.size < 2 && { opacity: 0.4 }]}
            onPress={handleMergePress}
            activeOpacity={0.7}
            disabled={selectedIds.size < 2}
            testID="merge-btn"
          >
            <Merge color={Colors.primary} size={20} />
            <Text style={[styles.bottomBarBtnText, { color: Colors.primary }]}>
              Merge
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!selectMode && quizSets.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleUpload}
          activeOpacity={0.85}
          testID="fab-upload"
        >
          <Plus color={Colors.surface} size={24} />
        </TouchableOpacity>
      )}

      {/* Quiz context menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMenu}
      >
        <Pressable style={styles.menuOverlay} onPress={handleCloseMenu}>
          <View style={[styles.menuContainer, { top: menuPosition.y, left: menuPosition.x }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRenamePress}
              activeOpacity={0.7}
            >
              <Pencil color={Colors.text} size={18} />
              <Text style={styles.menuItemText}>Rename</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleModifyPress}
              activeOpacity={0.7}
            >
              <Settings2 color={Colors.text} size={18} />
              <Text style={styles.menuItemText}>Modify Questions</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMoveToGroupPress}
              activeOpacity={0.7}
            >
              <FolderInput color={Colors.text} size={18} />
              <Text style={styles.menuItemText}>Move to Group</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDuplicatePress}
              activeOpacity={0.7}
            >
              <Copy color={Colors.text} size={18} />
              <Text style={styles.menuItemText}>Duplicate</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeletePress}
              activeOpacity={0.7}
            >
              <Trash2 color={Colors.error} size={18} />
              <Text style={[styles.menuItemText, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Group context menu */}
      <Modal
        visible={groupMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setGroupMenuVisible(false)}>
          <View style={[styles.menuContainer, { top: groupMenuPosition.y, left: groupMenuPosition.x }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (currentGroupForMenu) handleEditGroup(currentGroupForMenu);
              }}
              activeOpacity={0.7}
            >
              <Pencil color={Colors.text} size={18} />
              <Text style={styles.menuItemText}>Edit Group</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (groupMenuId) handleAddQuizzesToGroupOpen(groupMenuId);
              }}
              activeOpacity={0.7}
            >
              <Plus color={Colors.text} size={18} />
              <Text style={styles.menuItemText}>Add Quizzes</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (currentGroupForMenu) handleDeleteGroup(currentGroupForMenu.id, currentGroupForMenu.name);
              }}
              activeOpacity={0.7}
            >
              <Trash2 color={Colors.error} size={18} />
              <Text style={[styles.menuItemText, { color: Colors.error }]}>Delete Group</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <Pressable style={styles.renameOverlay} onPress={() => setRenameVisible(false)}>
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>Rename Quiz</Text>
              <TouchableOpacity onPress={() => setRenameVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Quiz title"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={handleRenameConfirm}
              testID="rename-input"
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setRenameVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameConfirmBtn, !renameValue.trim() && { opacity: 0.4 }]}
                onPress={handleRenameConfirm}
                disabled={!renameValue.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.renameConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Merge modal */}
      <Modal
        visible={mergeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMergeVisible(false)}
      >
        <Pressable style={styles.renameOverlay} onPress={() => setMergeVisible(false)}>
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>Merge Quizzes</Text>
              <TouchableOpacity onPress={() => setMergeVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.mergeInfo}>
              {selectedIds.size} quizzes will be combined into one. The original quizzes will be removed.
            </Text>
            <TextInput
              style={styles.renameInput}
              value={mergeTitle}
              onChangeText={setMergeTitle}
              autoFocus
              placeholder="Merged quiz title"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={handleMergeConfirm}
              testID="merge-title-input"
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setMergeVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameConfirmBtn, !mergeTitle.trim() && { opacity: 0.4 }]}
                onPress={handleMergeConfirm}
                disabled={!mergeTitle.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.renameConfirmText}>Merge</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create/Edit Group modal */}
      <Modal
        visible={groupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <Pressable style={styles.renameOverlay} onPress={() => setGroupModalVisible(false)}>
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>{editingGroupId ? 'Edit Group' : 'New Group'}</Text>
              <TouchableOpacity onPress={() => setGroupModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.renameInput}
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              placeholder="Group name"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={handleSaveGroup}
              testID="group-name-input"
            />
            <Text style={styles.colorPickerLabel}>Color</Text>
            <View style={styles.colorPicker}>
              {GROUP_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    groupColor === color && styles.colorDotSelected,
                  ]}
                  onPress={() => setGroupColor(color)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setGroupModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameConfirmBtn, !groupName.trim() && { opacity: 0.4 }]}
                onPress={handleSaveGroup}
                disabled={!groupName.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.renameConfirmText}>{editingGroupId ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bulk Move to Group modal */}
      <Modal
        visible={bulkMoveVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkMoveVisible(false)}
      >
        <Pressable style={styles.renameOverlay} onPress={() => setBulkMoveVisible(false)}>
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>Move {selectedIds.size} Quiz{selectedIds.size !== 1 ? 'zes' : ''}</Text>
              <TouchableOpacity onPress={() => setBulkMoveVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.moveGroupList}>
              <TouchableOpacity
                style={styles.moveGroupItem}
                onPress={() => handleBulkMoveToGroup(undefined)}
                activeOpacity={0.7}
              >
                <FolderOpen color={Colors.textSecondary} size={20} />
                <Text style={styles.moveGroupItemText}>Ungrouped</Text>
              </TouchableOpacity>
              {quizGroups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.moveGroupItem}
                  onPress={() => handleBulkMoveToGroup(group.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.moveGroupDot, { backgroundColor: group.color }]} />
                  <Text style={styles.moveGroupItemText}>{group.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Quizzes to Group modal */}
      <Modal
        visible={addQuizzesToGroupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddQuizzesToGroupVisible(false)}
      >
        <Pressable style={styles.renameOverlay} onPress={() => setAddQuizzesToGroupVisible(false)}>
          <Pressable style={styles.addQuizzesCard} onPress={() => {}}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>Add Quizzes</Text>
              <TouchableOpacity onPress={() => setAddQuizzesToGroupVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            {quizzesNotInGroup.length === 0 ? (
              <Text style={styles.noGroupsText}>All quizzes are already in this group.</Text>
            ) : (
              <ScrollView style={styles.addQuizzesList} showsVerticalScrollIndicator={false}>
                {quizzesNotInGroup.map(set => {
                  const isChecked = addQuizzesSelected.has(set.id);
                  return (
                    <TouchableOpacity
                      key={set.id}
                      style={[styles.addQuizItem, isChecked && styles.addQuizItemSelected]}
                      onPress={() => handleToggleAddQuiz(set.id)}
                      activeOpacity={0.7}
                    >
                      {isChecked ? (
                        <CheckCircle color={Colors.primary} size={22} />
                      ) : (
                        <Circle color={Colors.textTertiary} size={22} />
                      )}
                      <View style={styles.addQuizItemContent}>
                        <Text style={styles.addQuizItemTitle} numberOfLines={1}>{set.title}</Text>
                        <Text style={styles.addQuizItemMeta}>
                          {set.questionCount} question{set.questionCount !== 1 ? 's' : ''}
                          {set.groupId ? ` · ${quizGroups.find(g => g.id === set.groupId)?.name ?? 'Grouped'}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setAddQuizzesToGroupVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameConfirmBtn, addQuizzesSelected.size === 0 && { opacity: 0.4 }]}
                onPress={handleConfirmAddQuizzes}
                disabled={addQuizzesSelected.size === 0}
                activeOpacity={0.8}
              >
                <Text style={styles.renameConfirmText}>Add ({addQuizzesSelected.size})</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Move to Group modal */}
      <Modal
        visible={moveToGroupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveToGroupVisible(false)}
      >
        <Pressable style={styles.renameOverlay} onPress={() => setMoveToGroupVisible(false)}>
          <Pressable style={styles.renameCard} onPress={() => {}}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>Move to Group</Text>
              <TouchableOpacity onPress={() => setMoveToGroupVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.moveGroupList}>
              <TouchableOpacity
                style={styles.moveGroupItem}
                onPress={() => handleMoveToGroup(undefined)}
                activeOpacity={0.7}
              >
                <FolderOpen color={Colors.textSecondary} size={20} />
                <Text style={styles.moveGroupItemText}>Ungrouped</Text>
              </TouchableOpacity>
              {quizGroups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.moveGroupItem}
                  onPress={() => handleMoveToGroup(group.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.moveGroupDot, { backgroundColor: group.color }]} />
                  <Text style={styles.moveGroupItemText}>{group.name}</Text>
                </TouchableOpacity>
              ))}
              {quizGroups.length === 0 && (
                <Text style={styles.noGroupsText}>No groups yet. Create one first.</Text>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
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
    marginBottom: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  emptyButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  addGroupBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.accentLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolbarClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarCount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  toolbarBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  groupContainer: {
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  groupCountBadge: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  groupCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  groupMoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupContent: {
    paddingLeft: 4,
  },
  groupEmptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
    paddingVertical: 12,
    paddingLeft: 32,
    fontStyle: 'italic' as const,
  },
  ungroupedSection: {
    marginTop: 4,
  },
  ungroupedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  ungroupedTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  quizCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quizCardSelected: {
    backgroundColor: Colors.accentLight,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxArea: {
    marginRight: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardIconSelected: {
    backgroundColor: Colors.primary,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  cardMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  attemptCount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bottomBarBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  bottomBarDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 12,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  renameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  renameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  mergeInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 10,
  },
  renameCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  renameCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  renameConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  renameConfirmText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.surface,
  },
  colorPickerLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  moveGroupList: {
    gap: 4,
    marginBottom: 8,
  },
  moveGroupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
  },
  moveGroupDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  moveGroupItemText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  noGroupsText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  addQuizzesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  addQuizzesList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  addQuizItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Colors.surfaceAlt,
  },
  addQuizItemSelected: {
    backgroundColor: Colors.accentLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addQuizItemContent: {
    flex: 1,
  },
  addQuizItemTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  addQuizItemMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
